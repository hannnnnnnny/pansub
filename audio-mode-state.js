(function exposeAudioModeState(root, factory) {
  const protocol = root.PANSUB_AUDIO_PROTOCOL
    || (typeof require === 'function' ? require('./audio-mode-protocol.js') : null);
  const stateApi = factory(protocol);
  root.PANSUB_AUDIO_STATE = stateApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = stateApi;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioModeState(protocol) {
  if (!protocol) throw new Error('PANSUB_AUDIO_PROTOCOL is required');

  function createAudioState(updatedAt = 0) {
    return Object.freeze({
      phase: 'idle',
      sessionId: null,
      tabId: null,
      source: 'auto',
      error: null,
      detail: null,
      updatedAt
    });
  }

  function nextState(state, changes, now) {
    return Object.freeze({
      ...state,
      ...changes,
      updatedAt: Number.isFinite(now) ? now : Date.now()
    });
  }

  function reduceAudioState(state, event) {
    if (!state || !protocol.isAudioState(state)) throw new TypeError('Invalid audio mode state');
    if (!event || typeof event.type !== 'string') return state;
    if (state.sessionId && event.sessionId && state.sessionId !== event.sessionId) return state;

    switch (event.type) {
      case 'START_REQUESTED':
        return nextState(state, {
          phase: 'permission',
          sessionId: event.sessionId,
          tabId: event.tabId,
          source: 'audio',
          error: null,
          detail: null
        }, event.now);
      case 'CAPTURE_READY':
        return nextState(state, { phase: 'preparing', error: null, detail: null }, event.now);
      case 'LISTENING':
        return nextState(state, { phase: 'listening', error: null, detail: null }, event.now);
      case 'DEGRADED':
        return nextState(state, { phase: 'degraded', detail: event.detail || null }, event.now);
      case 'STOP_REQUESTED':
        return nextState(state, { phase: 'stopping' }, event.now);
      case 'ERROR':
        return nextState(state, {
          phase: 'error',
          error: event.error || 'UNKNOWN_AUDIO_ERROR',
          detail: event.detail || null
        }, event.now);
      case 'STOPPED':
        return createAudioState(Number.isFinite(event.now) ? event.now : Date.now());
      case 'CAPTION_STATUS':
        if (state.sessionId) return state;
        return nextState(state, event.hasCaptions
          ? { phase: 'native', source: 'native', error: null, detail: null }
          : { phase: 'available', source: 'auto', error: null, detail: null }, event.now);
      default:
        return state;
    }
  }

  return Object.freeze({ createAudioState, reduceAudioState });
});
