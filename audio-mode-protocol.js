(function exposeAudioModeProtocol(root, factory) {
  const protocol = factory();
  root.PANSUB_AUDIO_PROTOCOL = protocol;
  if (typeof module !== 'undefined' && module.exports) module.exports = protocol;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioModeProtocol() {
  const phases = Object.freeze([
    'idle',
    'native',
    'available',
    'permission',
    'preparing',
    'listening',
    'degraded',
    'stopping',
    'error'
  ]);

  const sources = Object.freeze(['auto', 'native', 'audio']);

  const messages = Object.freeze({
    START: 'PANSUB_AUDIO_START',
    STOP: 'PANSUB_AUDIO_STOP',
    GET_STATE: 'PANSUB_AUDIO_GET_STATE',
    STATE_CHANGED: 'PANSUB_AUDIO_STATE_CHANGED',
    SUBTITLE: 'PANSUB_AUDIO_SUBTITLE',
    OFFSCREEN_EVENT: 'PANSUB_AUDIO_OFFSCREEN_EVENT',
    CAPTURE_START: 'PANSUB_AUDIO_CAPTURE_START',
    CAPTURE_STOP: 'PANSUB_AUDIO_CAPTURE_STOP',
    CAPTURE_GET_STATE: 'PANSUB_AUDIO_CAPTURE_GET_STATE',
    NATIVE_CAPTION_STATUS: 'PANSUB_NATIVE_CAPTION_STATUS',
    OPEN_AUDIO_POPUP: 'PANSUB_OPEN_AUDIO_POPUP'
  });

  function isAudioState(value) {
    return Boolean(value)
      && phases.includes(value.phase)
      && sources.includes(value.source);
  }

  return Object.freeze({ phases, sources, messages, isAudioState });
});
