const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function createChromeMock() {
  const runtimeOnMessage = createEvent();
  const tabsOnRemoved = createEvent();
  const tabsOnUpdated = createEvent();
  const calls = {
    offscreenCreate: [],
    streamIds: [],
    runtimeMessages: [],
    tabMessages: [],
    popupOpens: 0,
    getContexts: 0,
    failStop: false,
    offscreenSession: null
  };
  let offscreenExists = false;

  const chrome = {
    runtime: {
      onMessage: runtimeOnMessage,
      async sendMessage(message) {
        calls.runtimeMessages.push(message);
        if (message.type === 'PANSUB_AUDIO_CAPTURE_START') {
          calls.offscreenSession = {
            sessionId: message.sessionId,
            tabId: message.tabId,
            phase: 'preparing'
          };
          return { ok: true, sessionId: message.sessionId };
        }
        if (message.type === 'PANSUB_AUDIO_CAPTURE_STOP') {
          if (calls.failStop) return { ok: false, error: 'AUDIO_STOP_FAILED' };
          const matches = !message.sessionId || calls.offscreenSession?.sessionId === message.sessionId;
          const sessionId = calls.offscreenSession?.sessionId || null;
          if (matches) calls.offscreenSession = null;
          return { ok: true, stopped: matches, sessionId };
        }
        if (message.type === 'PANSUB_AUDIO_CAPTURE_GET_STATE') {
          return { ok: true, session: calls.offscreenSession };
        }
        return { ok: true };
      },
      getURL(file) {
        return `chrome-extension://test/${file}`;
      },
      async getContexts() {
        calls.getContexts += 1;
        return offscreenExists ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : [];
      },
      openOptionsPage() {}
    },
    storage: {
      local: {
        async get() {
          return {
            pansubSettings: {
              targetLanguage: 'zh-CN',
              audioSourceLanguage: 'en-US',
              audioDisclosureAccepted: true,
              audioGoogleFallbackConsent: false
            }
          };
        }
      }
    },
    tabs: {
      onRemoved: tabsOnRemoved,
      onUpdated: tabsOnUpdated,
      async query() {
        return [{ id: 12, url: 'https://auckland.au.panopto.com/Panopto/Pages/Viewer.aspx?id=test' }];
      },
      async sendMessage(tabId, message) {
        calls.tabMessages.push({ tabId, message });
      }
    },
    offscreen: {
      async createDocument(options) {
        calls.offscreenCreate.push(options);
        offscreenExists = true;
      }
    },
    tabCapture: {
      async getMediaStreamId(options) {
        calls.streamIds.push(options);
        return 'stream-12';
      }
    },
    action: {
      async openPopup() {
        calls.popupOpens += 1;
      }
    }
  };

  return { chrome, calls };
}

function loadBackground(chrome) {
  let uuidSequence = 0;
  const context = vm.createContext({
    chrome,
    console,
    crypto: { randomUUID: () => `session-${++uuidSequence}` },
    Date,
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  context.importScripts = (...files) => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      vm.runInContext(source, context, { filename: file });
    }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context, { filename: 'background.js' });
  return context;
}

async function dispatch(chrome, message, sender = {}) {
  const listener = chrome.runtime.onMessage.listeners.at(-1);
  assert(listener, 'background should register a runtime message listener');
  return new Promise((resolve, reject) => {
    let settled = false;
    const sendResponse = (response) => {
      settled = true;
      if (response?.ok === false) reject(Object.assign(new Error(response.error), { response }));
      else resolve(response);
    };
    const keepChannel = listener(message, sender, sendResponse);
    if (keepChannel !== true && !settled) resolve(undefined);
    setTimeout(() => {
      if (!settled) reject(new Error(`No response for ${message.type}`));
    }, 100);
  });
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.minimum_chrome_version, '139');
  assert(manifest.permissions.includes('activeTab'));
  assert(manifest.permissions.includes('offscreen'));
  assert(manifest.permissions.includes('tabCapture'));

  const { chrome, calls } = createChromeMock();
  loadBackground(chrome);

  const started = await dispatch(chrome, { type: 'PANSUB_AUDIO_START' });
  assert.strictEqual(started.state.phase, 'preparing');
  assert.strictEqual(started.state.sessionId, 'session-1');
  assert.strictEqual(calls.offscreenCreate.length, 1);
  assert(calls.getContexts >= 1, 'Chrome 139 should detect offscreen documents with runtime.getContexts');
  assert.strictEqual(calls.streamIds[0].targetTabId, 12);
  const captureStart = calls.runtimeMessages.find((message) => message.type === 'PANSUB_AUDIO_CAPTURE_START');
  assert(captureStart, 'capture start should be sent to the offscreen document');
  assert.strictEqual(captureStart.streamId, 'stream-12');

  loadBackground(chrome);
  const restored = await dispatch(chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(restored.state.sessionId, 'session-1', 'worker restart should restore the offscreen session');
  await dispatch(chrome, { type: 'PANSUB_AUDIO_STOP' });
  assert.strictEqual(calls.offscreenSession, null, 'stop after worker restart should release the offscreen session');

  const restarted = await dispatch(chrome, { type: 'PANSUB_AUDIO_START' });
  assert.strictEqual(restarted.state.sessionId, 'session-1');

  await dispatch(chrome, {
    type: 'PANSUB_AUDIO_OFFSCREEN_EVENT',
    sessionId: 'session-old',
    event: 'LISTENING'
  });
  const staleState = await dispatch(chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(staleState.state.phase, 'preparing', 'stale offscreen events must be ignored');

  await dispatch(chrome, {
    type: 'PANSUB_AUDIO_OFFSCREEN_EVENT',
    sessionId: 'session-1',
    event: 'LISTENING'
  });
  const listening = await dispatch(chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(listening.state.phase, 'listening');

  await dispatch(chrome, {
    type: 'PANSUB_AUDIO_OFFSCREEN_EVENT',
    sessionId: 'session-1',
    event: 'SUBTITLE',
    sequence: 3,
    text: '数据库模式',
    final: false
  });
  assert.strictEqual(calls.tabMessages.at(-1).message.type, 'PANSUB_AUDIO_SUBTITLE');
  assert.strictEqual(calls.tabMessages.at(-1).tabId, 12);

  await dispatch(chrome, { type: 'PANSUB_AUDIO_STOP' });
  assert(calls.runtimeMessages.some((message) => message.type === 'PANSUB_AUDIO_CAPTURE_STOP'));
  const stopped = await dispatch(chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(stopped.state.phase, 'idle');

  await dispatch(chrome, {
    type: 'PANSUB_NATIVE_CAPTION_STATUS',
    hasCaptions: false,
    observedAt: 200
  }, { tab: { id: 12 } });
  const available = await dispatch(chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(available.state.phase, 'available');

  await dispatch(chrome, { type: 'PANSUB_OPEN_AUDIO_POPUP' });
  assert.strictEqual(calls.popupOpens, 1);

  const concurrent = createChromeMock();
  loadBackground(concurrent.chrome);
  await Promise.all([
    dispatch(concurrent.chrome, { type: 'PANSUB_AUDIO_START' }),
    dispatch(concurrent.chrome, { type: 'PANSUB_AUDIO_START' })
  ]);
  const concurrentState = await dispatch(concurrent.chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.strictEqual(concurrentState.state.sessionId, 'session-2');
  assert.strictEqual(concurrent.calls.offscreenSession.sessionId, 'session-2', 'latest serialized start should own capture');

  const failedStop = createChromeMock();
  loadBackground(failedStop.chrome);
  await dispatch(failedStop.chrome, { type: 'PANSUB_AUDIO_START' });
  failedStop.calls.failStop = true;
  await assert.rejects(
    () => dispatch(failedStop.chrome, { type: 'PANSUB_AUDIO_STOP' }),
    /AUDIO_STOP_FAILED/
  );
  const failedStopState = await dispatch(failedStop.chrome, { type: 'PANSUB_AUDIO_GET_STATE' });
  assert.notStrictEqual(failedStopState.state.phase, 'idle', 'failed cleanup must not report idle');

  console.log('Background audio coordinator tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
