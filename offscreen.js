(() => {
  const { messages } = globalThis.PANSUB_AUDIO_PROTOCOL;
  const { createLocalRecognizer } = globalThis.PANSUB_AUDIO_RECOGNIZER;
  const { createAudioTranslator, createTranslationScheduler } = globalThis.PANSUB_AUDIO_TRANSLATOR;

  let session = null;

  async function sendEvent(sessionId, event, detail = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: messages.OFFSCREEN_EVENT,
        sessionId,
        event,
        ...detail
      });
    } catch (error) {
      // The service worker may be restarting; media cleanup still runs locally.
    }
  }

  function recognitionConstructor() {
    return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
  }

  async function releaseSession(current, emitStopped = true, reason = 'user') {
    if (!current) return;
    try {
      current.translationScheduler?.stop();
      current.recognizer?.stop();
    } catch (error) {
      // Continue releasing the media graph.
    }
    try {
      current.recognitionTrack?.stop();
    } catch (error) {
      // Continue releasing the source tracks.
    }
    for (const track of current.stream?.getTracks?.() || []) {
      try {
        track.stop();
      } catch (error) {
        // A track may already have ended with the captured tab.
      }
    }
    try {
      current.sourceNode?.disconnect();
    } catch (error) {
      // A disconnected node needs no further work.
    }
    try {
      await current.audioContext?.close();
    } catch (error) {
      // A closed AudioContext needs no further work.
    }
    if (session === current) session = null;
    if (emitStopped) await sendEvent(current.id, 'STOPPED', { reason });
  }

  async function stopSession(sessionId, reason = 'user') {
    if (!session) return { stopped: false, sessionId: null };
    if (sessionId && session.id !== sessionId) {
      return { stopped: false, sessionId: session.id };
    }
    const current = session;
    session = null;
    await releaseSession(current, true, reason);
    return { stopped: true, sessionId: current.id };
  }

  async function startSession(message) {
    if (session) await stopSession(session.id, 'replaced');

    const current = {
      id: message.sessionId,
      tabId: message.tabId,
      phase: 'preparing',
      stream: null,
      recognitionTrack: null,
      audioContext: null,
      sourceNode: null,
      recognizer: null,
      translator: null,
      translationScheduler: null
    };
    session = current;
    await sendEvent(current.id, 'PREPARING');

    try {
      current.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: message.streamId
          }
        },
        video: false
      });

      const [sourceTrack] = current.stream.getAudioTracks();
      if (!sourceTrack) throw new Error('TAB_AUDIO_TRACK_MISSING');
      current.recognitionTrack = sourceTrack.clone();
      current.audioContext = new AudioContext();
      current.sourceNode = current.audioContext.createMediaStreamSource(current.stream);
      current.sourceNode.connect(current.audioContext.destination);
      if (current.audioContext.state === 'suspended' && current.audioContext.resume) {
        await current.audioContext.resume();
      }

      const sourceLanguage = message.settings?.sourceLanguage || 'en-US';
      current.translator = createAudioTranslator({
        TranslatorClass: globalThis.Translator || null,
        sourceLanguage: sourceLanguage.split('-')[0],
        targetLanguage: message.settings?.targetLanguage || 'zh-CN',
        allowGoogleFallback: message.settings?.allowGoogleFallback === true,
        glossary: globalThis.PANSUB_GLOSSARY || { terms: [] },
        glossaryEnabled: message.settings?.glossaryEnabled !== false
      });
      current.translationScheduler = createTranslationScheduler({
        translator: current.translator,
        emit(event) {
          if (session !== current) return;
          if (event.kind === 'subtitle') {
            void sendEvent(current.id, 'SUBTITLE', {
              sequence: event.sequence,
              text: event.text,
              final: event.final,
              provider: event.provider
            });
            return;
          }
          if (event.kind === 'error') {
            current.phase = 'error';
            void sendEvent(current.id, 'ERROR', { error: event.code });
            void releaseSession(current, false, 'translation-error');
          }
        }
      });

      current.recognizer = createLocalRecognizer({
        Recognition: recognitionConstructor(),
        language: sourceLanguage,
        emit(event) {
          if (session !== current) return;
          if (event.kind === 'partial' || event.kind === 'final') {
            current.translationScheduler.push(event);
            return;
          }
          if (event.kind === 'degraded') {
            current.phase = 'degraded';
            void sendEvent(current.id, 'DEGRADED', { detail: event.code });
            return;
          }
          if (event.kind === 'error') {
            current.phase = 'error';
            void (async () => {
              await sendEvent(current.id, 'ERROR', { error: event.code });
              await releaseSession(current, false, 'recognition-error');
            })();
          }
        }
      });
      await Promise.all([
        current.recognizer.prepare(),
        current.translator.prepare()
      ]);
      if (session !== current) return;
      current.recognizer.start(current.recognitionTrack);
      current.phase = 'listening';
      await sendEvent(current.id, 'LISTENING');
    } catch (error) {
      current.phase = 'error';
      if (session === current) {
        await sendEvent(current.id, 'ERROR', {
          error: error?.code || error?.message || 'AUDIO_RUNTIME_FAILED'
        });
      }
      await releaseSession(current, false, 'error');
      throw error;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === messages.CAPTURE_START) {
      startSession(message)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({
          ok: false,
          error: error?.code || error?.message || 'AUDIO_RUNTIME_FAILED'
        }));
      return true;
    }
    if (message?.type === messages.CAPTURE_STOP) {
      stopSession(message.sessionId, message.reason)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error?.message || 'AUDIO_STOP_FAILED' }));
      return true;
    }
    if (message?.type === messages.CAPTURE_GET_STATE) {
      sendResponse({
        ok: true,
        session: session
          ? {
              sessionId: session.id,
              tabId: session.tabId,
              phase: session.phase
            }
          : null
      });
      return false;
    }
    return false;
  });
})();
