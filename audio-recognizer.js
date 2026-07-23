(function exposeAudioRecognizer(root, factory) {
  const api = factory();
  root.PANSUB_AUDIO_RECOGNIZER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioRecognizerApi() {
  function codeError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function createLocalRecognizer(options = {}) {
    const Recognition = options.Recognition;
    const language = options.language || 'en-US';
    const emit = typeof options.emit === 'function' ? options.emit : () => {};
    const restartDelayMs = Number.isFinite(options.restartDelayMs) ? options.restartDelayMs : 250;
    const setTimeoutImpl = options.setTimeoutImpl || setTimeout;

    let recognition = null;
    let audioTrack = null;
    let prepared = false;
    let stopped = true;
    let restartTimer = null;

    function availabilityOptions() {
      return {
        langs: [language],
        processLocally: true,
        quality: 'dictation'
      };
    }

    async function prepare() {
      if (!Recognition
        || typeof Recognition.available !== 'function'
        || typeof Recognition.install !== 'function') {
        throw codeError('LOCAL_SPEECH_UNSUPPORTED');
      }

      const availability = await Recognition.available(availabilityOptions());
      if (availability === 'unavailable') throw codeError('LOCAL_LANGUAGE_UNAVAILABLE');
      if (availability !== 'available') {
        const installed = await Recognition.install(availabilityOptions());
        if (!installed) throw codeError('LOCAL_LANGUAGE_INSTALL_FAILED');
      }
      prepared = true;
    }

    function emitResults(event) {
      const start = Number.isInteger(event?.resultIndex) ? event.resultIndex : 0;
      const results = event?.results || [];
      for (let index = start; index < results.length; index += 1) {
        const result = results[index];
        const alternative = result?.[0];
        const text = String(alternative?.transcript || '').trim();
        if (!text) continue;
        emit({
          kind: result.isFinal ? 'final' : 'partial',
          text,
          confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : null
        });
      }
    }

    function createAndStart() {
      if (stopped || !audioTrack || audioTrack.readyState !== 'live') return;
      recognition = new Recognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.processLocally = true;
      if ('quality' in recognition) recognition.quality = 'dictation';
      recognition.onresult = emitResults;
      recognition.onerror = (event) => {
        emit({ kind: 'error', code: event?.error || 'LOCAL_SPEECH_ERROR' });
      };
      recognition.onend = () => {
        if (stopped || !audioTrack || audioTrack.readyState !== 'live') return;
        emit({ kind: 'degraded', code: 'LOCAL_SPEECH_RESTARTING' });
        restartTimer = setTimeoutImpl(() => {
          restartTimer = null;
          createAndStart();
        }, restartDelayMs);
      };
      recognition.start(audioTrack);
    }

    function start(track) {
      if (!prepared) throw codeError('LOCAL_SPEECH_NOT_PREPARED');
      if (!track || track.kind !== 'audio' || track.readyState !== 'live') {
        throw codeError('INVALID_AUDIO_TRACK');
      }
      stopped = false;
      audioTrack = track;
      createAndStart();
    }

    function stop() {
      stopped = true;
      if (restartTimer !== null && typeof clearTimeout === 'function') {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (recognition) {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        try {
          recognition.abort();
        } catch (error) {
          // Recognition may already be closed.
        }
      }
      recognition = null;
      audioTrack = null;
    }

    return Object.freeze({ prepare, start, stop });
  }

  return Object.freeze({ createLocalRecognizer });
});
