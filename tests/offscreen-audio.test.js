const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

async function run() {
  const listeners = [];
  const messages = [];
  const mediaRequests = [];
  const recognizers = [];
  const contexts = [];

  const recognitionTrack = {
    kind: 'audio',
    readyState: 'live',
    stopped: false,
    stop() {
      this.stopped = true;
      this.readyState = 'ended';
    }
  };
  const sourceTrack = {
    kind: 'audio',
    readyState: 'live',
    stopped: false,
    clone() {
      return recognitionTrack;
    },
    stop() {
      this.stopped = true;
      this.readyState = 'ended';
    }
  };
  const stream = {
    getAudioTracks: () => [sourceTrack],
    getTracks: () => [sourceTrack]
  };

  class FakeAudioContext {
    constructor() {
      this.closed = false;
      this.destination = {};
      this.sourceNode = {
        connectedTo: null,
        disconnected: false,
        connect: (target) => {
          this.sourceNode.connectedTo = target;
        },
        disconnect: () => {
          this.sourceNode.disconnected = true;
        }
      };
      contexts.push(this);
    }

    createMediaStreamSource(received) {
      assert.strictEqual(received, stream);
      return this.sourceNode;
    }

    async close() {
      this.closed = true;
    }
  }

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    AudioContext: FakeAudioContext,
    SpeechRecognition: class {},
    Translator: class FakeTranslator {
      static async availability() {
        return 'available';
      }

      static async create() {
        return {
          async translate(text) {
            return `译文：${text}`;
          },
          destroy() {}
        };
      }
    },
    navigator: {
      mediaDevices: {
        async getUserMedia(constraints) {
          mediaRequests.push(constraints);
          return stream;
        }
      }
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          }
        },
        async sendMessage(message) {
          messages.push(message);
        }
      }
    },
    PANSUB_AUDIO_RECOGNIZER: {
      createLocalRecognizer(options) {
        const recognizer = {
          prepared: false,
          startedTrack: null,
          stopped: false,
          async prepare() {
            this.prepared = true;
          },
          start(track) {
            this.startedTrack = track;
          },
          stop() {
            this.stopped = true;
          },
          emit(event) {
            options.emit(event);
          }
        };
        recognizers.push(recognizer);
        return recognizer;
      }
    }
  });
  context.globalThis = context;
  context.window = context;

  vm.runInContext(fs.readFileSync(path.join(root, 'audio-mode-protocol.js'), 'utf8'), context, { filename: 'audio-mode-protocol.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'glossary.js'), 'utf8'), context, { filename: 'glossary.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'glossary-utils.js'), 'utf8'), context, { filename: 'glossary-utils.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'audio-translator.js'), 'utf8'), context, { filename: 'audio-translator.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'offscreen.js'), 'utf8'), context, { filename: 'offscreen.js' });
  assert.strictEqual(listeners.length, 1);

  async function dispatch(message) {
    return new Promise((resolve, reject) => {
      const result = listeners[0](message, {}, (response) => {
        if (response?.ok === false) reject(new Error(response.error));
        else resolve(response);
      });
      if (result !== true) resolve(undefined);
      setTimeout(() => reject(new Error(`No response for ${message.type}`)), 100);
    });
  }

  await dispatch({
    type: 'PANSUB_AUDIO_CAPTURE_START',
    sessionId: 'session-1',
    tabId: 12,
    streamId: 'stream-1',
    settings: {
      sourceLanguage: 'en-US',
      targetLanguage: 'zh-CN',
      allowGoogleFallback: false,
      glossaryEnabled: true
    }
  });

  assert.strictEqual(mediaRequests[0].audio.mandatory.chromeMediaSource, 'tab');
  assert.strictEqual(mediaRequests[0].audio.mandatory.chromeMediaSourceId, 'stream-1');
  assert.strictEqual(contexts[0].sourceNode.connectedTo, contexts[0].destination);
  assert.strictEqual(recognizers[0].prepared, true);
  assert.strictEqual(recognizers[0].startedTrack, recognitionTrack);
  assert(messages.some((message) => message.event === 'LISTENING'));
  const activeSession = await dispatch({ type: 'PANSUB_AUDIO_CAPTURE_GET_STATE' });
  assert.strictEqual(activeSession.session.sessionId, 'session-1');
  assert.strictEqual(activeSession.session.tabId, 12);
  assert.strictEqual(activeSession.session.phase, 'listening');

  recognizers[0].emit({ kind: 'final', text: 'database schema', confidence: 0.8 });
  for (let attempt = 0; attempt < 20 && !messages.some((message) => message.event === 'SUBTITLE'); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const subtitle = messages.find((message) => message.event === 'SUBTITLE');
  assert(subtitle, 'translated subtitle should be emitted');
  assert(subtitle.text.startsWith('译文：'));

  const stoppedSession = await dispatch({
    type: 'PANSUB_AUDIO_CAPTURE_STOP',
    sessionId: 'session-1',
    reason: 'user'
  });
  assert.strictEqual(stoppedSession.stopped, true);
  assert.strictEqual(recognizers[0].stopped, true);
  assert.strictEqual(sourceTrack.stopped, true);
  assert.strictEqual(recognitionTrack.stopped, true);
  assert.strictEqual(contexts[0].closed, true);
  assert.strictEqual(messages.at(-1).event, 'STOPPED');

  sourceTrack.stopped = false;
  sourceTrack.readyState = 'live';
  recognitionTrack.stopped = false;
  recognitionTrack.readyState = 'live';
  await dispatch({
    type: 'PANSUB_AUDIO_CAPTURE_START',
    sessionId: 'session-2',
    tabId: 12,
    streamId: 'stream-2',
    settings: {
      sourceLanguage: 'en-US',
      targetLanguage: 'zh-CN',
      allowGoogleFallback: false,
      glossaryEnabled: true
    }
  });
  recognizers[1].emit({ kind: 'error', code: 'audio-capture' });
  for (let attempt = 0; attempt < 20 && !contexts[1].closed; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.strictEqual(recognizers[1].stopped, true, 'recognition error should stop recognizer');
  assert.strictEqual(sourceTrack.stopped, true, 'recognition error should release source track');
  assert.strictEqual(recognitionTrack.stopped, true, 'recognition error should release recognition track');
  assert.strictEqual(contexts[1].closed, true, 'recognition error should close audio context');
  const releasedSession = await dispatch({ type: 'PANSUB_AUDIO_CAPTURE_GET_STATE' });
  assert.strictEqual(releasedSession.session, null);

  console.log('Offscreen audio runtime tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
