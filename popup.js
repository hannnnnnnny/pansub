const SETTINGS_KEY = 'pansubSettings';
const DEFAULT_SETTINGS = globalThis.PANSUB_DEFAULT_SETTINGS;

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
    autoSync: 'Changes sync instantly'
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
    autoSync: '更改会立即同步'
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

let settings = { ...DEFAULT_SETTINGS };

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

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = text(el.dataset.i18n);
  });
}

function render() {
  enabled.checked = settings.enabled;
  interfaceLanguage.value = settings.interfaceLanguage;
  displayMode.value = settings.displayMode;
  targetLanguage.value = settings.targetLanguage;
  subtitlePosition.value = settings.subtitlePosition;
  applyTranslations();
  status.textContent = settings.enabled ? text('statusRunning') : text('statusDisabled');
  statusDetail.textContent = settings.enabled ? text('statusDetail') : text('statusDetailOff');
  statusPanel.classList.toggle('is-off', !settings.enabled);
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
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, () => {
    const message = storageErrorMessage();
    if (message) {
      console.warn('[PanSub] popup save failed:', message);
      return;
    }
    render();
  });
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
targetLanguage.addEventListener('change', save);
subtitlePosition.addEventListener('change', save);

openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage(() => {
    const message = storageErrorMessage();
    if (message) {
      chrome.runtime.sendMessage?.({ type: 'PANSUB_OPEN_OPTIONS' });
    }
  });
});
