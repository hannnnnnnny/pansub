(function exposeAudioTranslator(root, factory) {
  const glossaryUtils = root.PANSUB_GLOSSARY_UTILS
    || (typeof require === 'function' ? require('./glossary-utils.js') : null);
  const api = factory(glossaryUtils);
  root.PANSUB_AUDIO_TRANSLATOR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioTranslatorApi(glossaryUtils) {
  if (!glossaryUtils) throw new Error('PANSUB_GLOSSARY_UTILS is required');
  const { protectGlossaryTerms, restoreGlossaryTerms } = glossaryUtils;

  function codeError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function flattenTranslation(data) {
    if (!Array.isArray(data?.[0])) return '';
    return data[0]
      .map((segment) => (typeof segment?.[0] === 'string' ? segment[0] : ''))
      .join('')
      .trim();
  }

  function createAudioTranslator(options = {}) {
    const TranslatorClass = options.TranslatorClass || null;
    const sourceLanguage = options.sourceLanguage || 'en';
    const targetLanguage = options.targetLanguage || 'zh-CN';
    const allowGoogleFallback = options.allowGoogleFallback === true;
    const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    const glossary = options.glossary || { terms: [] };
    const glossaryEnabled = options.glossaryEnabled !== false;
    let localSessionPromise = null;
    let destroyed = false;

    async function createLocalSession() {
      if (!TranslatorClass
        || typeof TranslatorClass.availability !== 'function'
        || typeof TranslatorClass.create !== 'function') return null;
      const translatorOptions = { sourceLanguage, targetLanguage };
      try {
        const availability = await TranslatorClass.availability(translatorOptions);
        if (availability === 'unavailable') return null;
        return await TranslatorClass.create(translatorOptions);
      } catch (error) {
        return null;
      }
    }

    function localSession() {
      if (!localSessionPromise) localSessionPromise = createLocalSession();
      return localSessionPromise;
    }

    async function prepare() {
      if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) return 'identity';
      const local = await localSession();
      if (local) return 'local';
      if (allowGoogleFallback) return 'google';
      throw codeError('GOOGLE_CONSENT_REQUIRED');
    }

    async function googleTranslate(text, signal) {
      if (!fetchImpl) throw codeError('GOOGLE_TRANSLATION_UNAVAILABLE');
      const params = new URLSearchParams({
        client: 'gtx',
        sl: sourceLanguage,
        tl: targetLanguage,
        dt: 't',
        q: text
      });
      const baseUrl = 'https://translate.googleapis.com/translate_a/single';
      const usePost = text.length > 1200;
      const response = await fetchImpl(usePost ? baseUrl : `${baseUrl}?${params.toString()}`, usePost
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: params.toString(),
            signal
          }
        : { signal });
      if (!response.ok) throw codeError(`GOOGLE_TRANSLATION_HTTP_${response.status || 0}`);
      const translated = flattenTranslation(await response.json());
      if (!translated) throw codeError('GOOGLE_TRANSLATION_EMPTY');
      return translated;
    }

    async function translate(text, context = {}) {
      if (destroyed) throw codeError('AUDIO_TRANSLATOR_DESTROYED');
      const sequence = context.sequence;
      if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
        return { sequence, text: String(text), provider: 'identity' };
      }
      const prepared = protectGlossaryTerms(String(text), {
        glossary,
        targetLanguage,
        enabled: glossaryEnabled
      });
      const local = await localSession();
      if (context.signal?.aborted) throw codeError('TRANSLATION_ABORTED');
      if (local) {
        const translated = await local.translate(prepared.text, context.signal ? { signal: context.signal } : undefined);
        return {
          sequence,
          text: restoreGlossaryTerms(translated, prepared.replacements),
          provider: 'local'
        };
      }
      if (!allowGoogleFallback) throw codeError('GOOGLE_CONSENT_REQUIRED');
      const translated = await googleTranslate(prepared.text, context.signal);
      return {
        sequence,
        text: restoreGlossaryTerms(translated, prepared.replacements),
        provider: 'google'
      };
    }

    async function destroy() {
      destroyed = true;
      const local = await localSessionPromise;
      local?.destroy?.();
      localSessionPromise = null;
    }

    return Object.freeze({ prepare, translate, destroy });
  }

  function createTranslationScheduler(options = {}) {
    const translator = options.translator;
    const emit = typeof options.emit === 'function' ? options.emit : () => {};
    const stabilityMs = Number.isFinite(options.stabilityMs) ? options.stabilityMs : 350;
    const minVisibleIntervalMs = Number.isFinite(options.minVisibleIntervalMs)
      ? options.minVisibleIntervalMs
      : 500;
    const setTimeoutImpl = options.setTimeoutImpl || setTimeout;
    const clearTimeoutImpl = options.clearTimeoutImpl || clearTimeout;
    const now = options.now || Date.now;

    let sequence = 0;
    let pendingTimer = null;
    let activeController = null;
    let stopped = false;
    let lastVisibleAt = 0;

    async function runTranslation(text, kind, currentSequence) {
      if (stopped || currentSequence !== sequence) return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const result = await translator.translate(text, {
          sequence: currentSequence,
          signal: controller.signal
        });
        if (stopped || controller.signal.aborted || currentSequence !== sequence) return;
        const timestamp = now();
        if (kind !== 'final' && timestamp - lastVisibleAt < minVisibleIntervalMs) return;
        lastVisibleAt = timestamp;
        emit({
          kind: 'subtitle',
          sequence: currentSequence,
          text: result.text,
          final: kind === 'final',
          provider: result.provider
        });
      } catch (error) {
        if (stopped || controller.signal.aborted || currentSequence !== sequence) return;
        emit({ kind: 'error', sequence: currentSequence, code: error?.code || error?.message || 'TRANSLATION_FAILED' });
      } finally {
        if (activeController === controller) activeController = null;
      }
    }

    function push(event) {
      const text = String(event?.text || '').trim();
      if (stopped || !text) return;
      sequence += 1;
      const currentSequence = sequence;
      if (pendingTimer !== null) {
        clearTimeoutImpl(pendingTimer);
        pendingTimer = null;
      }
      activeController?.abort();
      if (event.kind === 'final' || stabilityMs === 0) {
        void runTranslation(text, event.kind, currentSequence);
        return;
      }
      pendingTimer = setTimeoutImpl(() => {
        pendingTimer = null;
        void runTranslation(text, event.kind, currentSequence);
      }, stabilityMs);
    }

    function stop() {
      stopped = true;
      sequence += 1;
      if (pendingTimer !== null) clearTimeoutImpl(pendingTimer);
      pendingTimer = null;
      activeController?.abort();
      activeController = null;
      void translator.destroy?.();
    }

    return Object.freeze({ push, stop });
  }

  return Object.freeze({ createAudioTranslator, createTranslationScheduler, flattenTranslation });
});
