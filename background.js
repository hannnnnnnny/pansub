importScripts('audio-mode-protocol.js', 'audio-mode-state.js');

const { messages } = globalThis.PANSUB_AUDIO_PROTOCOL;
const { createAudioState, reduceAudioState } = globalThis.PANSUB_AUDIO_STATE;
const SETTINGS_KEY = 'pansubSettings';
const OFFSCREEN_PATH = 'offscreen.html';
const PANOPTO_URL = /^https:\/\/[^/]*panopto\.com\//i;

let activeState = createAudioState();
const captionStatusByTab = new Map();
let creatingOffscreen = null;
let sessionTransition = Promise.resolve();

function errorCode(error) {
  return error?.code || error?.message || String(error || 'UNKNOWN_AUDIO_ERROR');
}

async function sendRuntimeMessage(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // It is valid for no popup or extension page to be listening.
  }
}

async function requestRuntimeMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.ok === false) {
    const error = new Error(response?.error || 'AUDIO_RUNTIME_UNAVAILABLE');
    error.code = response?.error || 'AUDIO_RUNTIME_UNAVAILABLE';
    throw error;
  }
  return response;
}

function runSessionTransition(operation) {
  const result = sessionTransition.then(operation, operation);
  sessionTransition = result.catch(() => {});
  return result;
}

async function sendTabMessage(tabId, message) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // The target may be navigating or may not have the content script yet.
  }
}

async function broadcastState(state = activeState) {
  const message = { type: messages.STATE_CHANGED, state };
  await Promise.all([
    sendRuntimeMessage(message),
    sendTabMessage(state.tabId, message)
  ]);
}

async function hasOffscreenDocument() {
  if (typeof chrome.offscreen.hasDocument === 'function') {
    return chrome.offscreen.hasDocument();
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Capture the user-selected Panopto tab and run local speech recognition.'
    }).finally(() => {
      creatingOffscreen = null;
    });
  }
  await creatingOffscreen;
}

function restoreRemoteState(remote) {
  if (!remote?.sessionId || !Number.isInteger(remote.tabId)) return null;
  let restored = reduceAudioState(createAudioState(), {
    type: 'START_REQUESTED',
    sessionId: remote.sessionId,
    tabId: remote.tabId,
    now: Date.now()
  });
  const restoreEvent = {
    listening: 'LISTENING',
    degraded: 'DEGRADED',
    preparing: 'CAPTURE_READY'
  }[remote.phase] || 'CAPTURE_READY';
  restored = reduceAudioState(restored, {
    type: restoreEvent,
    sessionId: remote.sessionId,
    detail: remote.detail,
    now: Date.now()
  });
  return restored;
}

async function synchronizeOffscreenState() {
  if (activeState.sessionId || !(await hasOffscreenDocument())) return activeState;
  const response = await requestRuntimeMessage({ type: messages.CAPTURE_GET_STATE });
  const restored = restoreRemoteState(response.session);
  if (restored) activeState = restored;
  return activeState;
}

async function loadAudioSettings() {
  const result = await chrome.storage.local.get([SETTINGS_KEY]);
  const stored = result?.[SETTINGS_KEY] || {};
  return {
    sourceLanguage: stored.audioSourceLanguage || 'en-US',
    targetLanguage: stored.targetLanguage || 'zh-CN',
    disclosureAccepted: stored.audioDisclosureAccepted === true,
    allowGoogleFallback: stored.audioGoogleFallbackConsent === true,
    glossaryEnabled: stored.glossaryEnabled !== false
  };
}

async function stopActiveSession(reason = 'user') {
  await synchronizeOffscreenState();
  if (!activeState.sessionId) return activeState;
  const sessionId = activeState.sessionId;
  const tabId = activeState.tabId;
  activeState = reduceAudioState(activeState, {
    type: 'STOP_REQUESTED',
    sessionId,
    now: Date.now()
  });
  await broadcastState(activeState);
  try {
    const response = await requestRuntimeMessage({
      type: messages.CAPTURE_STOP,
      sessionId,
      reason
    });
    if (response.stopped === false && response.sessionId && response.sessionId !== sessionId) {
      const error = new Error('AUDIO_SESSION_MISMATCH');
      error.code = 'AUDIO_SESSION_MISMATCH';
      throw error;
    }
  } catch (error) {
    activeState = reduceAudioState(activeState, {
      type: 'ERROR',
      sessionId,
      error: errorCode(error),
      now: Date.now()
    });
    await broadcastState(activeState);
    throw error;
  }
  activeState = createAudioState(Date.now());
  const caption = captionStatusByTab.get(tabId);
  if (caption) {
    activeState = reduceAudioState(activeState, {
      type: 'CAPTION_STATUS',
      hasCaptions: caption.hasCaptions,
      now: caption.observedAt
    });
  }
  await broadcastState({ ...activeState, tabId });
  return activeState;
}

async function activePanoptoTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !PANOPTO_URL.test(tab.url || '')) {
    const error = new Error('PANOPTO_TAB_REQUIRED');
    error.code = 'PANOPTO_TAB_REQUIRED';
    throw error;
  }
  return tab;
}

async function startAudioMode() {
  const tab = await activePanoptoTab();
  const settings = await loadAudioSettings();
  if (!settings.disclosureAccepted) {
    const error = new Error('AUDIO_DISCLOSURE_REQUIRED');
    error.code = 'AUDIO_DISCLOSURE_REQUIRED';
    throw error;
  }

  await stopActiveSession('replaced');
  const sessionId = crypto.randomUUID();
  activeState = reduceAudioState(createAudioState(), {
    type: 'START_REQUESTED',
    sessionId,
    tabId: tab.id,
    now: Date.now()
  });
  await broadcastState(activeState);

  try {
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    activeState = reduceAudioState(activeState, {
      type: 'CAPTURE_READY',
      sessionId,
      now: Date.now()
    });
    const response = await requestRuntimeMessage({
      type: messages.CAPTURE_START,
      sessionId,
      tabId: tab.id,
      streamId,
      settings
    });
    if (response.sessionId && response.sessionId !== sessionId) {
      const error = new Error('AUDIO_SESSION_MISMATCH');
      error.code = 'AUDIO_SESSION_MISMATCH';
      throw error;
    }
    await broadcastState(activeState);
    return activeState;
  } catch (error) {
    activeState = reduceAudioState(activeState, {
      type: 'ERROR',
      sessionId,
      error: errorCode(error),
      now: Date.now()
    });
    await broadcastState(activeState);
    throw error;
  }
}

async function handleOffscreenEvent(message) {
  if (!activeState.sessionId || message.sessionId !== activeState.sessionId) return activeState;

  if (message.event === 'SUBTITLE') {
    await sendTabMessage(activeState.tabId, {
      type: messages.SUBTITLE,
      sessionId: message.sessionId,
      sequence: message.sequence,
      text: message.text,
      final: message.final === true
    });
    return activeState;
  }

  const eventMap = {
    PREPARING: 'CAPTURE_READY',
    LISTENING: 'LISTENING',
    DEGRADED: 'DEGRADED',
    ERROR: 'ERROR',
    STOPPED: 'STOPPED'
  };
  const type = eventMap[message.event];
  if (!type) return activeState;
  activeState = reduceAudioState(activeState, {
    type,
    sessionId: message.sessionId,
    error: message.error,
    detail: message.detail,
    now: Date.now()
  });
  await broadcastState(activeState);
  return activeState;
}

async function handleCaptionStatus(message, sender) {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) return activeState;
  const captionStatus = {
    hasCaptions: message.hasCaptions === true,
    observedAt: Number.isFinite(message.observedAt) ? message.observedAt : Date.now()
  };
  captionStatusByTab.set(tabId, captionStatus);
  if (!activeState.sessionId) {
    activeState = reduceAudioState(createAudioState(), {
      type: 'CAPTION_STATUS',
      ...captionStatus
    });
    activeState = Object.freeze({ ...activeState, tabId });
    await broadcastState(activeState);
  }
  return activeState;
}

async function routeMessage(message, sender) {
  switch (message?.type) {
    case 'PANSUB_OPEN_OPTIONS':
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    case messages.START:
      return { ok: true, state: await runSessionTransition(startAudioMode) };
    case messages.STOP:
      return { ok: true, state: await runSessionTransition(() => stopActiveSession('user')) };
    case messages.GET_STATE:
      await synchronizeOffscreenState();
      return { ok: true, state: activeState };
    case messages.OFFSCREEN_EVENT:
      await synchronizeOffscreenState();
      return { ok: true, state: await handleOffscreenEvent(message) };
    case messages.NATIVE_CAPTION_STATUS:
      return { ok: true, state: await handleCaptionStatus(message, sender) };
    case messages.OPEN_AUDIO_POPUP:
      await chrome.action.openPopup();
      return { ok: true };
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const knownMessage = message?.type === 'PANSUB_OPEN_OPTIONS'
    || Object.values(messages).includes(message?.type);
  if (!knownMessage || [messages.CAPTURE_START, messages.CAPTURE_STOP, messages.CAPTURE_GET_STATE].includes(message?.type)) {
    return false;
  }
  routeMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: errorCode(error) }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  captionStatusByTab.delete(tabId);
  if (activeState.tabId === tabId) void runSessionTransition(() => stopActiveSession('tab-closed'));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (activeState.tabId !== tabId || !changeInfo.url) return;
  if (!PANOPTO_URL.test(changeInfo.url)) void runSessionTransition(() => stopActiveSession('navigation'));
});
