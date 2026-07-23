const assert = require('assert');
const { createLocalRecognizer } = require('../audio-recognizer.js');

class FakeRecognition {
  static availability = 'available';
  static installResult = true;
  static availableCalls = [];
  static installCalls = [];
  static instances = [];

  static async available(options) {
    this.availableCalls.push(options);
    return this.availability;
  }

  static async install(options) {
    this.installCalls.push(options);
    return this.installResult;
  }

  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.processLocally = false;
    this.quality = 'command';
    this.aborted = false;
    FakeRecognition.instances.push(this);
  }

  start(track) {
    this.startedTrack = track;
  }

  abort() {
    this.aborted = true;
  }

  emitResult(text, isFinal) {
    const alternative = { transcript: text, confidence: 0.91 };
    const result = { 0: alternative, length: 1, isFinal };
    this.onresult?.({ resultIndex: 0, results: [result] });
  }

  emitError(error) {
    this.onerror?.({ error });
  }
}

function resetFake() {
  FakeRecognition.availability = 'available';
  FakeRecognition.installResult = true;
  FakeRecognition.availableCalls = [];
  FakeRecognition.installCalls = [];
  FakeRecognition.instances = [];
}

async function run() {
  resetFake();
  const events = [];
  const track = { kind: 'audio', readyState: 'live' };
  const recognizer = createLocalRecognizer({
    Recognition: FakeRecognition,
    language: 'en-US',
    emit: (event) => events.push(event),
    restartDelayMs: 0,
    setTimeoutImpl: (callback) => callback()
  });

  await recognizer.prepare();
  assert.deepStrictEqual(FakeRecognition.availableCalls[0], {
    langs: ['en-US'],
    processLocally: true,
    quality: 'dictation'
  });
  recognizer.start(track);

  const instance = FakeRecognition.instances[0];
  assert.strictEqual(instance.startedTrack, track);
  assert.strictEqual(instance.lang, 'en-US');
  assert.strictEqual(instance.continuous, true);
  assert.strictEqual(instance.interimResults, true);
  assert.strictEqual(instance.processLocally, true);
  assert.strictEqual(instance.quality, 'dictation');

  instance.emitResult('database schema', false);
  instance.emitResult('database schema', true);
  assert.deepStrictEqual(events.slice(0, 2).map((event) => event.kind), ['partial', 'final']);
  assert.strictEqual(events[0].text, 'database schema');

  instance.emitError('network');
  assert.strictEqual(events.at(-1).code, 'network');

  instance.onend();
  assert.strictEqual(FakeRecognition.instances.length, 2, 'unexpected end should restart recognition');
  assert.strictEqual(events.some((event) => event.kind === 'degraded'), true);

  recognizer.stop();
  assert.strictEqual(FakeRecognition.instances[1].aborted, true);

  resetFake();
  FakeRecognition.availability = 'downloadable';
  const installing = createLocalRecognizer({ Recognition: FakeRecognition, language: 'en-US', emit() {} });
  await installing.prepare();
  assert.strictEqual(FakeRecognition.installCalls.length, 1);

  resetFake();
  FakeRecognition.availability = 'unavailable';
  const unavailable = createLocalRecognizer({ Recognition: FakeRecognition, language: 'en-US', emit() {} });
  await assert.rejects(() => unavailable.prepare(), /LOCAL_LANGUAGE_UNAVAILABLE/);

  const unsupported = createLocalRecognizer({ Recognition: null, language: 'en-US', emit() {} });
  await assert.rejects(() => unsupported.prepare(), /LOCAL_SPEECH_UNSUPPORTED/);

  console.log('Audio recognizer tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
