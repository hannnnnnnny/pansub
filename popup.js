const SETTINGS_KEY = 'pansubSettings';
const DEFAULT_SETTINGS = globalThis.PANSUB_DEFAULT_SETTINGS;
const AUDIO_MESSAGES = globalThis.PANSUB_AUDIO_PROTOCOL?.messages || {
  START: 'PANSUB_AUDIO_START',
  STOP: 'PANSUB_AUDIO_STOP',
  GET_STATE: 'PANSUB_AUDIO_GET_STATE',
  STATE_CHANGED: 'PANSUB_AUDIO_STATE_CHANGED'
};

const I18N = {
  en: {
    documentTitle: 'PanSub',
    statusReady: 'Canvas / Panopto subtitles',
    statusRunning: 'PanSub is enabled',
    statusDisabled: 'Disabled',
    statusDetail: 'Translation layer is ready',
    statusDetailOff: 'Enable PanSub to resume translation',
    showSubtitles: 'Show subtitles',
    showSubtitlesHelp: 'Enable the live translation layer',
    interfaceLanguage: 'Interface',
    languageEnglish: 'English',
    languageChinese: 'Chinese',
    mode: 'Mode',
    displayBilingual: 'Bilingual',
    displayTranslation: 'Translation only',
    displayOriginal: 'Original only',
    position: 'Position',
    positionAuto: 'Auto',
    positionVideoBottom: 'Video bottom',
    positionPageBottom: 'Page bottom',
    positionFollowCaptionShort: 'Follow caption',
    positionManual: 'Manual drag',
    targetLanguage: 'Translate to',
    targetChineseSimplified: 'Simplified Chinese',
    targetChineseTraditional: 'Traditional Chinese',
    targetJapanese: 'Japanese',
    targetKorean: 'Korean',
    targetEnglish: 'English',
    openSettings: 'Open settings',
    autoSync: 'Changes sync instantly',
    audioMode: 'Audio Mode',
    audioModeBeta: 'LOCAL BETA',
    subtitleSource: 'Subtitle source',
    sourceAuto: 'Auto',
    sourceNative: 'Captions',
    sourceAudio: 'Tab audio',
    audioAvailable: 'Available',
    audioNative: 'Native',
    audioPreparingBadge: 'Preparing',
    audioListeningBadge: 'Listening',
    audioErrorBadge: 'Attention',
    audioStoppingBadge: 'Stopping',
    audioNoCaptions: 'No native captions detected',
    audioReady: 'Audio Mode is ready',
    audioReadyDetail: 'Start only when you want PanSub to listen.',
    audioPreparing: 'Preparing local recognition',
    audioPreparingDetail: 'Chrome is checking its on-device English language pack.',
    audioListening: 'Listening to this tab',
    audioListeningDetail: 'Speech recognition is running locally.',
    audioStopping: 'Stopping Audio Mode',
    audioStoppingDetail: 'Releasing the captured tab audio.',
    audioError: 'Audio Mode needs attention',
    audioPermissionDenied: 'Tab audio permission was not granted.',
    audioStart: 'Start listening',
    audioStop: 'Stop listening',
    audioDisclosureTitle: 'Before Audio Mode starts',
    audioDisclosureBody: "PanSub captures audio only from the tab you explicitly start. Chrome performs English speech recognition on this device. PanSub does not save the audio or a transcript. If Chrome's local Translator is unavailable, recognized text is sent to Google Translate only after you separately allow that fallback.",
    audioDisclosureAccept: 'I understand and want to continue',
    googleFallbackTitle: 'Local translation is unavailable',
    googleFallbackBody: 'Audio stays on this device, but recognized text must be sent to Google Translate to show translated subtitles.',
    googleFallbackAccept: 'Allow this text-only fallback',
    cancel: 'Cancel',
    continue: 'Continue',
    decline: 'Decline',
    allowRetry: 'Allow and retry'
  },
  'zh-CN': {
    documentTitle: 'PanSub',
    statusReady: 'Canvas / Panopto 字幕',
    statusRunning: 'PanSub 已启用',
    statusDisabled: '已关闭',
    statusDetail: '实时翻译字幕层已就绪',
    statusDetailOff: '开启 PanSub 后恢复翻译',
    showSubtitles: '显示字幕',
    showSubtitlesHelp: '开启实时翻译字幕层',
    interfaceLanguage: '界面',
    languageEnglish: 'English',
    languageChinese: '中文',
    mode: '模式',
    displayBilingual: '双语',
    displayTranslation: '仅译文',
    displayOriginal: '仅原文',
    position: '位置',
    positionAuto: '自动',
    positionVideoBottom: '视频底部',
    positionPageBottom: '页面底部',
    positionFollowCaptionShort: '跟随字幕',
    positionManual: '手动拖动',
    targetLanguage: '翻译为',
    targetChineseSimplified: '简体中文',
    targetChineseTraditional: '繁体中文',
    targetJapanese: '日语',
    targetKorean: '韩语',
    targetEnglish: '英语',
    openSettings: '打开设置',
    autoSync: '更改会立即同步',
    audioMode: '音频模式',
    audioModeBeta: '本地测试版',
    subtitleSource: '字幕来源',
    sourceAuto: '自动',
    sourceNative: '原生字幕',
    sourceAudio: '标签音频',
    audioAvailable: '可使用',
    audioNative: '原生字幕',
    audioPreparingBadge: '准备中',
    audioListeningBadge: '识别中',
    audioErrorBadge: '需处理',
    audioStoppingBadge: '停止中',
    audioNoCaptions: '未检测到原生字幕',
    audioReady: '音频模式已就绪',
    audioReadyDetail: '只有你主动启动后，PanSub 才会监听。',
    audioPreparing: '正在准备本地识别',
    audioPreparingDetail: 'Chrome 正在检查设备上的英语语言包。',
    audioListening: '正在识别此标签页',
    audioListeningDetail: '语音识别只在此设备本地运行。',
    audioStopping: '正在停止音频模式',
    audioStoppingDetail: '正在释放标签页音频。',
    audioError: '音频模式需要处理',
    audioPermissionDenied: '未获得标签页音频权限。',
    audioStart: '开始识别',
    audioStop: '停止识别',
    audioDisclosureTitle: '启动音频模式前',
    audioDisclosureBody: 'PanSub 只捕获你主动启动的标签页音频。Chrome 在本设备完成英语语音识别，PanSub 不保存音频或完整转录。如果 Chrome 本地 Translator 不可用，只有在你另行允许后，识别出的文字才会发送到 Google Translate。',
    audioDisclosureAccept: '我已了解并希望继续',
    googleFallbackTitle: '本地翻译暂不可用',
    googleFallbackBody: '音频仍留在本机，但识别出的文字需要发送到 Google Translate 才能显示译文。',
    googleFallbackAccept: '允许仅发送识别文字',
    cancel: '取消',
    continue: '继续',
    decline: '不同意',
    allowRetry: '允许并重试'
  }
};

const enabled = document.getElementById('enabled');
const interfaceLanguage = document.getElementById('interfaceLanguage');
const displayMode = document.getElementById('displayMode');
const targetLanguage = document.getElementById('targetLanguage');
const subtitlePosition = document.getElementById('subtitlePosition');
const status = document.getElementById('status');
const statusDetail = document.getElementById('statusDetail');
const statusPanel = document.querySelector('.status-panel');
const openOptions = document.getElementById('openOptions');
const audioMode = document.querySelector('.audio-mode');
const audioStateBadge = document.getElementById('audioStateBadge');
const audioStatus = document.getElementById('audioStatus');
const audioDetail = document.getElementById('audioDetail');
const audioStart = document.getElementById('audioStart');
const audioStop = document.getElementById('audioStop');
const audioDisclosure = document.getElementById('audioDisclosure');
const audioDisclosureAccepted = document.getElementById('audioDisclosureAccepted');
const audioConfirmStart = document.getElementById('audioConfirmStart');
const audioCancelStart = document.getElementById('audioCancelStart');
const audioGoogleFallback = document.getElementById('audioGoogleFallback');
const audioGoogleFallbackAccepted = document.getElementById('audioGoogleFallbackAccepted');
const audioConfirmFallback = document.getElementById('audioConfirmFallback');
const audioDeclineFallback = document.getElementById('audioDeclineFallback');

let settings = { ...DEFAULT_SETTINGS };
let audioState = {
  phase: 'idle',
  sessionId: null,
  tabId: null,
  source: 'auto',
  error: null,
  detail: null,
  updatedAt: 0
};
let disclosureOpen = false;

function storageErrorMessage() {
  return chrome.runtime?.lastError?.message || '';
}

function currentLanguage() {
  return settings.interfaceLanguage === 'zh-CN' ? 'zh-CN' : 'en';
}

function text(key) {
  const language = currentLanguage();
  return I18N[language][key] || I18N.en[key] || key;
}

function applyTranslations() {
  const language = currentLanguage();
  document.documentElement.lang = language;
  document.title = text('documentTitle');
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = text(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', text(element.dataset.i18nAria));
  });
}

function runtimeRequest(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = storageErrorMessage();
      if (error) {
        reject(new Error(error));
        return;
      }
      if (response?.ok === false) {
        reject(Object.assign(new Error(response.error), { code: response.error }));
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

function persistSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      pansubEnabled: settings.enabled
    }, () => {
      const error = storageErrorMessage();
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}

function renderAudioState() {
  const phase = audioState.phase;
  const active = ['permission', 'preparing', 'listening', 'degraded', 'stopping'].includes(phase);
  const stateCopy = {
    native: ['audioNative', 'audioReady', 'audioReadyDetail'],
    available: ['audioAvailable', 'audioNoCaptions', 'audioReadyDetail'],
    permission: ['audioPreparingBadge', 'audioPreparing', 'audioPreparingDetail'],
    preparing: ['audioPreparingBadge', 'audioPreparing', 'audioPreparingDetail'],
    listening: ['audioListeningBadge', 'audioListening', 'audioListeningDetail'],
    degraded: ['audioPreparingBadge', 'audioPreparing', 'audioPreparingDetail'],
    stopping: ['audioStoppingBadge', 'audioStopping', 'audioStoppingDetail'],
    error: ['audioErrorBadge', 'audioError', 'audioReadyDetail'],
    idle: ['audioAvailable', 'audioReady', 'audioReadyDetail']
  }[phase] || ['audioAvailable', 'audioReady', 'audioReadyDetail'];

  audioMode.dataset.phase = phase;
  audioStateBadge.textContent = text(stateCopy[0]);
  audioStatus.textContent = text(stateCopy[1]);
  audioDetail.textContent = phase === 'error' && audioState.error === 'PERMISSION_DENIED'
    ? text('audioPermissionDenied')
    : text(stateCopy[2]);
  audioStart.hidden = active;
  audioStop.hidden = !active;

  if (phase === 'error' && audioState.error === 'GOOGLE_CONSENT_REQUIRED') {
    audioGoogleFallback.hidden = false;
  } else if (phase !== 'error') {
    audioGoogleFallback.hidden = true;
  }

  const audioTopState = ['permission', 'preparing', 'listening', 'degraded', 'stopping', 'error'].includes(phase);
  status.textContent = audioTopState ? text(stateCopy[1]) : (settings.enabled ? text('statusRunning') : text('statusDisabled'));
  statusDetail.textContent = audioTopState ? text(stateCopy[2]) : (settings.enabled ? text('statusDetail') : text('statusDetailOff'));
  statusPanel.classList.toggle('is-off', !settings.enabled);
}

function render() {
  enabled.checked = settings.enabled;
  interfaceLanguage.value = settings.interfaceLanguage;
  displayMode.value = settings.displayMode;
  targetLanguage.value = settings.targetLanguage;
  subtitlePosition.value = settings.subtitlePosition;
  document.querySelectorAll('input[name="subtitleSource"]').forEach((input) => {
    input.checked = input.value === settings.subtitleSource;
  });
  applyTranslations();
  renderAudioState();
  audioDisclosure.hidden = !disclosureOpen;
  audioConfirmStart.disabled = !audioDisclosureAccepted.checked;
  audioConfirmFallback.disabled = !audioGoogleFallbackAccepted.checked;
  document.body.classList.remove('is-loading');
}

function save() {
  settings = {
    ...settings,
    enabled: enabled.checked,
    interfaceLanguage: interfaceLanguage.value,
    displayMode: displayMode.value,
    targetLanguage: targetLanguage.value,
    subtitlePosition: subtitlePosition.value
  };
  persistSettings().then(render).catch((error) => {
    console.warn('[PanSub] popup save failed:', error.message);
  });
}

async function requestAndStart() {
  settings = { ...settings, subtitleSource: 'audio' };
  await persistSettings();
  try {
    const response = await runtimeRequest({ type: AUDIO_MESSAGES.START });
    if (response.state) audioState = response.state;
  } catch (error) {
    audioState = { ...audioState, phase: 'error', source: 'audio', error: error.code || error.message };
  }
  disclosureOpen = false;
  render();
}

audioStart.addEventListener('click', () => {
  if (!settings.audioDisclosureAccepted) {
    disclosureOpen = true;
    render();
    audioDisclosureAccepted.focus();
    return;
  }
  void requestAndStart();
});

audioDisclosureAccepted.addEventListener('change', () => {
  audioConfirmStart.disabled = !audioDisclosureAccepted.checked;
});

audioConfirmStart.addEventListener('click', () => {
  if (!audioDisclosureAccepted.checked) return;
  settings = { ...settings, audioDisclosureAccepted: true };
  void requestAndStart();
});

audioCancelStart.addEventListener('click', () => {
  disclosureOpen = false;
  audioDisclosureAccepted.checked = false;
  render();
  audioStart.focus();
});

audioStop.addEventListener('click', async () => {
  audioState = { ...audioState, phase: 'stopping' };
  render();
  try {
    const response = await runtimeRequest({ type: AUDIO_MESSAGES.STOP });
    if (response.state) audioState = response.state;
  } catch (error) {
    audioState = { ...audioState, phase: 'error', error: error.message };
  }
  render();
});

audioGoogleFallbackAccepted.addEventListener('change', () => {
  audioConfirmFallback.disabled = !audioGoogleFallbackAccepted.checked;
});

audioConfirmFallback.addEventListener('click', () => {
  if (!audioGoogleFallbackAccepted.checked) return;
  settings = {
    ...settings,
    audioDisclosureAccepted: true,
    audioGoogleFallbackConsent: true
  };
  audioGoogleFallback.hidden = true;
  void requestAndStart();
});

audioDeclineFallback.addEventListener('click', () => {
  audioGoogleFallback.hidden = true;
  audioGoogleFallbackAccepted.checked = false;
  void runtimeRequest({ type: AUDIO_MESSAGES.STOP }).catch(() => {});
  audioState = { ...audioState, phase: 'available', source: 'auto', sessionId: null, error: null };
  render();
});

document.querySelectorAll('input[name="subtitleSource"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    settings = { ...settings, subtitleSource: input.value };
    void persistSettings();
    if (input.value !== 'audio' && audioState.source === 'audio' && audioState.sessionId) {
      void runtimeRequest({ type: AUDIO_MESSAGES.STOP }).catch(() => {});
    }
  });
});

enabled.addEventListener('change', save);
interfaceLanguage.addEventListener('change', save);
displayMode.addEventListener('change', save);
targetLanguage.addEventListener('change', save);
subtitlePosition.addEventListener('change', save);

openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage(() => {
    const message = storageErrorMessage();
    if (message) chrome.runtime.sendMessage?.({ type: 'PANSUB_OPEN_OPTIONS' });
  });
});

chrome.runtime.onMessage?.addListener((message) => {
  if (message?.type !== AUDIO_MESSAGES.STATE_CHANGED || !message.state) return false;
  audioState = message.state;
  render();
  return false;
});

chrome.storage.local.get([SETTINGS_KEY, 'pansubEnabled'], (result) => {
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (typeof result.pansubEnabled === 'boolean') settings.enabled = result.pansubEnabled;
  render();
  runtimeRequest({ type: AUDIO_MESSAGES.GET_STATE })
    .then((response) => {
      if (response.state) audioState = response.state;
      render();
    })
    .catch(() => render());
});
