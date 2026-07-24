const assert = require('assert');
const protocol = require('../audio-mode-protocol.js');
const { createAudioState, reduceAudioState } = require('../audio-mode-state.js');

function run() {
  assert.strictEqual(protocol.messages.START, 'PANSUB_AUDIO_START');
  assert(protocol.phases.includes('listening'));
  assert.strictEqual(protocol.isAudioState({ phase: 'idle', source: 'auto' }), true);
  assert.strictEqual(protocol.isAudioState({ phase: 'unknown', source: 'auto' }), false);

  const idle = createAudioState();
  assert.deepStrictEqual(idle, {
    phase: 'idle',
    sessionId: null,
    tabId: null,
    source: 'auto',
    error: null,
    detail: null,
    updatedAt: 0
  });

  let state = reduceAudioState(idle, {
    type: 'START_REQUESTED',
    sessionId: 'session-1',
    tabId: 7,
    now: 10
  });
  assert.strictEqual(state.phase, 'permission');
  assert.strictEqual(state.source, 'audio');

  state = reduceAudioState(state, {
    type: 'CAPTURE_READY',
    sessionId: 'session-1',
    now: 20
  });
  assert.strictEqual(state.phase, 'preparing');

  state = reduceAudioState(state, {
    type: 'LISTENING',
    sessionId: 'session-1',
    now: 30
  });
  assert.strictEqual(state.phase, 'listening');

  const stale = reduceAudioState(state, {
    type: 'ERROR',
    sessionId: 'session-old',
    error: 'STALE_ERROR',
    now: 35
  });
  assert.strictEqual(stale, state, 'stale session events must be ignored');

  state = reduceAudioState(state, {
    type: 'DEGRADED',
    sessionId: 'session-1',
    detail: 'Recognition is restarting',
    now: 36
  });
  assert.strictEqual(state.phase, 'degraded');
  assert.strictEqual(state.detail, 'Recognition is restarting');

  state = reduceAudioState(state, {
    type: 'STOP_REQUESTED',
    sessionId: 'session-1',
    now: 38
  });
  assert.strictEqual(state.phase, 'stopping');

  state = reduceAudioState(state, {
    type: 'STOPPED',
    sessionId: 'session-1',
    now: 40
  });
  assert.deepStrictEqual(state, createAudioState(40));

  const available = reduceAudioState(state, {
    type: 'CAPTION_STATUS',
    hasCaptions: false,
    now: 50
  });
  assert.strictEqual(available.phase, 'available');
  assert.strictEqual(available.source, 'auto');

  const native = reduceAudioState(available, {
    type: 'CAPTION_STATUS',
    hasCaptions: true,
    now: 60
  });
  assert.strictEqual(native.phase, 'native');
  assert.strictEqual(native.source, 'native');

  console.log('Audio mode state tests passed');
}

run();
