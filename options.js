const SETTINGS_KEY = 'pansubSettings';
const CACHE_KEY = 'pansubCache';
const DEFAULT_SETTINGS = globalThis.PANSUB_DEFAULT_SETTINGS;

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
    pageSummary: 'Tune the translation layer without interrupting your lecture.',
    signalReady: 'Lecture signal ready',
    signalReadyHelp: 'Settings sync automatically',
    findSetting: 'Find a setting',
    searchSettings: 'Search settings',
    searchSettingsPlaceholder: 'Search settings...',
    jumpToSetting: 'Jump to setting',
    noSettingsFound: 'No matching settings',
    navigate: 'Navigate',
    open: 'Open',
    livePreviewLabel: 'LIVE PREVIEW',
    previewRendering: 'Preview rendering',
    draggable: 'DRAGGABLE',
    autoSaveFooter: 'Changes save automatically',
    reset: 'Reset',
    resetConfirm: 'Reset all PanSub settings to their defaults?',
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
    resetSubtitlePosition: 'Reset subtitle box position',
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
    clearTranslationCache: 'Clear translation cache',
    audioSettingsTitle: 'Audio recognition',
    audioSettingsDescription: 'Used only when you explicitly start Audio Mode from the popup.',
    audioSourceLanguage: 'Spoken English',
    audioSourceLanguageHelp: "Choose the lecturer's closest accent for better recognition.",
    audioEnglishUS: 'English (United States)',
    audioEnglishGB: 'English (United Kingdom)',
    audioEnglishAU: 'English (Australia)',
    audioEnglishNZ: 'English (New Zealand)',
    audioEnglishCA: 'English (Canada)',
    audioPrivacyTitle: 'Local by default',
    audioPrivacyDescription: 'Chrome recognizes tab audio on this device. PanSub does not save audio or transcripts. Google receives recognized text only after separate consent.',
    resetAudioConsent: 'Revoke Audio Mode permissions',
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
    saved: 'Saved',
    saveFailed: 'Could not save. Please try again.'
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
    pageSummary: '无需中断课程，即可调整翻译字幕层。',
    signalReady: '课程字幕信号已就绪',
    signalReadyHelp: '设置会自动同步',
    findSetting: '查找设置',
    searchSettings: '搜索设置',
    searchSettingsPlaceholder: '搜索设置...',
    jumpToSetting: '跳转到设置',
    noSettingsFound: '没有匹配的设置',
    navigate: '选择',
    open: '打开',
    livePreviewLabel: '实时预览',
    previewRendering: '预览正在同步',
    draggable: '可拖动',
    autoSaveFooter: '更改会自动保存',
    reset: '重置',
    resetConfirm: '确定要把所有 PanSub 设置恢复为默认值吗？',
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
    resetSubtitlePosition: '重置字幕框位置',
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
    clearTranslationCache: '清空翻译缓存',
    audioSettingsTitle: '音频识别',
    audioSettingsDescription: '只有你从弹窗主动启动音频模式后才会使用。',
    audioSourceLanguage: '英语口音',
    audioSourceLanguageHelp: '选择最接近讲师口音的语言，提高识别准确率。',
    audioEnglishUS: '英语（美国）',
    audioEnglishGB: '英语（英国）',
    audioEnglishAU: '英语（澳大利亚）',
    audioEnglishNZ: '英语（新西兰）',
    audioEnglishCA: '英语（加拿大）',
    audioPrivacyTitle: '默认在本地处理',
    audioPrivacyDescription: 'Chrome 在本设备识别标签页音频。PanSub 不保存音频或转录；只有你另行同意后，识别文字才会发送给 Google。',
    resetAudioConsent: '撤销音频模式授权',
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
    saved: '已保存',
    saveFailed: '保存失败，请重试。'
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
  audioSourceLanguage: document.getElementById('audioSourceLanguage'),
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
let toastTimer = null;
const toast = document.getElementById('saved');
const toastMessage = toast?.querySelector('[data-i18n]');
const disabledHostsInput = document.getElementById('floatingButtonDisabledHosts');

function storageErrorMessage() {
  return chrome.runtime?.lastError?.message || '';
}

function saveToStorage(payload, callback = showSaved) {
  chrome.storage.local.set(payload, () => {
    const message = storageErrorMessage();
    if (message) {
      console.warn('[PanSub] settings save failed:', message);
      showToast('saveFailed', true);
      return;
    }
    callback?.();
  });
}

function removeFromStorage(key, callback = showSaved) {
  chrome.storage.local.remove(key, () => {
    const message = storageErrorMessage();
    if (message) {
      console.warn('[PanSub] storage remove failed:', message);
      showToast('saveFailed', true);
      return;
    }
    callback?.();
  });
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
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = text(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', text(el.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', text(el.dataset.i18nPlaceholder));
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
  renderPreview();
  renderStatus();
  document.body.classList.remove('is-loading');
}

function renderOutputs() {
  outputs.fontSize.textContent = `${settings.fontSize}px`;
  outputs.originalFontSize.textContent = `${settings.originalFontSize}px`;
  outputs.maxWidth.textContent = `${settings.maxWidth}%`;
  outputs.backgroundOpacity.textContent = `${settings.backgroundOpacity}%`;
  outputs.floatingButtonOpacity.textContent = `${settings.floatingButtonOpacity}%`;
}

function hexToRgba(color, alpha) {
  const value = String(color || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(0, 0, 0, ${alpha})`;
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function renderStatus() {
  const generalState = document.getElementById('generalState');
  if (!generalState) return;
  generalState.textContent = settings.enabled
    ? (currentLanguage() === 'zh-CN' ? '运行中' : 'ACTIVE')
    : (currentLanguage() === 'zh-CN' ? '已暂停' : 'PAUSED');
  generalState.classList.toggle('section-state-neutral', !settings.enabled);
}

function renderPreview() {
  const preview = document.getElementById('subtitlePreview');
  const original = document.getElementById('previewOriginal');
  const translated = document.getElementById('previewTranslation');
  const lock = document.getElementById('previewLock');
  const readout = document.getElementById('previewReadout');
  const sampleFloat = document.querySelector('.sample-float');
  if (!preview || !original || !translated) return;

  const fontFamilies = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sans: 'Arial, Helvetica, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Cascadia Mono", Consolas, monospace',
    rounded: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif'
  };
  const translations = {
    'zh-CN': '主键用于唯一标识每一条记录。',
    'zh-TW': '主鍵用於唯一識別每一筆記錄。',
    ja: '主キーは各レコードを一意に識別します。',
    ko: '기본 키는 각 레코드를 고유하게 식별합니다.',
    en: 'A primary key uniquely identifies each record.'
  };
  const theme = settings.overlayTheme || 'classic';
  const alpha = Math.max(.2, Math.min(.95, Number(settings.backgroundOpacity) / 100));
  const themeShadows = {
    classic: '0 12px 30px rgba(0,0,0,.3)',
    glass: '0 14px 34px rgba(0,0,0,.24)',
    light: '0 12px 28px rgba(13,21,21,.16)',
    midnight: '0 14px 34px rgba(15,23,42,.28)',
    outline: 'none'
  };

  original.textContent = 'A primary key uniquely identifies each record.';
  translated.textContent = translations[settings.targetLanguage] || translations['zh-CN'];
  original.hidden = settings.displayMode === 'translation';
  translated.hidden = settings.displayMode === 'original';
  original.style.fontSize = `${Math.max(10, Number(settings.originalFontSize)) * .84}px`;
  translated.style.fontSize = `${Math.max(14, Number(settings.fontSize)) * .82}px`;
  original.style.color = settings.originalColor;
  translated.style.color = settings.subtitleColor;
  preview.style.width = `${Math.min(92, Math.max(40, Number(settings.maxWidth)))}%`;
  preview.style.fontFamily = fontFamilies[settings.overlayFontFamily] || fontFamilies.system;
  preview.style.background = theme === 'outline' ? 'transparent' : hexToRgba(settings.overlayBackgroundColor, alpha);
  preview.style.borderColor = settings.overlayBorderColor;
  preview.style.boxShadow = themeShadows[theme] || themeShadows.classic;
  preview.style.backdropFilter = theme === 'glass' ? 'blur(12px)' : 'none';
  preview.style.bottom = settings.subtitlePosition === 'page-bottom' ? '8px' : '18px';
  if (lock) {
    lock.textContent = settings.overlayLocked ? '●' : '⌁';
    lock.title = settings.overlayLocked ? 'Locked' : 'Draggable';
  }
  if (readout) {
    readout.textContent = `${String(settings.displayMode).toUpperCase()} · ${String(settings.subtitlePosition).toUpperCase()} · ${settings.fontSize}PX`;
  }
  if (sampleFloat) {
    sampleFloat.style.opacity = settings.floatingButtonHoverOnly ? Math.max(.2, settings.floatingButtonOpacity / 100) : 1;
    sampleFloat.style.transform = `scale(${settings.floatingButtonSmall ? .78 : 1})`;
  }
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
  renderPreview();
  renderStatus();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToStorage({
      [SETTINGS_KEY]: settings,
      pansubEnabled: settings.enabled
    });
  }, 150);
}

function showToast(key, isError = false) {
  if (toastTimer) clearTimeout(toastTimer);
  if (toastMessage) toastMessage.textContent = text(key);
  toast.dataset.variant = isError ? 'error' : 'success';
  const toastIcon = toast.querySelector('.toast-icon');
  if (toastIcon) toastIcon.textContent = isError ? '!' : '✓';
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), isError ? 2400 : 1200);
}

function showSaved() {
  showToast('saved');
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
  if (!window.confirm(text('resetConfirm'))) return;
  const interfaceLanguage = settings.interfaceLanguage;
  settings = { ...DEFAULT_SETTINGS, interfaceLanguage };
  render();
  saveToStorage({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  });
});

document.getElementById('resetFloatingPosition').addEventListener('click', () => {
  settings = {
    ...settings,
    floatingButtonX: null,
    floatingButtonY: null
  };
  render();
  saveToStorage({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  });
});

document.getElementById('resetSubtitlePosition').addEventListener('click', () => {
  settings = {
    ...settings,
    subtitlePosition: 'auto',
    overlayManualX: null,
    overlayManualY: null
  };
  render();
  saveToStorage({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  });
});

document.getElementById('clearDisabledSites').addEventListener('click', () => {
  settings = {
    ...settings,
    floatingButtonDisabledHosts: []
  };
  render();
  saveToStorage({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  });
});

document.getElementById('clearTranslationCache').addEventListener('click', () => {
  removeFromStorage(CACHE_KEY);
});

document.getElementById('resetAudioConsent').addEventListener('click', () => {
  settings = {
    ...settings,
    subtitleSource: 'auto',
    audioDisclosureAccepted: false,
    audioGoogleFallbackConsent: false
  };
  render();
  saveToStorage({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  });
  try {
    chrome.permissions?.remove?.({
      origins: ['https://translate.googleapis.com/*']
    }, () => {});
  } catch (_) {
    // Consent remains revoked even if Chrome has already removed the host grant.
  }
  try {
    chrome.runtime?.sendMessage?.({ type: 'PANSUB_AUDIO_STOP' }, () => void chrome.runtime.lastError);
  } catch (_) {
    // Settings remain revoked even when no Audio Mode session is running.
  }
});

const commandPalette = document.getElementById('commandPalette');
const commandSearch = document.getElementById('commandSearch');
const commandEmpty = document.getElementById('commandEmpty');
const commandButtons = Array.from(document.querySelectorAll('[data-command-target]'));
let selectedCommand = 0;

function visibleCommands() {
  return commandButtons.filter((button) => !button.hidden);
}

function selectCommand(index) {
  const visible = visibleCommands();
  if (!visible.length) return;
  selectedCommand = Math.max(0, Math.min(index, visible.length - 1));
  commandButtons.forEach((button) => button.classList.remove('is-selected'));
  visible[selectedCommand].classList.add('is-selected');
}

function filterCommands() {
  const query = String(commandSearch.value || '').trim().toLowerCase();
  commandButtons.forEach((button) => {
    button.hidden = Boolean(query) && !button.textContent.toLowerCase().includes(query);
  });
  const visible = visibleCommands();
  commandEmpty.hidden = visible.length > 0;
  selectedCommand = 0;
  selectCommand(0);
}

function openCommandPalette() {
  commandPalette.hidden = false;
  commandSearch.value = '';
  filterCommands();
  window.setTimeout(() => commandSearch.focus(), 0);
}

function closeCommandPalette() {
  commandPalette.hidden = true;
  document.getElementById('openCommand')?.focus();
}

function openCommandTarget(button) {
  const section = document.getElementById(button.dataset.commandTarget);
  closeCommandPalette();
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  section?.classList.add('is-current');
  window.setTimeout(() => section?.classList.remove('is-current'), 1100);
}

document.getElementById('openCommand')?.addEventListener('click', openCommandPalette);
document.getElementById('railCommand')?.addEventListener('click', openCommandPalette);
commandSearch?.addEventListener('input', filterCommands);
commandButtons.forEach((button) => button.addEventListener('click', () => openCommandTarget(button)));
commandPalette?.addEventListener('click', (event) => {
  if (event.target === commandPalette) closeCommandPalette();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    commandPalette.hidden ? openCommandPalette() : closeCommandPalette();
    return;
  }
  if (commandPalette.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCommandPalette();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectCommand(selectedCommand + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectCommand(selectedCommand - 1);
  } else if (event.key === 'Enter') {
    const visible = visibleCommands();
    if (visible[selectedCommand]) {
      event.preventDefault();
      openCommandTarget(visible[selectedCommand]);
    }
  }
});

const sections = Array.from(document.querySelectorAll('.group[id]'));
const sectionLinks = Array.from(document.querySelectorAll('[data-section-link]'));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const current = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!current) return;
    sectionLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.sectionLink === current.target.id));
    sections.forEach((section) => section.classList.toggle('is-current', section === current.target));
  }, { rootMargin: '-12% 0px -58% 0px', threshold: [0.08, 0.24, 0.55] });
  sections.forEach((section) => observer.observe(section));
}
