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
  debugLogs: false,
  floatingButtonEnabled: true,
  floatingButtonSide: 'right',
  floatingButtonOpacity: 78,
  floatingButtonHoverOnly: false,
  floatingButtonX: null,
  floatingButtonY: null,
  floatingButtonSmall: false,
  floatingButtonDisabledHosts: []
};

const THEME_COLOR_DEFAULTS = {
  classic: {
    subtitleColor: '#ffffff',
    originalColor: '#dbeafe',
    overlayBackgroundColor: '#000000',
    overlayBorderColor: '#ffffff'
  },
  glass: {
    subtitleColor: '#ffffff',
    originalColor: '#c7d2fe',
    overlayBackgroundColor: '#111827',
    overlayBorderColor: '#93c5fd'
  },
  light: {
    subtitleColor: '#111827',
    originalColor: '#475569',
    overlayBackgroundColor: '#ffffff',
    overlayBorderColor: '#cbd5e1'
  },
  midnight: {
    subtitleColor: '#f8fafc',
    originalColor: '#bfdbfe',
    overlayBackgroundColor: '#0f172a',
    overlayBorderColor: '#38bdf8'
  },
  outline: {
    subtitleColor: '#ffffff',
    originalColor: '#e2e8f0',
    overlayBackgroundColor: '#000000',
    overlayBorderColor: '#ffffff'
  }
};

const I18N = {
  en: {
    documentTitle: 'PanSub Settings',
    settingsSections: 'Settings sections',
    railSubtitle: 'Canvas / Panopto subtitle translator',
    navGeneral: 'General',
    navSubtitles: 'Subtitles',
    navTranslation: 'Translation',
    navFloating: 'Quick Controls',
    navDebug: 'Debug',
    eyebrow: 'Settings',
    pageTitle: 'Lecture subtitle controls',
    reset: 'Reset',
    generalTitle: 'General',
    generalDescription: 'Choose when PanSub appears on Panopto recordings.',
    interfaceLanguage: 'Interface language',
    languageEnglish: 'English',
    languageChinese: 'Chinese',
    enablePanSub: 'Enable PanSub',
    enablePanSubHelp: 'Show translated subtitles on matching Panopto pages.',
    hideNativeCaptions: 'Hide native Panopto captions',
    hideNativeCaptionsHelp: 'Use this when the original captions overlap with PanSub.',
    subtitleDisplayTitle: 'Subtitle Display',
    subtitleDisplayDescription: 'Control the overlay text, placement, and visual weight.',
    displayMode: 'Display mode',
    displayBilingual: 'Bilingual',
    displayTranslation: 'Translation only',
    displayOriginal: 'Original only',
    position: 'Position',
    positionAuto: 'Auto',
    positionVideoBottom: 'Video bottom',
    positionPageBottom: 'Page bottom',
    positionFollowCaption: 'Follow caption element',
    positionManual: 'Manual drag',
    stylePreset: 'Style preset',
    styleClassic: 'Classic dark',
    styleGlass: 'Soft glass',
    styleLight: 'Light card',
    styleMidnight: 'Midnight blue',
    styleOutline: 'Outlined',
    fontFamily: 'Font family',
    fontSystem: 'System',
    fontSans: 'Clean sans',
    fontSerif: 'Serif',
    fontMono: 'Mono',
    fontRounded: 'Rounded',
    translationColor: 'Translation color',
    originalColor: 'Original color',
    boxColor: 'Box color',
    borderColor: 'Border color',
    lockSubtitleBox: 'Lock subtitle box',
    lockSubtitleBoxHelp: 'When locked, the subtitle box keeps its position and cannot be dragged.',
    translationSize: 'Translation size',
    originalSize: 'Original size',
    overlayWidth: 'Overlay width',
    backgroundOpacity: 'Background opacity',
    translationTitle: 'Translation',
    translationDescription: 'Choose the target language and translation behavior.',
    targetLanguage: 'Target language',
    targetChineseSimplified: 'Chinese Simplified',
    targetChineseTraditional: 'Chinese Traditional',
    targetJapanese: 'Japanese',
    targetKorean: 'Korean',
    targetEnglish: 'English',
    provider: 'Provider',
    academicGlossary: 'Academic glossary',
    academicGlossaryHelp: 'Protect common academic terms across business, arts, IT, science, law, and more.',
    localCache: 'Local translation cache',
    localCacheHelp: 'Reuse translated lines during the same course recording.',
    quickButtonTitle: 'Quick Controls',
    quickButtonDescription: 'Add a draggable page-side panel for subtitle mode, language, hiding, and settings while watching.',
    samplePage: 'Panopto lecture recording',
    showQuickButton: 'Show quick button',
    showQuickButtonHelp: 'Display a draggable PanSub button on matching Panopto pages.',
    compactQuickButton: 'Compact quick button',
    compactQuickButtonHelp: 'Use a smaller button when the player area is crowded.',
    fadeUntilHover: 'Fade until hover',
    fadeUntilHoverHelp: 'Keep the button quiet until your cursor moves over it.',
    side: 'Side',
    sideRight: 'Right',
    sideLeft: 'Left',
    collapsedOpacity: 'Collapsed opacity',
    resetQuickButtonPosition: 'Reset button position',
    disabledSites: 'Sites where the button is hidden',
    disabledSitesHelp: 'One hostname per line. Remove a hostname to show the button there again.',
    clearDisabledSites: 'Clear hidden sites',
    debugTitle: 'Debug',
    debugDescription: 'Useful when Panopto changes its player markup.',
    consoleDiagnostics: 'Console diagnostics',
    consoleDiagnosticsHelp: 'Print matched caption nodes and subtitle updates.',
    debugNote: 'Open DevTools on the Panopto page and look for <code>[PanSub]</code> messages.',
    saved: 'Saved'
  },
  'zh-CN': {
    documentTitle: 'PanSub 设置',
    settingsSections: '设置分区',
    railSubtitle: 'Canvas / Panopto 字幕翻译器',
    navGeneral: '常规',
    navSubtitles: '字幕',
    navTranslation: '翻译',
    navFloating: '快捷控制',
    navDebug: '调试',
    eyebrow: '设置',
    pageTitle: '课程字幕控制',
    reset: '重置',
    generalTitle: '常规',
    generalDescription: '选择 PanSub 何时显示在 Panopto 录像页面上。',
    interfaceLanguage: '界面语言',
    languageEnglish: 'English',
    languageChinese: '中文',
    enablePanSub: '启用 PanSub',
    enablePanSubHelp: '在匹配的 Panopto 页面上显示翻译字幕。',
    hideNativeCaptions: '隐藏 Panopto 原生字幕',
    hideNativeCaptionsHelp: '当原字幕和 PanSub 重叠时可以开启。',
    subtitleDisplayTitle: '字幕显示',
    subtitleDisplayDescription: '控制字幕内容、位置和视觉样式。',
    displayMode: '显示模式',
    displayBilingual: '双语',
    displayTranslation: '仅译文',
    displayOriginal: '仅原文',
    position: '位置',
    positionAuto: '自动',
    positionVideoBottom: '视频底部',
    positionPageBottom: '页面底部',
    positionFollowCaption: '跟随字幕元素',
    positionManual: '手动拖动',
    stylePreset: '样式预设',
    styleClassic: '经典深色',
    styleGlass: '柔和玻璃',
    styleLight: '浅色卡片',
    styleMidnight: '深蓝夜间',
    styleOutline: '描边样式',
    fontFamily: '字体',
    fontSystem: '系统字体',
    fontSans: '清爽无衬线',
    fontSerif: '衬线字体',
    fontMono: '等宽字体',
    fontRounded: '圆润字体',
    translationColor: '译文颜色',
    originalColor: '原文颜色',
    boxColor: '字幕框颜色',
    borderColor: '边框颜色',
    lockSubtitleBox: '锁定字幕框',
    lockSubtitleBoxHelp: '锁定后，字幕框保持当前位置，不能再被拖动。',
    translationSize: '译文字号',
    originalSize: '原文字号',
    overlayWidth: '悬浮层宽度',
    backgroundOpacity: '背景透明度',
    translationTitle: '翻译',
    translationDescription: '选择目标语言和翻译行为。',
    targetLanguage: '目标语言',
    targetChineseSimplified: '简体中文',
    targetChineseTraditional: '繁体中文',
    targetJapanese: '日语',
    targetKorean: '韩语',
    targetEnglish: '英语',
    provider: '翻译服务',
    academicGlossary: '学术术语表',
    academicGlossaryHelp: '保护商科、艺术、IT、科学、法律等领域的常见学术术语。',
    localCache: '本地翻译缓存',
    localCacheHelp: '重复字幕会复用缓存，减少同一录像中的重复请求。',
    quickButtonTitle: '快捷控制',
    quickButtonDescription: '在页面侧边显示一个可拖动小面板，观看时快速调整字幕模式、语言、隐藏和设置。',
    samplePage: 'Panopto 课程录像',
    showQuickButton: '显示快捷按钮',
    showQuickButtonHelp: '在匹配的 Panopto 页面上显示可拖动的 PanSub 小按钮。',
    compactQuickButton: '紧凑快捷按钮',
    compactQuickButtonHelp: '播放器空间紧张时使用更小的悬浮球。',
    fadeUntilHover: '悬停前淡化',
    fadeUntilHoverHelp: '鼠标移上去之前，让按钮保持低调显示。',
    side: '位置',
    sideRight: '右侧',
    sideLeft: '左侧',
    collapsedOpacity: '收起透明度',
    resetQuickButtonPosition: '重置按钮位置',
    disabledSites: '已隐藏悬浮球的网站',
    disabledSitesHelp: '每行一个 hostname。删除某一行即可恢复该网站的悬浮球。',
    clearDisabledSites: '清空隐藏网站',
    debugTitle: '调试',
    debugDescription: '当 Panopto 更改播放器结构时用于排查问题。',
    consoleDiagnostics: '控制台诊断',
    consoleDiagnosticsHelp: '输出命中的字幕节点和字幕更新日志。',
    debugNote: '打开 Panopto 页面上的 DevTools Console，查看 <code>[PanSub]</code> 日志。',
    saved: '已保存'
  }
};

const controls = {
  enabled: document.getElementById('enabled'),
  interfaceLanguage: document.getElementById('interfaceLanguage'),
  targetLanguage: document.getElementById('targetLanguage'),
  displayMode: document.getElementById('displayMode'),
  subtitlePosition: document.getElementById('subtitlePosition'),
  fontSize: document.getElementById('fontSize'),
  originalFontSize: document.getElementById('originalFontSize'),
  maxWidth: document.getElementById('maxWidth'),
  backgroundOpacity: document.getElementById('backgroundOpacity'),
  overlayTheme: document.getElementById('overlayTheme'),
  overlayFontFamily: document.getElementById('overlayFontFamily'),
  subtitleColor: document.getElementById('subtitleColor'),
  originalColor: document.getElementById('originalColor'),
  overlayBackgroundColor: document.getElementById('overlayBackgroundColor'),
  overlayBorderColor: document.getElementById('overlayBorderColor'),
  overlayLocked: document.getElementById('overlayLocked'),
  hideNativeCaptions: document.getElementById('hideNativeCaptions'),
  glossaryEnabled: document.getElementById('glossaryEnabled'),
  cacheEnabled: document.getElementById('cacheEnabled'),
  debugLogs: document.getElementById('debugLogs'),
  floatingButtonEnabled: document.getElementById('floatingButtonEnabled'),
  floatingButtonSide: document.getElementById('floatingButtonSide'),
  floatingButtonOpacity: document.getElementById('floatingButtonOpacity'),
  floatingButtonHoverOnly: document.getElementById('floatingButtonHoverOnly'),
  floatingButtonSmall: document.getElementById('floatingButtonSmall')
};

const outputs = {
  fontSize: document.getElementById('fontSizeValue'),
  originalFontSize: document.getElementById('originalFontSizeValue'),
  maxWidth: document.getElementById('maxWidthValue'),
  backgroundOpacity: document.getElementById('backgroundOpacityValue'),
  floatingButtonOpacity: document.getElementById('floatingButtonOpacityValue')
};

let settings = { ...DEFAULT_SETTINGS };
let saveTimer = null;
const toast = document.getElementById('saved');
const disabledHostsInput = document.getElementById('floatingButtonDisabledHosts');

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
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = text(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', text(el.dataset.i18nAriaLabel));
  });
}

function render() {
  for (const [key, control] of Object.entries(controls)) {
    if (!control) continue;
    if (control.type === 'checkbox') {
      control.checked = Boolean(settings[key]);
    } else {
      control.value = settings[key];
    }
  }
  renderOutputs();
  if (disabledHostsInput) {
    disabledHostsInput.value = Array.isArray(settings.floatingButtonDisabledHosts)
      ? settings.floatingButtonDisabledHosts.join('\n')
      : '';
  }
  applyTranslations();
}

function renderOutputs() {
  outputs.fontSize.textContent = `${settings.fontSize}px`;
  outputs.originalFontSize.textContent = `${settings.originalFontSize}px`;
  outputs.maxWidth.textContent = `${settings.maxWidth}%`;
  outputs.backgroundOpacity.textContent = `${settings.backgroundOpacity}%`;
  outputs.floatingButtonOpacity.textContent = `${settings.floatingButtonOpacity}%`;
}

function renderColorControls() {
  ['subtitleColor', 'originalColor', 'overlayBackgroundColor', 'overlayBorderColor'].forEach((key) => {
    if (controls[key]) controls[key].value = settings[key];
  });
}

function readSettings() {
  const next = { ...settings };
  for (const [key, control] of Object.entries(controls)) {
    if (!control) continue;
    if (control.type === 'checkbox') {
      next[key] = control.checked;
    } else if (control.type === 'range') {
      next[key] = Number(control.value);
    } else {
      next[key] = control.value;
    }
  }
  if (disabledHostsInput) {
    next.floatingButtonDisabledHosts = disabledHostsInput.value
      .split(/\r?\n/)
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }
  return next;
}

function sameColor(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function applyThemeColors(next) {
  if (next.overlayTheme === settings.overlayTheme) return next;

  const colorKeys = ['subtitleColor', 'originalColor', 'overlayBackgroundColor', 'overlayBorderColor'];
  const previousDefaults = THEME_COLOR_DEFAULTS[settings.overlayTheme] || THEME_COLOR_DEFAULTS.classic;
  const nextDefaults = THEME_COLOR_DEFAULTS[next.overlayTheme] || THEME_COLOR_DEFAULTS.classic;
  const themed = { ...next };

  for (const key of colorKeys) {
    if (!settings[key] || sameColor(settings[key], previousDefaults[key])) {
      themed[key] = nextDefaults[key];
    }
  }
  return themed;
}

function scheduleSave() {
  const next = applyThemeColors(readSettings());
  if (next.floatingButtonSide !== settings.floatingButtonSide) {
    next.floatingButtonX = null;
    next.floatingButtonY = null;
  }
  settings = next;
  renderOutputs();
  renderColorControls();
  applyTranslations();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      pansubEnabled: settings.enabled
    }, showSaved);
  }, 150);
}

function showSaved() {
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 900);
}

chrome.storage.local.get([SETTINGS_KEY, 'pansubEnabled'], (result) => {
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (typeof result.pansubEnabled === 'boolean') {
    settings.enabled = result.pansubEnabled;
  }
  render();
});

for (const control of Object.values(controls)) {
  if (control) control.addEventListener('input', scheduleSave);
}
if (disabledHostsInput) disabledHostsInput.addEventListener('input', scheduleSave);

document.getElementById('reset').addEventListener('click', () => {
  const interfaceLanguage = settings.interfaceLanguage;
  settings = { ...DEFAULT_SETTINGS, interfaceLanguage };
  render();
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, showSaved);
});

document.getElementById('resetFloatingPosition').addEventListener('click', () => {
  settings = {
    ...settings,
    floatingButtonX: null,
    floatingButtonY: null
  };
  render();
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, showSaved);
});

document.getElementById('clearDisabledSites').addEventListener('click', () => {
  settings = {
    ...settings,
    floatingButtonDisabledHosts: []
  };
  render();
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, showSaved);
});
