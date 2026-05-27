const SETTINGS_KEY = 'pansubSettings';
const DEFAULT_INTERFACE_LANGUAGE = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

const DEFAULT_SETTINGS = {
  enabled: true,
  interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual',
  subtitlePosition: 'auto',
  fontSize: 24,
  originalFontSize: 15,
  maxWidth: 80,
  backgroundOpacity: 76,
  overlayTheme: 'classic',
  overlayFontFamily: 'system',
  subtitleColor: '#ffffff',
  originalColor: '#dbeafe',
  overlayBackgroundColor: '#000000',
  overlayBorderColor: '#ffffff',
  overlayLocked: false,
  overlayManualX: null,
  overlayManualY: null,
  hideNativeCaptions: false,
  glossaryEnabled: true,
  cacheEnabled: true,
  debugLogs: true,
  floatingButtonEnabled: true,
  floatingButtonSide: 'right',
  floatingButtonOpacity: 78,
  floatingButtonHoverOnly: false,
  floatingButtonX: null,
  floatingButtonY: null,
  floatingButtonSmall: false,
  floatingButtonDisabledHosts: []
};

const I18N = {
  en: {
    documentTitle: 'PanSub',
    statusReady: 'Canvas / Panopto subtitles',
    statusRunning: 'Running on Panopto pages',
    statusDisabled: 'Disabled',
    showSubtitles: 'Show subtitles',
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
    openSettings: 'Open settings'
  },
  'zh-CN': {
    documentTitle: 'PanSub',
    statusReady: 'Canvas / Panopto 字幕',
    statusRunning: '已在 Panopto 页面启用',
    statusDisabled: '已关闭',
    showSubtitles: '显示字幕',
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
    openSettings: '打开设置'
  }
};

const enabled = document.getElementById('enabled');
const interfaceLanguage = document.getElementById('interfaceLanguage');
const displayMode = document.getElementById('displayMode');
const subtitlePosition = document.getElementById('subtitlePosition');
const status = document.getElementById('status');
const openOptions = document.getElementById('openOptions');

let settings = { ...DEFAULT_SETTINGS };

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

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = text(el.dataset.i18n);
  });
}

function render() {
  enabled.checked = settings.enabled;
  interfaceLanguage.value = settings.interfaceLanguage;
  displayMode.value = settings.displayMode;
  subtitlePosition.value = settings.subtitlePosition;
  applyTranslations();
  status.textContent = settings.enabled ? text('statusRunning') : text('statusDisabled');
}

function save() {
  settings = {
    ...settings,
    enabled: enabled.checked,
    interfaceLanguage: interfaceLanguage.value,
    displayMode: displayMode.value,
    subtitlePosition: subtitlePosition.value
  };
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, render);
}

chrome.storage.local.get([SETTINGS_KEY, 'pansubEnabled'], (result) => {
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (typeof result.pansubEnabled === 'boolean') {
    settings.enabled = result.pansubEnabled;
  }
  render();
});

enabled.addEventListener('change', save);
interfaceLanguage.addEventListener('change', save);
displayMode.addEventListener('change', save);
subtitlePosition.addEventListener('change', save);

openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
