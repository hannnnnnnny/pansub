(() => {
  const CAPTION_TARGETS = [
    { selector: '#overlayCaption', mode: 'overlay' },
    { selector: '#dockedCaptionText', mode: 'docked' }
  ];

  const OVERLAY_ID = 'pansub-overlay';
  const FLOATING_ID = 'pansub-floating';
  const FLOATING_PANEL_ID = 'pansub-floating-panel';
  const FLOATING_SETTINGS_ID = 'pansub-floating-settings';
  const ORIGINAL_ID = 'pansub-original';
  const TRANSLATED_ID = 'pansub-translated';
  const OVERLAY_TOOLBAR_ID = 'pansub-overlay-toolbar';
  const OVERLAY_LOCK_ID = 'pansub-overlay-lock';
  const SETTINGS_KEY = 'pansubSettings';
  const CACHE_KEY = 'pansubCache';
  const DEBOUNCE_MS = 150;
  const POLL_MS = 500;
  const CACHE_LIMIT = 2000;
  const TRANSLATE_MIN_INTERVAL_MS = 350;
  const TRANSLATE_RETRY_DELAYS = [1500, 3000, 6000];
  const POST_TEXT_LENGTH = 320;
  const MAX_GLOSSARY_MATCHES = 8;
  const FLOATING_REGULAR_SIZE = 44;
  const FLOATING_SMALL_SIZE = 34;
  const FLOATING_MARGIN = 8;
  const NATIVE_CAPTION_MISSING_MS = 5000;
  const GLOSSARY = window.PANSUB_GLOSSARY || { version: 'none', terms: [] };
  const DEFAULT_SETTINGS = window.PANSUB_DEFAULT_SETTINGS;
  const AUDIO_PROTOCOL = window.PANSUB_AUDIO_PROTOCOL;
  const AUDIO_STATE_API = window.PANSUB_AUDIO_STATE;
  const AUDIO_MESSAGES = AUDIO_PROTOCOL?.messages || {
    GET_STATE: 'PANSUB_AUDIO_GET_STATE',
    STATE_CHANGED: 'PANSUB_AUDIO_STATE_CHANGED',
    SUBTITLE: 'PANSUB_AUDIO_SUBTITLE',
    STOP: 'PANSUB_AUDIO_STOP',
    NATIVE_CAPTION_STATUS: 'PANSUB_NATIVE_CAPTION_STATUS',
    OPEN_AUDIO_POPUP: 'PANSUB_OPEN_AUDIO_POPUP'
  };

  const translationCache = new Map();
  let settings = { ...DEFAULT_SETTINGS };
  let lastText = '';
  let lastOriginalText = '';
  let lastTranslatedText = '';
  let debounceTimer = null;
  let persistTimer = null;
  let translateSeq = 0;
  let activeTranslationController = null;
  let lastTranslateAt = 0;
  let translateBackoffUntil = 0;
  let overlayEl = null;
  let floatingEl = null;
  let floatingPanelEl = null;
  let floatingSettingsEl = null;
  let floatingPanelOpen = false;
  let floatingSettingsOpen = false;
  let floatingDrag = null;
  let overlayDrag = null;
  let suppressFloatingClick = false;
  let floatingButtonSessionHidden = false;
  let activeCaption = null;
  let nativeCaptionEl = null;
  let captionPollStarted = false;
  let lastStablePlayerRect = null;
  let captionObserver = null;
  let observedCaptionEl = null;
  let audioState = AUDIO_STATE_API?.createAudioState?.() || {
    phase: 'idle',
    sessionId: null,
    tabId: null,
    source: 'auto',
    error: null,
    detail: null,
    updatedAt: 0
  };
  let lastAudioSequence = 0;
  let audioRendered = false;
  let captionDetectionStartedAt = Date.now();
  let lastNativeCaptionAt = 0;
  let lastReportedNativeStatus = null;
  let lastNativeStatusReportAt = 0;

  function debug(...args) {
    if (settings.debugLogs) console.log(...args);
  }

  function audioOwnsOverlay() {
    return audioState.source === 'audio'
      && Boolean(audioState.sessionId)
      && !['idle', 'native', 'available'].includes(audioState.phase);
  }

  function reportNativeCaptionStatus(hasCaptions) {
    const now = Date.now();
    if (lastReportedNativeStatus === hasCaptions && now - lastNativeStatusReportAt < 5000) return;
    lastReportedNativeStatus = hasCaptions;
    lastNativeStatusReportAt = now;
    chrome.runtime.sendMessage({
      type: AUDIO_MESSAGES.NATIVE_CAPTION_STATUS,
      hasCaptions,
      observedAt: now
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mergeSettings(stored, legacyEnabled) {
    settings = { ...DEFAULT_SETTINGS, ...(stored || {}) };
    if (typeof legacyEnabled === 'boolean') {
      settings.enabled = legacyEnabled;
    }
  }

  function saveSettings(callback) {
    chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      pansubEnabled: settings.enabled
    }, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        console.warn('[PanSub] failed to save settings:', error.message);
      }
      callback?.(error || null);
    });
  }

  function markNoTranslate(el, lang = '') {
    if (!el) return;
    el.setAttribute('translate', 'no');
    el.classList.add('notranslate');
    el.dataset.pansubNoTranslate = 'true';
    if (lang) el.setAttribute('lang', lang);
  }

  function markTreeNoTranslate(root, lang = '') {
    markNoTranslate(root, lang);
    root?.querySelectorAll?.('*')?.forEach((el) => markNoTranslate(el, lang));
  }

  function protectCaptionElement(el) {
    markNoTranslate(el, 'en');
    el.closest?.('[id*="caption" i], [class*="caption" i]')?.setAttribute('translate', 'no');
    el.closest?.('[id*="caption" i], [class*="caption" i]')?.classList.add('notranslate');
  }

  function hasCjk(text) {
    return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);
  }

  function hasHan(text) {
    return /[\u3400-\u9fff]/.test(text);
  }

  function hasKana(text) {
    return /[\u3040-\u30ff]/.test(text);
  }

  function hasHangul(text) {
    return /[\uac00-\ud7af]/.test(text);
  }

  function latinRatio(text) {
    const letters = text.match(/[A-Za-z]/g)?.length || 0;
    const visible = text.replace(/\s/g, '').length || 1;
    return letters / visible;
  }

  function detectedTextLanguage(text) {
    if (hasHangul(text)) return 'ko';
    if (hasKana(text)) return 'ja';
    if (hasHan(text) && latinRatio(text) < 0.4) return 'zh-CN';
    if (latinRatio(text) > 0.5) return 'en';
    return '';
  }

  function sourceAlreadyMatchesTarget(text) {
    if (!text) return false;
    if (settings.targetLanguage === 'ko') return hasHangul(text);
    if (settings.targetLanguage === 'ja') return hasKana(text);
    if (settings.targetLanguage.startsWith('zh')) {
      return hasHan(text) && !hasKana(text) && !hasHangul(text) && latinRatio(text) < 0.25;
    }
    if (settings.targetLanguage === 'en') return latinRatio(text) > 0.55 && !hasCjk(text);
    return false;
  }

  function currentHost() {
    return location.hostname.toLowerCase();
  }

  function disabledHosts() {
    return Array.isArray(settings.floatingButtonDisabledHosts)
      ? settings.floatingButtonDisabledHosts.map((host) => String(host).trim().toLowerCase()).filter(Boolean)
      : [];
  }

  function isCurrentHostDisabled() {
    const host = currentHost();
    return Boolean(host) && disabledHosts().includes(host);
  }

  function isFloatingButtonVisible() {
    return settings.floatingButtonEnabled && !floatingButtonSessionHidden && !isCurrentHostDisabled();
  }

  function fullscreenElement() {
    return document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement
      || document.msFullscreenElement
      || null;
  }

  function extensionHost() {
    const fullscreenHost = fullscreenElement();
    return fullscreenHost && typeof fullscreenHost.appendChild === 'function'
      ? fullscreenHost
      : document.body;
  }

  function mountExtensionElement(el) {
    const host = extensionHost();
    if (el && host && el.parentElement !== host) {
      host.appendChild(el);
    }
  }

  function mountExtensionElements() {
    mountExtensionElement(overlayEl);
    mountExtensionElement(floatingEl);
    mountExtensionElement(floatingPanelEl);
    mountExtensionElement(floatingSettingsEl);
    applyOverlayPosition(activeCaption);
    applyFloatingButtonStyle();
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden';
  }

  function usableRect(el) {
    if (!el || !isVisible(el)) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 120) return null;
    return rect;
  }

  function captionRect(el) {
    if (!el || !isVisible(el)) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 10) return null;
    return rect;
  }

  function viewportRect() {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function rememberPlayerRect(rect) {
    lastStablePlayerRect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
    return lastStablePlayerRect;
  }

  function playerRect() {
    const host = fullscreenElement();
    const hostRect = usableRect(host);
    if (hostRect) {
      return rememberPlayerRect(hostRect);
    }

    const selectors = [
      'video.video-js',
      '#secondaryVideo',
      '#primaryVideo',
      '#secondaryScreen',
      '#primaryScreen',
      '.screen.is-ready',
      '.player-layout-controls-container',
      '#rightPlayerContainer',
      '#leftPlayerContainer'
    ];

    const candidates = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        const rect = usableRect(el);
        if (rect) candidates.push(rect);
      });
    }

    if (candidates.length) {
      return rememberPlayerRect(candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]);
    }

    return lastStablePlayerRect || viewportRect();
  }

  function findCaptionElement() {
    for (const target of CAPTION_TARGETS) {
      const el = document.querySelector(target.selector);
      if (el && el.textContent.trim() && isVisible(el)) {
        protectCaptionElement(el);
        return { ...target, el };
      }
    }

    for (const target of CAPTION_TARGETS) {
      const el = document.querySelector(target.selector);
      if (el && isVisible(el)) {
        protectCaptionElement(el);
        return { ...target, el };
      }
    }

    const fallback = findFallbackCaptionElement();
    if (fallback) return fallback;

    return null;
  }

  function findFallbackCaptionElement() {
    const player = playerRect();
    const candidates = [];
    document.querySelectorAll('[id*="caption" i], [class*="caption" i], [aria-label*="caption" i]').forEach((el) => {
      if (el.id === OVERLAY_ID || el.closest?.(`#${OVERLAY_ID}, #${FLOATING_ID}, #${FLOATING_PANEL_ID}, #${FLOATING_SETTINGS_ID}`)) return;
      if (/^(button|select|option|input|textarea)$/i.test(el.tagName)) return;

      const text = el.textContent.trim();
      if (text.length < 2 || text.length > 420 || text.split(/\r?\n/).length > 3) return;

      const rect = captionRect(el);
      if (!rect) return;

      const horizontalOverlap = Math.min(rect.right, player.right) - Math.max(rect.left, player.left);
      const nearPlayerVertically = rect.bottom >= player.top - 24
        && rect.top <= player.bottom + Math.max(120, player.height * 0.24);
      if (!nearPlayerVertically || horizontalOverlap < Math.min(rect.width, player.width) * 0.35) return;

      const insidePlayer = rect.top >= player.top - 4 && rect.bottom <= player.bottom + 4;
      const mode = rect.top > player.bottom - 8 ? 'docked' : 'overlay';
      const bottomDistance = Math.abs(player.bottom - rect.bottom);
      candidates.push({
        el,
        mode,
        selector: 'fallback-caption',
        score: horizontalOverlap + (insidePlayer ? 120 : 0) - bottomDistance / 4
      });
    });

    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (best) {
      protectCaptionElement(best.el);
      debug('[PanSub] Found fallback caption element:', best.el);
    }
    return best || null;
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      overlayEl = document.getElementById(OVERLAY_ID);
      ensureOverlayToolbar();
      attachOverlayDragListeners();
      return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    markNoTranslate(overlayEl);

    const toolbar = createOverlayToolbar();

    const original = document.createElement('div');
    original.id = ORIGINAL_ID;
    markNoTranslate(original, 'en');

    const translated = document.createElement('div');
    translated.id = TRANSLATED_ID;
    markNoTranslate(translated);

    overlayEl.appendChild(toolbar);
    overlayEl.appendChild(original);
    overlayEl.appendChild(translated);
    extensionHost().appendChild(overlayEl);
    attachOverlayDragListeners();

    applyVisibility();
    applyOverlayStyle();
    applyOverlayPosition(activeCaption);

    if (!createOverlay._listenersAttached) {
      createOverlay._listenersAttached = true;
      window.addEventListener('resize', () => applyOverlayPosition(activeCaption));
      window.addEventListener('scroll', () => applyOverlayPosition(activeCaption), true);
    }
  }

  function createOverlayToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = OVERLAY_TOOLBAR_ID;
    toolbar.dataset.pansubPart = 'overlayToolbar';
    markNoTranslate(toolbar);

    const grip = document.createElement('span');
    grip.dataset.pansubPart = 'overlayGrip';
    grip.textContent = 'PanSub';

    const lock = document.createElement('button');
    lock.id = OVERLAY_LOCK_ID;
    lock.type = 'button';
    lock.dataset.pansubAction = 'overlayLock';
    lock.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      settings = { ...settings, overlayLocked: !settings.overlayLocked };
      saveSettings();
      updateOverlayLockButton();
      applyOverlayStyle();
    });

    toolbar.append(grip, lock);
    return toolbar;
  }

  function ensureOverlayToolbar() {
    if (!overlayEl) return;
    if (!document.getElementById(OVERLAY_TOOLBAR_ID)) {
      overlayEl.prepend(createOverlayToolbar());
    }
    updateOverlayLockButton();
  }

  function lockIcon(locked) {
    const body = locked
      ? '<rect x="7" y="10" width="10" height="8" rx="1.5"></rect><path d="M9 10V8a3 3 0 0 1 6 0v2"></path>'
      : '<rect x="7" y="10" width="10" height="8" rx="1.5"></rect><path d="M9 10V8a3 3 0 0 1 5.2-2"></path>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function updateOverlayLockButton() {
    const lock = document.getElementById(OVERLAY_LOCK_ID);
    if (!lock) return;
    const locked = Boolean(settings.overlayLocked);
    lock.innerHTML = lockIcon(locked);
    lock.title = quickCopy(locked ? 'unlockSubtitleBox' : 'lockSubtitleBox');
    lock.setAttribute('aria-label', lock.title);
    lock.setAttribute('aria-pressed', String(locked));
    lock.querySelectorAll('svg').forEach((svg) => {
      svg.style.cssText = 'width: 15px;height: 15px;fill: none;stroke: currentColor;stroke-width: 2;stroke-linecap: round;stroke-linejoin: round;';
    });
  }

  function createFloatingButton() {
    if (floatingEl && document.body.contains(floatingEl)) {
      if (!floatingPanelEl) createFloatingPanel();
      attachFloatingPanelListeners();
      attachFloatingButtonListeners();
      applyFloatingButtonStyle();
      return;
    }

    document.getElementById(FLOATING_ID)?.remove();
    document.getElementById(FLOATING_PANEL_ID)?.remove();

    floatingEl = document.createElement('button');
    floatingEl.id = FLOATING_ID;
    floatingEl.type = 'button';
    const floatingMark = document.createElement('span');
    floatingMark.dataset.pansubFloatingPart = 'mark';
    floatingMark.textContent = 'P';
    const floatingSignal = document.createElement('span');
    floatingSignal.dataset.pansubFloatingPart = 'signal';
    floatingSignal.setAttribute('aria-hidden', 'true');
    floatingEl.append(floatingMark, floatingSignal);
    markNoTranslate(floatingEl);
    floatingEl.title = quickCopy('quickControls');
    floatingEl.setAttribute('aria-label', floatingEl.title);
    floatingEl.setAttribute('aria-expanded', 'false');
    floatingEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (suppressFloatingClick) {
        suppressFloatingClick = false;
        return;
      }
      toggleFloatingPanel();
    });
    floatingEl.addEventListener('pointerdown', startFloatingDrag);
    extensionHost().appendChild(floatingEl);
    createFloatingPanel();
    attachFloatingPanelListeners();
    attachFloatingButtonListeners();
    applyFloatingButtonStyle();
  }

  function attachFloatingButtonListeners() {
    if (attachFloatingButtonListeners.attached) return;
    attachFloatingButtonListeners.attached = true;
    window.addEventListener('resize', () => {
      applyFloatingButtonStyle();
    });
  }

  function attachFullscreenListeners() {
    if (attachFullscreenListeners.attached) return;
    attachFullscreenListeners.attached = true;

    const handleFullscreenChange = () => {
      window.setTimeout(() => {
        mountExtensionElements();
        handleCaptionChange();
      }, 50);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  }

  const QUICK_COPY = {
    en: {
      title: 'PanSub',
      quickControls: 'PanSub quick controls',
      enabled: 'Enabled',
      disabled: 'Disabled',
      showSubtitles: 'Show subtitles',
      mode: 'Display mode',
      target: 'Translate to',
      settings: 'Settings',
      bilingual: 'Bilingual',
      translation: 'Translation only',
      original: 'Original only',
      zhCN: 'Simplified Chinese',
      zhTW: 'Traditional Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      enTarget: 'English',
      floatingSettings: 'Button controls',
      floatingSettingsTitle: 'Button Controls',
      close: 'Close',
      compactButton: 'Compact button',
      hideVisit: 'Hide until reload',
      hideSite: 'Hide on this site',
      disableGlobal: 'Turn off everywhere',
      resetPosition: 'Reset position',
      buttonControlsNote: 'Hidden buttons can be restored from the PanSub settings page.',
      lockSubtitleBox: 'Lock subtitle box',
      unlockSubtitleBox: 'Unlock subtitle box',
      audioAvailable: 'No native captions detected',
      audioAvailableDetail: 'Audio Mode can listen to this tab after you start it.',
      audioPreparing: 'Preparing local recognition',
      audioPreparingDetail: 'Chrome is checking the on-device English language pack.',
      audioListening: 'Listening to tab audio',
      audioListeningDetail: 'Speech recognition runs locally on this device.',
      audioDegraded: 'Recognition is recovering',
      audioDegradedDetail: 'PanSub is restarting the local recognizer.',
      audioError: 'Audio Mode needs attention',
      audioErrorDetail: 'Open PanSub to review the error and retry.',
      audioStopping: 'Stopping Audio Mode',
      audioStoppingDetail: 'Releasing the captured tab audio.',
      openAudioMode: 'Open Audio Mode',
      stopAudioMode: 'Stop listening'
    },
    'zh-CN': {
      title: 'PanSub',
      quickControls: 'PanSub 快捷控制',
      enabled: '已启用',
      disabled: '已关闭',
      showSubtitles: '显示字幕',
      mode: '显示模式',
      target: '翻译为',
      settings: '打开设置',
      bilingual: '双语',
      translation: '仅译文',
      original: '仅原文',
      zhCN: '简体中文',
      zhTW: '繁体中文',
      ja: '日语',
      ko: '韩语',
      enTarget: '英语',
      floatingSettings: '悬浮球控制',
      floatingSettingsTitle: '悬浮球控制',
      close: '关闭',
      compactButton: '紧凑悬浮球',
      hideVisit: '隐藏到刷新',
      hideSite: '此网站隐藏',
      disableGlobal: '全部页面关闭',
      resetPosition: '重置位置',
      buttonControlsNote: '隐藏后的悬浮球可以在 PanSub 设置页恢复。',
      lockSubtitleBox: '锁定字幕框',
      unlockSubtitleBox: '解锁字幕框',
      audioAvailable: '未检测到原生字幕',
      audioAvailableDetail: '你可以从插件弹窗手动启动音频模式。',
      audioPreparing: '正在准备本地识别',
      audioPreparingDetail: 'Chrome 正在检查设备上的英语语言包。',
      audioListening: '正在识别标签页音频',
      audioListeningDetail: '语音识别只在此设备本地运行。',
      audioDegraded: '识别正在恢复',
      audioDegradedDetail: 'PanSub 正在重新启动本地识别器。',
      audioError: '音频模式需要处理',
      audioErrorDetail: '打开 PanSub 查看错误并重试。',
      audioStopping: '正在停止音频模式',
      audioStoppingDetail: '正在释放标签页音频。',
      openAudioMode: '打开音频模式',
      stopAudioMode: '停止识别'
    }
  };

  function quickCopy(key) {
    const language = settings.interfaceLanguage === 'zh-CN' ? 'zh-CN' : 'en';
    return QUICK_COPY[language][key] || QUICK_COPY.en[key] || key;
  }

  function setStyles(el, styles) {
    Object.assign(el.style, styles);
  }

  function motionTransition(value) {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'none' : value;
  }

  function animatePanelOpen(panel) {
    if (!panel?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    panel.animate([
      { opacity: 0, transform: 'translateY(-50%) scale(.94)' },
      { opacity: 1, transform: 'translateY(-50%) scale(1)' }
    ], { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function normalizeHexColor(value, fallback) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function hexToRgb(value, fallback) {
    const color = normalizeHexColor(value, fallback);
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16)
    ];
  }

  function rgbaFromHex(value, alpha, fallback = '#000000') {
    const [r, g, b] = hexToRgb(value, fallback);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function themeDefaultColor(key) {
    const theme = settings.overlayTheme || 'classic';
    const defaults = {
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
    return defaults[theme]?.[key] || DEFAULT_SETTINGS[key];
  }

  function overlayColor(key) {
    return normalizeHexColor(settings[key], themeDefaultColor(key));
  }

  function overlayFontFamily() {
    const fonts = {
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif',
      sans: 'Arial, Helvetica, "PingFang SC", "Microsoft YaHei", sans-serif',
      serif: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif',
      mono: '"Cascadia Mono", Consolas, "SFMono-Regular", Menlo, monospace',
      rounded: '"Trebuchet MS", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    };
    return fonts[settings.overlayFontFamily] || fonts.system;
  }

  function overlayThemeCss(alpha) {
    const theme = settings.overlayTheme || 'classic';
    const backgroundColor = overlayColor('overlayBackgroundColor');
    const borderColor = overlayColor('overlayBorderColor');
    const base = {
      background: rgbaFromHex(backgroundColor, alpha),
      border: `1px solid ${rgbaFromHex(borderColor, theme === 'outline' ? 0.62 : 0.16, '#ffffff')}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      backdropFilter: 'none'
    };

    if (theme === 'glass') {
      return {
        ...base,
        background: rgbaFromHex(backgroundColor, Math.min(0.82, Math.max(0.32, alpha))),
        border: `1px solid ${rgbaFromHex(borderColor, 0.28, '#93c5fd')}`,
        boxShadow: '0 18px 38px rgba(15,23,42,0.38)',
        backdropFilter: 'blur(12px) saturate(1.2)'
      };
    }

    if (theme === 'light') {
      return {
        ...base,
        background: rgbaFromHex(backgroundColor, Math.max(0.82, alpha), '#ffffff'),
        border: `1px solid ${rgbaFromHex(borderColor, 0.78, '#cbd5e1')}`,
        boxShadow: '0 12px 28px rgba(15,23,42,0.16)'
      };
    }

    if (theme === 'midnight') {
      return {
        ...base,
        background: rgbaFromHex(backgroundColor, Math.min(0.92, Math.max(0.58, alpha)), '#0f172a'),
        border: `1px solid ${rgbaFromHex(borderColor, 0.34, '#38bdf8')}`,
        boxShadow: '0 14px 34px rgba(2,6,23,0.48)'
      };
    }

    if (theme === 'outline') {
      return {
        ...base,
        background: rgbaFromHex(backgroundColor, Math.min(0.72, Math.max(0.36, alpha)), '#000000'),
        border: `2px solid ${rgbaFromHex(borderColor, 0.7, '#ffffff')}`,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.38), 0 12px 30px rgba(0,0,0,0.34)'
      };
    }

    return base;
  }

  function attachOverlayDragListeners() {
    if (!overlayEl || overlayEl.dataset.pansubDragReady === 'true') return;
    overlayEl.dataset.pansubDragReady = 'true';
    overlayEl.addEventListener('pointerdown', startOverlayDrag);
  }

  function hasManualOverlayPosition() {
    return Number.isFinite(settings.overlayManualX) && Number.isFinite(settings.overlayManualY);
  }

  function clampOverlayTopLeft(left, top) {
    const width = overlayEl.offsetWidth || 240;
    const height = overlayEl.offsetHeight || overlayReservedHeight();
    return {
      left: clamp(left, 8, Math.max(8, window.innerWidth - width - 8)),
      top: clamp(top, 8, Math.max(8, window.innerHeight - height - 8))
    };
  }

  function startOverlayDrag(event) {
    if (!overlayEl || settings.overlayLocked) return;
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    if (event.target.closest?.(`#${OVERLAY_LOCK_ID}, button, select, input, textarea, a`)) return;

    event.preventDefault();
    event.stopPropagation();
    const rect = overlayEl.getBoundingClientRect();
    const currentWidth = rect.width;
    overlayDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: currentWidth
    };
    overlayEl.style.width = `${Math.round(currentWidth)}px`;
    overlayEl.style.maxWidth = `${Math.round(currentWidth)}px`;
    overlayEl.style.transition = 'none';
    overlayEl.setPointerCapture?.(event.pointerId);
    overlayEl.dataset.pansubDragging = 'true';
    window.addEventListener('pointermove', moveOverlayDrag, true);
    window.addEventListener('pointerup', finishOverlayDrag, true);
    window.addEventListener('pointercancel', finishOverlayDrag, true);
  }

  function moveOverlayDrag(event) {
    if (!overlayDrag || !overlayEl) return;
    if (event.pointerId !== overlayDrag.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const next = clampOverlayTopLeft(
      event.clientX - overlayDrag.offsetX,
      event.clientY - overlayDrag.offsetY
    );
    overlayEl.style.left = `${Math.round(next.left + (overlayDrag.width || overlayEl.offsetWidth || 0) / 2)}px`;
    overlayEl.style.top = `${Math.round(next.top)}px`;
    overlayEl.style.bottom = 'auto';
    overlayEl.style.transform = 'translateX(-50%)';
  }

  function finishOverlayDrag(event) {
    if (!overlayDrag || !overlayEl) return;
    if (event.pointerId !== overlayDrag.pointerId) return;

    window.removeEventListener('pointermove', moveOverlayDrag, true);
    window.removeEventListener('pointerup', finishOverlayDrag, true);
    window.removeEventListener('pointercancel', finishOverlayDrag, true);
    overlayEl.releasePointerCapture?.(event.pointerId);
    overlayEl.dataset.pansubDragging = 'false';
    overlayDrag = null;

    const rect = overlayEl.getBoundingClientRect();
    settings = {
      ...settings,
      subtitlePosition: 'manual',
      overlayManualX: clamp((rect.left + rect.width / 2) / Math.max(window.innerWidth, 1), 0, 1),
      overlayManualY: clamp(rect.top / Math.max(window.innerHeight, 1), 0, 1)
    };
    saveSettings(() => {
      applyOverlayStyle();
      applyOverlayPosition(activeCaption);
    });
  }

  function createFloatingPanel() {
    if (document.getElementById(FLOATING_PANEL_ID)) {
      floatingPanelEl = document.getElementById(FLOATING_PANEL_ID);
      updateFloatingPanel();
      return;
    }

    floatingPanelEl = document.createElement('section');
    floatingPanelEl.id = FLOATING_PANEL_ID;
    floatingPanelEl.setAttribute('role', 'dialog');
    floatingPanelEl.setAttribute('aria-modal', 'false');
    floatingPanelEl.setAttribute('aria-label', quickCopy('quickControls'));
    markNoTranslate(floatingPanelEl);

    const header = document.createElement('div');
    header.dataset.pansubPart = 'header';
    const title = document.createElement('strong');
    title.dataset.pansubText = 'title';
    const status = document.createElement('span');
    status.dataset.pansubText = 'status';
    header.append(title, status);

    const audioSection = document.createElement('div');
    audioSection.dataset.pansubPart = 'audio';
    const audioStatus = document.createElement('strong');
    audioStatus.dataset.pansubAudio = 'status';
    const audioDetail = document.createElement('small');
    audioDetail.dataset.pansubAudio = 'detail';
    const audioStart = document.createElement('button');
    audioStart.type = 'button';
    audioStart.dataset.pansubAction = 'audioMode';
    audioStart.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: AUDIO_MESSAGES.OPEN_AUDIO_POPUP });
      toggleFloatingPanel(false);
    });
    const audioStop = document.createElement('button');
    audioStop.type = 'button';
    audioStop.dataset.pansubAction = 'audioStop';
    audioStop.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: AUDIO_MESSAGES.STOP });
      toggleFloatingPanel(false);
    });
    audioSection.append(audioStatus, audioDetail, audioStart, audioStop);

    const enabledRow = createFloatingSwitch('enabled', 'showSubtitles');
    const modeRow = createFloatingSelect('displayMode', 'mode', [
      ['bilingual', 'bilingual'],
      ['translation', 'translation'],
      ['original', 'original']
    ]);
    const targetRow = createFloatingSelect('targetLanguage', 'target', [
      ['zh-CN', 'zhCN'],
      ['zh-TW', 'zhTW'],
      ['ja', 'ja'],
      ['ko', 'ko'],
      ['en', 'enTarget']
    ]);

    const settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.dataset.pansubAction = 'settings';
    settingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: 'PANSUB_OPEN_OPTIONS' });
      toggleFloatingPanel(false);
    });

    const floatingSettingsButton = document.createElement('button');
    floatingSettingsButton.type = 'button';
    floatingSettingsButton.dataset.pansubAction = 'floatingSettings';
    floatingSettingsButton.dataset.pansubVariant = 'quiet';
    floatingSettingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFloatingPanel(false);
      openFloatingSettings();
    });

    const actions = document.createElement('div');
    actions.dataset.pansubPart = 'actions';
    actions.append(floatingSettingsButton, settingsButton);

    floatingPanelEl.append(header, audioSection, enabledRow, modeRow, targetRow, actions);
    markTreeNoTranslate(floatingPanelEl);
    extensionHost().appendChild(floatingPanelEl);
    bindFloatingPanelControls();
    updateFloatingPanel();
  }

  function createFloatingSwitch(key, labelKey) {
    const row = document.createElement('label');
    row.dataset.pansubPart = 'row';
    const label = document.createElement('span');
    label.dataset.pansubLabel = labelKey;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.pansubControl = key;
    row.append(label, input);
    return row;
  }

  function createFloatingSelect(key, labelKey, options) {
    const row = document.createElement('label');
    row.dataset.pansubPart = 'stack';
    const label = document.createElement('span');
    label.dataset.pansubLabel = labelKey;
    const select = document.createElement('select');
    select.dataset.pansubControl = key;
    for (const [value, textKey] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.dataset.pansubLabel = textKey;
      select.appendChild(option);
    }
    row.append(label, select);
    return row;
  }

  function createFloatingSettingsPanel() {
    if (document.getElementById(FLOATING_SETTINGS_ID)) {
      floatingSettingsEl = document.getElementById(FLOATING_SETTINGS_ID);
      updateFloatingSettingsPanel();
      return;
    }

    floatingSettingsEl = document.createElement('section');
    floatingSettingsEl.id = FLOATING_SETTINGS_ID;
    floatingSettingsEl.setAttribute('role', 'dialog');
    floatingSettingsEl.setAttribute('aria-modal', 'false');
    floatingSettingsEl.setAttribute('aria-label', quickCopy('floatingSettingsTitle'));
    markNoTranslate(floatingSettingsEl);

    const header = document.createElement('div');
    header.dataset.pansubFloatPart = 'header';
    const title = document.createElement('strong');
    title.dataset.pansubText = 'floatingSettingsTitle';
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.pansubFloatAction = 'close';
    close.setAttribute('aria-label', quickCopy('close'));
    close.textContent = '×';
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeFloatingSettings(true);
    });
    header.append(title, close);

    const smallRow = createFloatingSettingsSwitch('floatingButtonSmall', 'compactButton');

    const commandGrid = document.createElement('div');
    commandGrid.dataset.pansubFloatPart = 'commands';
    commandGrid.append(
      createFloatingCommand('hideVisit'),
      createFloatingCommand('hideSite'),
      createFloatingCommand('disableGlobal'),
      createFloatingCommand('resetPosition')
    );

    const note = document.createElement('p');
    note.dataset.pansubFloatPart = 'note';
    note.dataset.pansubLabel = 'buttonControlsNote';

    floatingSettingsEl.append(header, smallRow, commandGrid, note);
    markTreeNoTranslate(floatingSettingsEl);
    extensionHost().appendChild(floatingSettingsEl);
    bindFloatingSettingsControls();
    updateFloatingSettingsPanel();
  }

  function createFloatingSettingsSwitch(key, labelKey) {
    const row = document.createElement('label');
    row.dataset.pansubFloatPart = 'row';
    const label = document.createElement('span');
    label.dataset.pansubLabel = labelKey;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.pansubFloatControl = key;
    row.append(label, input);
    return row;
  }

  function createFloatingCommand(action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.pansubFloatAction = action;
    button.dataset.pansubLabel = action;
    return button;
  }

  function bindFloatingSettingsControls() {
    const small = floatingSettingsEl.querySelector('[data-pansub-float-control="floatingButtonSmall"]');
    small.addEventListener('change', () => {
      settings = { ...settings, floatingButtonSmall: small.checked };
      saveSettings();
      applyFloatingButtonStyle();
      updateFloatingSettingsPanel();
    });

    floatingSettingsEl.querySelectorAll('[data-pansub-float-action]').forEach((button) => {
      if (button.dataset.pansubFloatAction === 'close') return;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        runFloatingCommand(button.dataset.pansubFloatAction);
      });
    });
  }

  function openFloatingSettings() {
    createFloatingSettingsPanel();
    floatingSettingsOpen = true;
    applyFloatingButtonStyle();
    animatePanelOpen(floatingSettingsEl);
    updateFloatingSettingsPanel();
    window.setTimeout(() => {
      floatingSettingsEl?.querySelector('[data-pansub-float-control="floatingButtonSmall"]')?.focus();
    }, 0);
  }

  function closeFloatingSettings(restoreFocus = false) {
    floatingSettingsOpen = false;
    applyFloatingButtonStyle();
    if (restoreFocus) floatingEl?.focus();
  }

  function runFloatingCommand(action) {
    if (action === 'hideVisit') {
      floatingButtonSessionHidden = true;
    } else if (action === 'hideSite') {
      settings = {
        ...settings,
        floatingButtonDisabledHosts: Array.from(new Set([...disabledHosts(), currentHost()].filter(Boolean)))
      };
      saveSettings();
    } else if (action === 'disableGlobal') {
      settings = { ...settings, floatingButtonEnabled: false };
      saveSettings();
    } else if (action === 'resetPosition') {
      settings = { ...settings, floatingButtonX: null, floatingButtonY: null };
      saveSettings();
    }

    closeFloatingSettings();
    applyFloatingButtonStyle();
  }

  function bindFloatingPanelControls() {
    const enabled = floatingPanelEl.querySelector('[data-pansub-control="enabled"]');
    const displayMode = floatingPanelEl.querySelector('[data-pansub-control="displayMode"]');
    const targetLanguage = floatingPanelEl.querySelector('[data-pansub-control="targetLanguage"]');

    enabled.addEventListener('change', () => {
      updateQuickSetting('enabled', enabled.checked);
    });
    displayMode.addEventListener('change', () => {
      updateQuickSetting('displayMode', displayMode.value);
    });
    targetLanguage.addEventListener('change', () => {
      updateQuickSetting('targetLanguage', targetLanguage.value);
      lastText = '';
      lastTranslatedText = '';
      handleCaptionChange();
    });
  }

  function updateQuickSetting(key, value) {
    settings = { ...settings, [key]: value };
    saveSettings();
    applyVisibility();
    applyOverlayStyle();
    applyFloatingButtonStyle();
    if (lastOriginalText) {
      updateOverlay(lastOriginalText, lastTranslatedText);
    }
  }

  function hasFloatingCustomPosition() {
    return Number.isFinite(settings.floatingButtonX) && Number.isFinite(settings.floatingButtonY);
  }

  function floatingButtonSize() {
    return settings.floatingButtonSmall ? FLOATING_SMALL_SIZE : FLOATING_REGULAR_SIZE;
  }

  function clampFloatingPosition(x, y) {
    const size = floatingButtonSize();
    const maxX = Math.max(FLOATING_MARGIN, window.innerWidth - size - FLOATING_MARGIN);
    const maxY = Math.max(FLOATING_MARGIN, window.innerHeight - size - FLOATING_MARGIN);
    return {
      x: Math.round(clamp(x, FLOATING_MARGIN, maxX)),
      y: Math.round(clamp(y, FLOATING_MARGIN, maxY))
    };
  }

  function floatingPosition() {
    if (hasFloatingCustomPosition()) {
      return clampFloatingPosition(settings.floatingButtonX, settings.floatingButtonY);
    }

    const size = floatingButtonSize();
    const x = settings.floatingButtonSide === 'left'
      ? 18
      : window.innerWidth - size - 18;
    const y = window.innerHeight / 2 - size / 2;
    return clampFloatingPosition(x, y);
  }

  function startFloatingDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const position = floatingPosition();
    floatingDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false
    };
    floatingEl.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', moveFloatingDrag, true);
    window.addEventListener('pointerup', endFloatingDrag, true);
  }

  function moveFloatingDrag(event) {
    if (!floatingDrag || event.pointerId !== floatingDrag.pointerId) return;

    const dx = event.clientX - floatingDrag.startX;
    const dy = event.clientY - floatingDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      floatingDrag.moved = true;
      floatingPanelOpen = false;
    }

    if (!floatingDrag.moved) return;

    const next = clampFloatingPosition(floatingDrag.originX + dx, floatingDrag.originY + dy);
    settings = {
      ...settings,
      floatingButtonX: next.x,
      floatingButtonY: next.y,
      floatingButtonSide: next.x + floatingButtonSize() / 2 < window.innerWidth / 2 ? 'left' : 'right'
    };
    applyFloatingButtonStyle();
    event.preventDefault();
  }

  function endFloatingDrag(event) {
    if (!floatingDrag || event.pointerId !== floatingDrag.pointerId) return;

    floatingEl.releasePointerCapture?.(event.pointerId);
    window.removeEventListener('pointermove', moveFloatingDrag, true);
    window.removeEventListener('pointerup', endFloatingDrag, true);

    const moved = floatingDrag.moved;
    if (moved) {
      suppressFloatingClick = true;
      saveSettings(() => {
        window.setTimeout(() => {
          suppressFloatingClick = false;
        }, 0);
      });
    }

    floatingDrag = null;
    applyFloatingButtonStyle();
    if (moved) event.preventDefault();
  }

  function attachFloatingPanelListeners() {
    if (attachFloatingPanelListeners.attached) return;
    attachFloatingPanelListeners.attached = true;

    document.addEventListener('click', (event) => {
      if (floatingSettingsOpen && !floatingSettingsEl?.contains(event.target) && !floatingEl?.contains(event.target)) {
        closeFloatingSettings(false);
      }
      if (!floatingPanelOpen) return;
      if (floatingEl?.contains(event.target) || floatingPanelEl?.contains(event.target)) return;
      toggleFloatingPanel(false);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        toggleFloatingPanel(false, true);
        closeFloatingSettings(true);
      }
    });
  }

  function toggleFloatingPanel(nextOpen, restoreFocus = false) {
    createFloatingPanel();
    floatingPanelOpen = typeof nextOpen === 'boolean' ? nextOpen : !floatingPanelOpen;
    if (floatingPanelOpen) closeFloatingSettings(false);
    if (floatingEl) {
      floatingEl.setAttribute('aria-expanded', String(floatingPanelOpen));
    }
    applyFloatingButtonStyle();
    updateFloatingPanel();
    if (floatingPanelOpen) {
      animatePanelOpen(floatingPanelEl);
      window.setTimeout(() => {
        floatingPanelEl?.querySelector('[data-pansub-control="enabled"]')?.focus();
      }, 0);
    } else if (restoreFocus) {
      floatingEl?.focus();
    }
  }

  function applyVisibility() {
    if (!overlayEl) return;
    const hasVisibleSubtitle = settings.displayMode !== 'translation'
      || Boolean(lastTranslatedText)
      || sourceAlreadyMatchesTarget(lastOriginalText);
    overlayEl.style.display = settings.enabled && hasVisibleSubtitle ? 'block' : 'none';
  }

  function applyFloatingButtonStyle() {
    if (!floatingEl) return;
    floatingEl.dataset.audioState = audioState.phase;
    const visible = isFloatingButtonVisible();
    const alpha = clamp(settings.floatingButtonOpacity, 20, 100) / 100;
    const position = floatingPosition();
    const size = floatingButtonSize();
    floatingEl.style.cssText = [
      'position: fixed',
      `left: ${position.x}px`,
      `top: ${position.y}px`,
      'right: auto',
      'bottom: auto',
      `width: ${size}px`,
      `height: ${size}px`,
      `border: 1px solid ${settings.enabled ? 'rgba(110,231,200,.5)' : 'rgba(203,213,225,.24)'}`,
      'border-radius: 50%',
      `background: rgba(${settings.enabled ? '10,119,102' : '63,74,72'},${alpha})`,
      'color: #fff',
      `font: 800 ${settings.floatingButtonSmall ? 15 : 18}px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      floatingPanelOpen || floatingSettingsOpen
        ? 'box-shadow: 0 0 0 4px rgba(110,231,200,.12), 0 14px 32px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.2)'
        : 'box-shadow: 0 10px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.18)',
      'z-index: 2147483647',
      floatingDrag ? 'cursor: grabbing' : 'cursor: grab',
      'pointer-events: auto',
      'user-select: none',
      'touch-action: none',
      floatingPanelOpen || floatingSettingsOpen ? 'transform: scale(1.06)' : 'transform: none',
      settings.floatingButtonHoverOnly ? 'opacity: 0.2' : 'opacity: 1',
      floatingDrag ? 'transition: none' : `transition: ${motionTransition('opacity .18s ease, transform .2s cubic-bezier(.2,.8,.2,1), background .18s ease, border-color .18s ease, box-shadow .18s ease')}`,
      visible ? 'display: block' : 'display: none'
    ].join(';');

    const mark = floatingEl.querySelector('[data-pansub-floating-part="mark"]');
    const signal = floatingEl.querySelector('[data-pansub-floating-part="signal"]');
    if (mark) {
      mark.style.cssText = 'display:grid;place-items:center;width:100%;height:100%;pointer-events:none;';
    }
    if (signal) {
      const signalColors = {
        available: '#f59e0b',
        permission: '#60a5fa',
        preparing: '#60a5fa',
        listening: '#34d399',
        degraded: '#f59e0b',
        stopping: '#94a3b8',
        error: '#fb7185'
      };
      const signalColor = signalColors[audioState.phase] || (settings.enabled ? '#6ee7c8' : '#94a3b8');
      signal.style.cssText = [
        'position:absolute',
        'right:2px',
        'top:2px',
        `width:${settings.floatingButtonSmall ? 6 : 7}px`,
        `height:${settings.floatingButtonSmall ? 6 : 7}px`,
        'border:2px solid rgba(8,18,17,.88)',
        'border-radius:50%',
        `background:${signalColor}`,
        settings.enabled ? 'box-shadow:0 0 0 3px rgba(110,231,200,.1),0 0 10px rgba(110,231,200,.6)' : 'box-shadow:none',
        'pointer-events:none'
      ].join(';');
      signal.getAnimations?.().forEach((animation) => animation.cancel());
      if (audioState.phase === 'listening'
        && signal.animate
        && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        signal.animate([
          { transform: 'scale(.82)', opacity: .7 },
          { transform: 'scale(1.18)', opacity: 1 },
          { transform: 'scale(.82)', opacity: .7 }
        ], { duration: 1100, iterations: Infinity, easing: 'ease-in-out' });
      }
    }

    floatingEl.onmouseenter = () => {
      if (floatingDrag) return;
      floatingEl.style.opacity = '1';
      floatingEl.style.transform = 'scale(1.08)';
    };
    floatingEl.onmouseleave = () => {
      if (floatingDrag) return;
      floatingEl.style.opacity = settings.floatingButtonHoverOnly ? '0.2' : '1';
      floatingEl.style.transform = floatingPanelOpen || floatingSettingsOpen ? 'scale(1.06)' : 'none';
    };

    if (!visible) floatingPanelOpen = false;
    applyFloatingPanelStyle();
    applyFloatingSettingsStyle();
    updateFloatingPanel();
  }

  function applyFloatingPanelStyle() {
    if (!floatingPanelEl) return;

    const buttonVisible = isFloatingButtonVisible();
    const panelVisible = buttonVisible && floatingPanelOpen;
    const display = panelVisible ? 'block' : 'none';
    const buttonPosition = floatingPosition();
    const size = floatingButtonSize();
    const panelWidth = Math.min(260, Math.max(140, window.innerWidth - FLOATING_MARGIN * 2));
    const opensRight = buttonPosition.x + size / 2 < window.innerWidth / 2;
    const candidateLeft = opensRight
      ? buttonPosition.x + size + 12
      : buttonPosition.x - panelWidth - 12;
    const maxLeft = Math.max(FLOATING_MARGIN, window.innerWidth - panelWidth - FLOATING_MARGIN);
    const left = clamp(candidateLeft, FLOATING_MARGIN, maxLeft);
    const panelHalf = 150;
    const minTop = Math.min(window.innerHeight / 2, FLOATING_MARGIN + panelHalf);
    const maxTop = Math.max(minTop, window.innerHeight - FLOATING_MARGIN - panelHalf);
    const top = clamp(buttonPosition.y + size / 2, minTop, maxTop);

    setStyles(floatingPanelEl, {
      position: 'fixed',
      left: `${left}px`,
      right: 'auto',
      top: `${top}px`,
      bottom: 'auto',
      width: `${panelWidth}px`,
      maxWidth: 'calc(100vw - 16px)',
      color: '#f2faf7',
      background: 'rgba(13, 21, 21, 0.97)',
      border: '1px solid rgba(110, 231, 200, 0.2)',
      borderRadius: '8px',
      boxShadow: '0 24px 56px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,.04)',
      padding: '12px',
      zIndex: '2147483647',
      pointerEvents: panelVisible ? 'auto' : 'none',
      opacity: panelVisible ? '1' : '0',
      visibility: panelVisible ? 'visible' : 'hidden',
      transform: panelVisible ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(.94)',
      transformOrigin: opensRight ? 'left center' : 'right center',
      transition: motionTransition('opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility .18s ease'),
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '13px',
      lineHeight: '1.35',
      display
    });

    floatingPanelEl.querySelectorAll('[data-pansub-part="header"]').forEach((el) => {
      setStyles(el, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '10px'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-text="title"]').forEach((el) => {
      setStyles(el, { fontSize: '15px', letterSpacing: '0', color: '#ffffff' });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-text="status"]').forEach((el) => {
      setStyles(el, {
        borderRadius: '999px',
        padding: '3px 8px',
        border: `1px solid ${settings.enabled ? 'rgba(110,231,200,.2)' : 'rgba(148,163,184,.16)'}`,
        background: settings.enabled ? 'rgba(110,231,200,.1)' : 'rgba(148,163,184,.1)',
        color: settings.enabled ? '#6ee7c8' : '#cbd5e1',
        fontSize: '12px',
        fontWeight: '700'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-part="audio"]').forEach((el) => {
      setStyles(el, {
        display: 'none',
        gap: '5px',
        margin: '0 0 8px',
        padding: '10px',
        border: '1px solid rgba(245,158,11,.24)',
        borderRadius: '7px',
        background: 'rgba(245,158,11,.08)'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-audio="status"]').forEach((el) => {
      setStyles(el, { color: '#f8fafc', fontSize: '13px' });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-audio="detail"]').forEach((el) => {
      setStyles(el, { color: '#b8c7c2', fontSize: '12px', lineHeight: '1.4' });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-part="row"]').forEach((el) => {
      setStyles(el, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '9px 0',
        borderTop: '1px solid rgba(255,255,255,.08)'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-part="stack"]').forEach((el) => {
      setStyles(el, {
        display: 'grid',
        gap: '6px',
        padding: '9px 0',
        borderTop: '1px solid rgba(255,255,255,.08)'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-part="actions"]').forEach((el) => {
      setStyles(el, {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '8px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255,255,255,.08)'
      });
    });
    floatingPanelEl.querySelectorAll('span').forEach((el) => {
      if (el.dataset.pansubText === 'status') return;
      setStyles(el, { color: '#d6e6e1', fontWeight: '700' });
    });
    floatingPanelEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      setStyles(el, {
        width: '38px',
        height: '22px',
        margin: '0',
        accentColor: '#32c9a6',
        cursor: 'pointer'
      });
    });
    floatingPanelEl.querySelectorAll('select').forEach((el) => {
      setStyles(el, {
        width: '100%',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: '7px',
        padding: '7px 8px',
        color: '#f8fafc',
        background: '#14201e',
        font: '600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        cursor: 'pointer'
      });
    });
    floatingPanelEl.querySelectorAll('button').forEach((el) => {
      setStyles(el, {
        width: '100%',
        marginTop: '0',
        border: '1px solid rgba(110,231,200,.24)',
        borderRadius: '7px',
        padding: '9px 10px',
        color: '#dff8f1',
        background: 'rgba(110,231,200,.09)',
        font: '800 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        cursor: 'pointer'
      });
    });
    floatingPanelEl.querySelectorAll('[data-pansub-variant="quiet"]').forEach((el) => {
      setStyles(el, {
        borderColor: 'rgba(255,255,255,.11)',
        color: '#cbd5e1',
        background: 'rgba(255,255,255,.025)'
      });
    });
  }

  function applyFloatingSettingsStyle() {
    if (!floatingSettingsEl) return;

    const buttonVisible = isFloatingButtonVisible();
    const panelVisible = buttonVisible && floatingSettingsOpen;
    const display = panelVisible ? 'block' : 'none';
    const buttonPosition = floatingPosition();
    const size = floatingButtonSize();
    const panelWidth = Math.min(286, Math.max(180, window.innerWidth - FLOATING_MARGIN * 2));
    const opensRight = buttonPosition.x + size / 2 < window.innerWidth / 2;
    const candidateLeft = opensRight
      ? buttonPosition.x + size + 12
      : buttonPosition.x - panelWidth - 12;
    const left = clamp(candidateLeft, FLOATING_MARGIN, Math.max(FLOATING_MARGIN, window.innerWidth - panelWidth - FLOATING_MARGIN));
    const panelHalf = 132;
    const minTop = Math.min(window.innerHeight / 2, FLOATING_MARGIN + panelHalf);
    const maxTop = Math.max(minTop, window.innerHeight - FLOATING_MARGIN - panelHalf);
    const top = clamp(buttonPosition.y + size / 2, minTop, maxTop);

    setStyles(floatingSettingsEl, {
      position: 'fixed',
      left: `${left}px`,
      right: 'auto',
      top: `${top}px`,
      bottom: 'auto',
      width: `${panelWidth}px`,
      maxWidth: 'calc(100vw - 16px)',
      padding: '12px',
      color: '#f8fafc',
      background: 'rgba(13,21,21,.98)',
      border: '1px solid rgba(110,231,200,.2)',
      borderRadius: '8px',
      boxShadow: '0 24px 56px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)',
      zIndex: '2147483647',
      pointerEvents: panelVisible ? 'auto' : 'none',
      opacity: panelVisible ? '1' : '0',
      visibility: panelVisible ? 'visible' : 'hidden',
      transform: panelVisible ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(.94)',
      transformOrigin: opensRight ? 'left center' : 'right center',
      transition: motionTransition('opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1), visibility .18s ease'),
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '13px',
      lineHeight: '1.35',
      display
    });

    floatingSettingsEl.querySelectorAll('[data-pansub-float-part="header"]').forEach((el) => {
      setStyles(el, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '10px'
      });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-text="floatingSettingsTitle"]').forEach((el) => {
      setStyles(el, { color: '#ffffff', fontSize: '15px', letterSpacing: '0' });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-float-action="close"]').forEach((el) => {
      setStyles(el, {
        width: '28px',
        height: '28px',
        border: '1px solid rgba(148,163,184,.24)',
        borderRadius: '8px',
        padding: '0',
        color: '#cbd5e1',
        background: 'rgba(15,23,42,.38)',
        cursor: 'pointer',
        font: '700 18px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-float-part="row"]').forEach((el) => {
      setStyles(el, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 0',
        borderTop: '1px solid rgba(148,163,184,.18)'
      });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-float-part="commands"]').forEach((el) => {
      setStyles(el, {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '8px',
        padding: '10px 0',
        borderTop: '1px solid rgba(148,163,184,.18)'
      });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-float-part="note"]').forEach((el) => {
      setStyles(el, {
        margin: '0',
        color: '#93a4bc',
        fontSize: '12px'
      });
    });
    floatingSettingsEl.querySelectorAll('span').forEach((el) => {
      setStyles(el, { color: '#dbeafe', fontWeight: '700' });
    });
    floatingSettingsEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      setStyles(el, {
        width: '38px',
        height: '22px',
        margin: '0',
        accentColor: '#22c55e',
        cursor: 'pointer'
      });
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-float-part="commands"] button').forEach((el) => {
      setStyles(el, {
        minHeight: '38px',
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: '8px',
        padding: '8px 9px',
        color: '#e2e8f0',
        background: 'rgba(30,41,59,.58)',
        font: '800 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        cursor: 'pointer'
      });
    });
  }

  function updateFloatingPanel() {
    if (!floatingPanelEl) return;

    const title = floatingPanelEl.querySelector('[data-pansub-text="title"]');
    const status = floatingPanelEl.querySelector('[data-pansub-text="status"]');
    const enabled = floatingPanelEl.querySelector('[data-pansub-control="enabled"]');
    const displayMode = floatingPanelEl.querySelector('[data-pansub-control="displayMode"]');
    const targetLanguage = floatingPanelEl.querySelector('[data-pansub-control="targetLanguage"]');
    const settingsButton = floatingPanelEl.querySelector('[data-pansub-action="settings"]');
    const floatingSettingsButton = floatingPanelEl.querySelector('[data-pansub-action="floatingSettings"]');
    const audioSection = floatingPanelEl.querySelector('[data-pansub-part="audio"]');
    const audioStatus = floatingPanelEl.querySelector('[data-pansub-audio="status"]');
    const audioDetail = floatingPanelEl.querySelector('[data-pansub-audio="detail"]');
    const audioStart = floatingPanelEl.querySelector('[data-pansub-action="audioMode"]');
    const audioStop = floatingPanelEl.querySelector('[data-pansub-action="audioStop"]');

    if (title) title.textContent = quickCopy('title');
    if (status) status.textContent = quickCopy(settings.enabled ? 'enabled' : 'disabled');
    if (enabled) enabled.checked = settings.enabled;
    if (displayMode) displayMode.value = settings.displayMode;
    if (targetLanguage) targetLanguage.value = settings.targetLanguage;
    if (settingsButton) settingsButton.textContent = quickCopy('settings');
    if (floatingSettingsButton) floatingSettingsButton.textContent = quickCopy('floatingSettings');
    const phaseCopy = {
      available: ['audioAvailable', 'audioAvailableDetail'],
      permission: ['audioPreparing', 'audioPreparingDetail'],
      preparing: ['audioPreparing', 'audioPreparingDetail'],
      listening: ['audioListening', 'audioListeningDetail'],
      degraded: ['audioDegraded', 'audioDegradedDetail'],
      error: ['audioError', 'audioErrorDetail'],
      stopping: ['audioStopping', 'audioStoppingDetail']
    };
    const audioCopy = phaseCopy[audioState.phase];
    if (audioSection) audioSection.style.display = audioCopy ? 'grid' : 'none';
    if (audioStatus && audioCopy) audioStatus.textContent = quickCopy(audioCopy[0]);
    if (audioDetail && audioCopy) audioDetail.textContent = quickCopy(audioCopy[1]);
    if (audioStart) {
      audioStart.textContent = quickCopy('openAudioMode');
      audioStart.style.display = ['available', 'error'].includes(audioState.phase) ? 'block' : 'none';
    }
    if (audioStop) {
      audioStop.textContent = quickCopy('stopAudioMode');
      audioStop.style.display = ['permission', 'preparing', 'listening', 'degraded', 'stopping'].includes(audioState.phase)
        ? 'block'
        : 'none';
    }
    if (floatingEl) {
      floatingEl.title = quickCopy('quickControls');
      floatingEl.setAttribute('aria-label', floatingEl.title);
    }
    floatingPanelEl.setAttribute('aria-label', quickCopy('quickControls'));

    floatingPanelEl.querySelectorAll('[data-pansub-label]').forEach((el) => {
      el.textContent = quickCopy(el.dataset.pansubLabel);
    });
  }

  function updateFloatingSettingsPanel() {
    if (!floatingSettingsEl) return;

    const small = floatingSettingsEl.querySelector('[data-pansub-float-control="floatingButtonSmall"]');
    if (small) small.checked = Boolean(settings.floatingButtonSmall);
    floatingSettingsEl.setAttribute('aria-label', quickCopy('floatingSettingsTitle'));
    floatingSettingsEl.querySelector('[data-pansub-float-action="close"]')?.setAttribute('aria-label', quickCopy('close'));

    floatingSettingsEl.querySelectorAll('[data-pansub-label]').forEach((el) => {
      el.textContent = quickCopy(el.dataset.pansubLabel);
    });
    floatingSettingsEl.querySelectorAll('[data-pansub-text]').forEach((el) => {
      el.textContent = quickCopy(el.dataset.pansubText);
    });
  }

  function overlayReservedHeight() {
    const originalLine = Math.ceil(clamp(settings.originalFontSize, 10, 24) * 1.22);
    const translationLine = Math.ceil(clamp(settings.fontSize, 14, 42) * 1.22);
    if (settings.displayMode === 'original') return originalLine + 14;
    if (settings.displayMode === 'translation') return translationLine + 16;
    return originalLine + translationLine + 18;
  }

  function textVisualWeight(text) {
    return Array.from(String(text || '')).reduce((weight, char) => {
      if (/\s/.test(char)) return weight + 0.35;
      if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) return weight + 1.08;
      return weight + 0.66;
    }, 0);
  }

  function adaptiveOverlayWidth(rect, baseMaxWidth) {
    const textWeight = Math.max(
      textVisualWeight(lastTranslatedText),
      textVisualWeight(lastOriginalText)
    );
    const adaptivePercent = textWeight > 54
      ? 98
      : textWeight > 36
        ? 96
        : textWeight > 22
          ? 92
          : baseMaxWidth;
    const viewportAllowance = Math.max(220, window.innerWidth - 24);
    const viewportWidth = textWeight > 54
      ? viewportAllowance * 0.98
      : textWeight > 36
        ? viewportAllowance * 0.96
        : textWeight > 22
          ? viewportAllowance * 0.92
          : 0;
    const adaptiveCap = textWeight > 54
      ? 1400
      : textWeight > 36
        ? 1280
        : textWeight > 22
          ? 1120
          : 760;
    const maxPercent = Math.max(baseMaxWidth, adaptivePercent);
    const playerWidth = rect.width * (maxPercent / 100);
    return Math.max(220, Math.min(Math.max(playerWidth, viewportWidth), adaptiveCap, viewportAllowance));
  }

  function applyOverlayStyle() {
    if (!overlayEl) return;

    const alpha = clamp(settings.backgroundOpacity, 0, 100) / 100;
    const maxWidth = clamp(settings.maxWidth, 40, 96);
    const rect = playerRect();
    const widthPx = adaptiveOverlayWidth(rect, maxWidth);
    const themeCss = overlayThemeCss(alpha);
    const subtitleColor = overlayColor('subtitleColor');
    const originalColor = overlayColor('originalColor');
    const currentLeft = overlayEl.style.left || '50%';
    const currentTop = overlayEl.style.top || 'auto';
    const currentBottom = overlayEl.style.bottom || '80px';
    const currentTransform = overlayEl.style.transform || 'translateX(-50%)';
    overlayEl.style.cssText = [
      'position: fixed',
      'width: fit-content',
      'min-width: 180px',
      `max-width: min(calc(100vw - 32px), ${Math.round(widthPx)}px)`,
      `left: ${currentLeft}`,
      `top: ${currentTop}`,
      `bottom: ${currentBottom}`,
      `transform: ${currentTransform}`,
      `min-height: ${overlayReservedHeight()}px`,
      'box-sizing: border-box',
      `background: ${themeCss.background}`,
      `border: ${themeCss.border}`,
      `box-shadow: ${themeCss.boxShadow}`,
      `backdrop-filter: ${themeCss.backdropFilter}`,
      `-webkit-backdrop-filter: ${themeCss.backdropFilter}`,
      `color: ${subtitleColor}`,
      'padding: 8px 14px',
      'border-radius: 8px',
      'z-index: 2147483645',
      'pointer-events: auto',
      'text-align: center',
      `font-family: ${overlayFontFamily()}`,
      'line-height: 1.35',
      settings.overlayLocked ? 'cursor: default' : 'cursor: move',
      overlayDrag ? 'transition: none' : 'transition: box-shadow .16s ease, border-color .16s ease, background .16s ease',
      'touch-action: none',
      'user-select: none'
    ].join(';');

    const toolbar = document.getElementById(OVERLAY_TOOLBAR_ID);
    if (toolbar) {
      toolbar.style.cssText = [
        'display: flex',
        'align-items: center',
        'justify-content: flex-end',
        'gap: 8px',
        'height: 0',
        'margin: -2px -6px 0',
        'opacity: .82',
        'pointer-events: auto'
      ].join(';');
    }

    overlayEl.querySelectorAll('[data-pansub-part="overlayGrip"]').forEach((el) => {
      el.style.cssText = [
        'display: none',
        'font-size: 10px',
        'font-weight: 800',
        'letter-spacing: .08em',
        'text-transform: uppercase',
        `color: ${originalColor}`,
        'opacity: .82'
      ].join(';');
    });

    const lock = document.getElementById(OVERLAY_LOCK_ID);
    if (lock) {
      lock.style.cssText = [
        'display: grid',
        'place-items: center',
        'width: 22px',
        'height: 22px',
        'border: 1px solid rgba(148,163,184,.28)',
        'border-radius: 7px',
        'padding: 0',
        'background: rgba(15,23,42,.28)',
        `color: ${subtitleColor}`,
        'cursor: pointer',
        'pointer-events: auto',
        'transform: translate(10px, -10px)'
      ].join(';');
      lock.querySelectorAll('svg').forEach((svg) => {
        svg.style.cssText = 'width: 15px;height: 15px;fill: none;stroke: currentColor;stroke-width: 2;stroke-linecap: round;stroke-linejoin: round;';
      });
    }

    const original = document.getElementById(ORIGINAL_ID);
    const translated = document.getElementById(TRANSLATED_ID);
    if (original) {
      original.style.cssText = [
        `font-size: ${clamp(settings.originalFontSize, 10, 24)}px`,
        `min-height: ${Math.ceil(clamp(settings.originalFontSize, 10, 24) * 1.18)}px`,
        `color: ${originalColor}`,
        'opacity: 0.86',
        'margin-bottom: 2px'
      ].join(';');
    }
    if (translated) {
      translated.style.cssText = [
        `font-size: ${clamp(settings.fontSize, 14, 42)}px`,
        `min-height: ${Math.ceil(clamp(settings.fontSize, 14, 42) * 1.18)}px`,
        'font-weight: 650',
        `color: ${subtitleColor}`
      ].join(';');
    }
    updateOverlayLockButton();
  }

  function applyOverlayPosition(caption) {
    if (!overlayEl) return;
    if (overlayDrag) return;

    const position = settings.subtitlePosition;
    if (position === 'manual' && hasManualOverlayPosition()) {
      setManualOverlayPosition('manual');
      return;
    }

    const inFullscreen = Boolean(fullscreenElement());
    if (inFullscreen) {
      setPlayerBottom(position === 'page-bottom' ? 32 : 80, 'fullscreen-lock');
      return;
    }

    if (position === 'page-bottom') {
      setViewportBottom(32, 'page-bottom');
      return;
    }
    if (position === 'video-bottom') {
      setPlayerBottom(80, 'video-bottom');
      return;
    }
    if (position === 'follow-caption' && caption?.mode === 'docked') {
      setNearCaption(caption.el, 'follow-docked');
      return;
    }
    if (position === 'follow-caption') {
      setPlayerBottom(80, 'follow-overlay-fallback');
      return;
    }
    if (!caption || caption.mode === 'overlay') {
      setPlayerBottom(80, 'auto-overlay');
      return;
    }
    setPlayerBottom(120, 'auto-docked');
  }

  function setManualOverlayPosition(reason) {
    const overlayWidth = overlayEl.offsetWidth || 240;
    const overlayHeight = overlayEl.offsetHeight || overlayReservedHeight();
    const centerX = clamp(
      settings.overlayManualX * window.innerWidth,
      overlayWidth / 2 + 8,
      window.innerWidth - overlayWidth / 2 - 8
    );
    const top = clamp(
      settings.overlayManualY * window.innerHeight,
      8,
      Math.max(8, window.innerHeight - overlayHeight - 8)
    );
    overlayEl.style.top = `${Math.round(top)}px`;
    overlayEl.style.bottom = 'auto';
    overlayEl.style.left = `${Math.round(centerX)}px`;
    overlayEl.style.transform = 'translateX(-50%)';
    traceOverlayPosition(reason);
  }

  function overlayRectSnapshot() {
    const rect = overlayEl?.getBoundingClientRect();
    if (!rect) return null;
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function traceOverlayPosition(reason, extra = {}) {
    if (!settings.debugLogs) return;
    debug('[PanSub] overlay position', {
      reason,
      fullscreen: Boolean(fullscreenElement()),
      setting: settings.subtitlePosition,
      captionMode: activeCaption?.mode || null,
      parent: overlayEl?.parentElement?.id || overlayEl?.parentElement?.className || overlayEl?.parentElement?.tagName || null,
      style: {
        left: overlayEl?.style.left,
        top: overlayEl?.style.top,
        bottom: overlayEl?.style.bottom,
        width: overlayEl?.style.width
      },
      rect: overlayRectSnapshot(),
      ...extra
    });
  }

  function setViewportBottom(bottom, reason) {
    overlayEl.style.top = 'auto';
    overlayEl.style.bottom = `${bottom}px`;
    overlayEl.style.left = '50%';
    overlayEl.style.transform = 'translateX(-50%)';
    traceOverlayPosition(reason);
  }

  function setPlayerBottom(bottom, reason) {
    const rect = playerRect();
    const overlayHeight = overlayEl.offsetHeight || overlayReservedHeight();
    const safeBottom = fullscreenElement() ? Math.min(bottom, Math.max(42, rect.height * 0.16)) : bottom;
    const centerX = clamp(rect.left + rect.width / 2, 16, window.innerWidth - 16);
    const minTop = Math.max(12, rect.top + 12);
    const maxTop = Math.max(minTop, Math.min(window.innerHeight - overlayHeight - 12, rect.bottom - overlayHeight - 12));
    const top = clamp(rect.bottom - safeBottom - overlayHeight, minTop, maxTop);
    overlayEl.style.top = `${Math.round(top)}px`;
    overlayEl.style.bottom = 'auto';
    const overlayWidth = overlayEl.offsetWidth || 240;
    const safeCenterX = clamp(centerX, overlayWidth / 2 + 8, window.innerWidth - overlayWidth / 2 - 8);
    overlayEl.style.left = `${Math.round(safeCenterX)}px`;
    overlayEl.style.transform = 'translateX(-50%)';
    traceOverlayPosition(reason, {
      player: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  function setNearCaption(el, reason) {
    const rect = el.getBoundingClientRect();
    const overlayHeight = overlayEl.offsetHeight || 64;
    const left = clamp(rect.left + rect.width / 2, 120, window.innerWidth - 120);
    const top = Math.max(12, rect.top - overlayHeight - 10);
    overlayEl.style.top = `${top}px`;
    overlayEl.style.bottom = 'auto';
    overlayEl.style.left = `${left}px`;
    overlayEl.style.transform = 'translateX(-50%)';
    traceOverlayPosition(reason, {
      caption: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  }

  function updateOverlay(originalText, translatedText) {
    if (!overlayEl) createOverlay();
    markTreeNoTranslate(overlayEl);
    const originalLang = detectedTextLanguage(originalText) || 'en';
    document.getElementById(ORIGINAL_ID)?.setAttribute('lang', originalLang);
    document.getElementById(TRANSLATED_ID)?.setAttribute('lang', settings.targetLanguage);
    lastOriginalText = originalText;
    lastTranslatedText = translatedText;
    applyVisibility();

    const original = document.getElementById(ORIGINAL_ID);
    const translated = document.getElementById(TRANSLATED_ID);
    if (!overlayDrag) {
      applyOverlayStyle();
    }

    if (settings.displayMode === 'original') {
      if (original) {
        original.textContent = originalText;
        original.style.display = 'block';
        original.style.marginBottom = '0';
      }
      if (translated) {
        translated.textContent = '';
        translated.style.display = 'none';
      }
    } else if (settings.displayMode === 'translation') {
      if (original) {
        original.textContent = '';
        original.style.display = 'none';
      }
      if (translated) {
        translated.textContent = translatedText || '\u00a0';
        translated.style.display = translatedText ? 'block' : 'none';
      }
    } else {
      if (original) {
        original.textContent = originalText;
        original.style.display = 'block';
        original.style.marginBottom = '4px';
      }
      if (translated) {
        translated.textContent = translatedText || '\u00a0';
        translated.style.display = 'block';
      }
    }

    if (!overlayDrag) {
      applyOverlayPosition(activeCaption);
    }
  }

  function glossarySupported() {
    return settings.glossaryEnabled
      && settings.targetLanguage.startsWith('zh')
      && Array.isArray(GLOSSARY.terms)
      && GLOSSARY.terms.length > 0;
  }

  function glossaryTarget(entry) {
    if (settings.targetLanguage === 'zh-TW') {
      return entry.zhTW || entry.zhCN || entry.zh || '';
    }
    return entry.zhCN || entry.zh || entry.zhTW || '';
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function termPattern(term) {
    return new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(term)})(?=$|[^A-Za-z0-9])`, 'gi');
  }

  function glossaryCandidates() {
    const candidates = [];
    for (const entry of GLOSSARY.terms) {
      const target = glossaryTarget(entry);
      if (!target) continue;
      const terms = Array.isArray(entry.terms) ? entry.terms : [entry.term];
      for (const term of terms) {
        if (typeof term === 'string' && term.trim().length > 1) {
          candidates.push({ term: term.trim(), target });
        }
      }
    }
    return candidates.sort((a, b) => b.term.length - a.term.length);
  }

  function protectGlossaryTerms(text) {
    if (!glossarySupported()) {
      return { text, replacements: [] };
    }

    let protectedText = text;
    const replacements = [];
    const matchedTerms = new Set();

    for (const candidate of glossaryCandidates()) {
      if (replacements.length >= MAX_GLOSSARY_MATCHES) break;
      const normalized = candidate.term.toLowerCase();
      if (matchedTerms.has(normalized)) continue;

      let found = false;
      protectedText = protectedText.replace(termPattern(candidate.term), (match, prefix) => {
        if (found) return match;
        found = true;
        matchedTerms.add(normalized);
        const placeholder = `PANSUBTERM${replacements.length}`;
        replacements.push({ placeholder, target: candidate.target, term: candidate.term });
        return `${prefix}${placeholder}`;
      });
    }

    if (replacements.length) {
      debug('[PanSub] glossary terms:', replacements.map((item) => item.term).join(', '));
    }
    return { text: protectedText, replacements };
  }

  function restoreGlossaryTerms(text, replacements) {
    let restored = text;
    for (const { placeholder, target } of replacements) {
      restored = restored.replace(new RegExp(placeholder, 'gi'), target);
    }
    return restored;
  }

  function abortException() {
    return new DOMException('Translation cancelled', 'AbortError');
  }

  function cancelActiveTranslation() {
    activeTranslationController?.abort();
    activeTranslationController = null;
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortException());
        return;
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(abortException());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function waitForTranslateSlot(signal) {
    const now = Date.now();
    const throttleWait = Math.max(0, TRANSLATE_MIN_INTERVAL_MS - (now - lastTranslateAt));
    const backoffWait = Math.max(0, translateBackoffUntil - now);
    const wait = Math.max(throttleWait, backoffWait);
    if (wait > 0) {
      await sleep(wait, signal);
    }
    if (signal?.aborted) throw abortException();
    lastTranslateAt = Date.now();
  }

  function translationParams(text) {
    return new URLSearchParams({
      client: 'gtx',
      sl: 'auto',
      tl: settings.targetLanguage,
      dt: 't',
      q: text
    });
  }

  async function fetchTranslationData(text, signal) {
    await waitForTranslateSlot(signal);
    const params = translationParams(text);
    const baseUrl = 'https://translate.googleapis.com/translate_a/single';
    const usePost = text.length > POST_TEXT_LENGTH;
    const requestOptions = { signal };
    if (usePost) {
      Object.assign(requestOptions, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: params.toString()
      });
    }
    return fetch(usePost ? baseUrl : `${baseUrl}?${params.toString()}`, requestOptions);
  }

  function flattenTranslation(data) {
    let translated = '';
    if (data && Array.isArray(data[0])) {
      for (const seg of data[0]) {
        if (seg && typeof seg[0] === 'string') translated += seg[0];
      }
    }
    return translated.trim();
  }

  function cacheKey(text) {
    const glossaryVersion = glossarySupported() ? `glossary-${GLOSSARY.version}` : 'plain';
    return `${settings.targetLanguage}::${glossaryVersion}::${text}`;
  }

  function loadPersistentCache(stored) {
    if (!stored || typeof stored !== 'object') return;
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === 'string') {
        translationCache.set(key, value);
      }
    }
    pruneTranslationCache();
    debug(`[PanSub] loaded ${translationCache.size} cached translations`);
  }

  function pruneTranslationCache() {
    while (translationCache.size > CACHE_LIMIT) {
      const oldestKey = translationCache.keys().next().value;
      translationCache.delete(oldestKey);
    }
  }

  function scheduleCachePersist() {
    if (!settings.cacheEnabled) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const entries = Array.from(translationCache.entries()).slice(-CACHE_LIMIT);
      chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) }, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          console.warn('[PanSub] failed to save translation cache:', error.message);
        }
      });
    }, 1200);
  }

  async function translate(text, signal) {
    if (!settings.cacheEnabled) {
      return requestTranslation(text, signal);
    }

    const key = cacheKey(text);
    if (translationCache.has(key)) {
      return translationCache.get(key);
    }

    const translated = await requestTranslation(text, signal);
    if (translated) {
      translationCache.set(key, translated);
      pruneTranslationCache();
      scheduleCachePersist();
    }
    return translated;
  }

  async function refreshCurrentTranslation() {
    if (debounceTimer) clearTimeout(debounceTimer);
    cancelActiveTranslation();
    const text = lastOriginalText;
    if (!text || sourceAlreadyMatchesTarget(text) || settings.displayMode === 'original') return;

    const currentSeq = ++translateSeq;
    const controller = new AbortController();
    activeTranslationController = controller;
    updateOverlay(text, '');
    try {
      const translated = await translate(text, controller.signal);
      if (translated && currentSeq === translateSeq && text === lastOriginalText) {
        updateOverlay(text, translated);
      }
    } finally {
      if (activeTranslationController === controller) {
        activeTranslationController = null;
      }
    }
  }

  async function requestTranslation(text, signal) {
    const prepared = protectGlossaryTerms(text);
    for (let attempt = 0; attempt <= TRANSLATE_RETRY_DELAYS.length; attempt += 1) {
      try {
        const resp = await fetchTranslationData(prepared.text, signal);
        if (!resp.ok) {
          debug(`[PanSub] translation API returned ${resp.status}`);
          if (resp.status < 500 && resp.status !== 429) {
            return '';
          }
        } else {
          const data = await resp.json();
          const translated = restoreGlossaryTerms(flattenTranslation(data), prepared.replacements);
          if (translated) {
            return translated;
          }
          debug('[PanSub] empty translation result:', data);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return '';
        debug('[PanSub] translation failed:', err);
      }

      const delay = TRANSLATE_RETRY_DELAYS[attempt];
      if (!delay) break;
      translateBackoffUntil = Date.now() + delay;
      try {
        await sleep(delay, signal);
      } catch (err) {
        if (err?.name === 'AbortError') return '';
        throw err;
      }
    }
    return '';
  }

  function clearAudioSubtitle() {
    if (!audioRendered) return;
    audioRendered = false;
    lastAudioSequence = 0;
    lastText = '';
    updateOverlay('', '');
  }

  function applyAudioState(nextState) {
    if (!nextState || (AUDIO_PROTOCOL?.isAudioState && !AUDIO_PROTOCOL.isAudioState(nextState))) return;
    const previousSessionId = audioState.sessionId;
    const previouslyOwnedOverlay = audioOwnsOverlay();
    audioState = nextState;
    const ownsOverlayNow = audioOwnsOverlay();
    if (audioState.sessionId !== previousSessionId) lastAudioSequence = 0;
    if (!previouslyOwnedOverlay && ownsOverlayNow) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      cancelActiveTranslation();
      translateSeq += 1;
      lastText = '';
      lastTranslatedText = '';
      audioRendered = false;
      updateOverlay('', '');
    }
    if (previouslyOwnedOverlay && !ownsOverlayNow) {
      clearAudioSubtitle();
      window.setTimeout(handleCaptionChange, 0);
    }
    createFloatingButton();
    applyFloatingButtonStyle();
    updateFloatingPanel();
  }

  function applyAudioSubtitle(message) {
    if (!settings.enabled || !audioOwnsOverlay()) return;
    if (message.sessionId !== audioState.sessionId) return;
    if (!Number.isInteger(message.sequence) || message.sequence <= lastAudioSequence) return;
    const text = String(message.text || '').trim();
    if (!text) return;
    lastAudioSequence = message.sequence;
    audioRendered = true;
    cancelActiveTranslation();
    translateSeq += 1;
    updateOverlay('', text);
  }

  function handleAudioRuntimeMessage(message) {
    if (message?.type === AUDIO_MESSAGES.STATE_CHANGED) {
      applyAudioState(message.state);
      return false;
    }
    if (message?.type === AUDIO_MESSAGES.SUBTITLE) {
      applyAudioSubtitle(message);
      return false;
    }
    return false;
  }

  function applyNativeCaptionVisibility(caption) {
    if (nativeCaptionEl && nativeCaptionEl !== caption?.el) {
      nativeCaptionEl.style.removeProperty('opacity');
    }
    nativeCaptionEl = caption?.el || null;
    if (!nativeCaptionEl) return;

    if (settings.enabled && settings.hideNativeCaptions) {
      nativeCaptionEl.style.setProperty('opacity', '0', 'important');
    } else {
      nativeCaptionEl.style.removeProperty('opacity');
    }
  }

  function handleCaptionChange() {
    const caption = findCaptionElement();
    if (!caption) return;

    activeCaption = caption;
    attachObserver(caption.el);
    protectCaptionElement(caption.el);
    applyNativeCaptionVisibility(caption);
    applyOverlayPosition(caption);

    const text = caption.el.textContent.trim();
    if (text) {
      lastNativeCaptionAt = Date.now();
      reportNativeCaptionStatus(true);
    }
    if (audioOwnsOverlay()) return;

    if (!settings.enabled) {
      if (debounceTimer) clearTimeout(debounceTimer);
      cancelActiveTranslation();
      translateSeq += 1;
      lastText = '';
      lastTranslatedText = '';
      applyVisibility();
      return;
    }

    if (!text || text === lastText) return;
    lastText = text;
    if (debounceTimer) clearTimeout(debounceTimer);
    cancelActiveTranslation();
    const currentSeq = ++translateSeq;
    debug(`[PanSub] New caption(${caption.mode}): ${text}`);

    if (sourceAlreadyMatchesTarget(text)) {
      debug('[PanSub] caption already matches target language; skipping machine translation:', text);
      updateOverlay('', text);
      return;
    }

    updateOverlay(text, '');

    if (settings.displayMode === 'original') return;

    debounceTimer = setTimeout(async () => {
      const controller = new AbortController();
      activeTranslationController = controller;
      try {
        const translated = await translate(text, controller.signal);
        if (translated && currentSeq === translateSeq && text === lastText) {
          updateOverlay(text, translated);
        } else if (translated) {
          debug('[PanSub] stale translation ignored:', text);
        }
      } finally {
        if (activeTranslationController === controller) {
          activeTranslationController = null;
        }
      }
    }, DEBOUNCE_MS);
  }

  function attachObserver(target) {
    if (observedCaptionEl === target) return;
    captionObserver?.disconnect();
    observedCaptionEl = target;
    protectCaptionElement(target);

    captionObserver = new MutationObserver(() => {
      protectCaptionElement(target);
      handleCaptionChange();
    });
    captionObserver.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function waitForCaption() {
    if (captionPollStarted) return;
    captionPollStarted = true;
    setInterval(() => {
      const caption = findCaptionElement();
      if (caption) {
        if (activeCaption?.el !== caption.el || activeCaption?.mode !== caption.mode) {
          debug(`[PanSub] Found caption element(${caption.mode}):`, caption.el);
        }
        createOverlay();
        createFloatingButton();
        mountExtensionElements();
        handleCaptionChange();
      }
      const hasNativeCaptionText = Boolean(caption?.el?.textContent?.trim());
      if (!hasNativeCaptionText
        && Date.now() - Math.max(captionDetectionStartedAt, lastNativeCaptionAt) >= NATIVE_CAPTION_MISSING_MS) {
        reportNativeCaptionStatus(false);
      }
    }, POLL_MS);
  }

  chrome.runtime.onMessage?.addListener(handleAudioRuntimeMessage);

  chrome.storage.local.get(['pansubEnabled', SETTINGS_KEY, CACHE_KEY], (result) => {
    mergeSettings(result[SETTINGS_KEY], result.pansubEnabled);
    loadPersistentCache(result[CACHE_KEY]);
    if (overlayEl) {
      applyVisibility();
      applyOverlayStyle();
      updateOverlay(lastOriginalText, lastTranslatedText);
    }
    createFloatingButton();
    attachFullscreenListeners();
    mountExtensionElements();
    waitForCaption();
    chrome.runtime.sendMessage({ type: AUDIO_MESSAGES.GET_STATE }, (response) => {
      if (chrome.runtime?.lastError) return;
      if (response?.state) applyAudioState(response.state);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SETTINGS_KEY] || changes.pansubEnabled) {
      const previousSettings = { ...settings };
      const nextSettings = changes[SETTINGS_KEY]?.newValue || settings;
      const nextEnabled = changes.pansubEnabled?.newValue;
      mergeSettings(nextSettings, nextEnabled);
      const shouldRetranslate = previousSettings.targetLanguage !== settings.targetLanguage
        || previousSettings.glossaryEnabled !== settings.glossaryEnabled
        || previousSettings.displayMode !== settings.displayMode;
      if (!settings.enabled) {
        if (debounceTimer) clearTimeout(debounceTimer);
        cancelActiveTranslation();
        translateSeq += 1;
      }
      if (shouldRetranslate) {
        lastTranslatedText = '';
      }
      applyVisibility();
      applyOverlayStyle();
      applyFloatingButtonStyle();
      mountExtensionElements();
      applyNativeCaptionVisibility(activeCaption);
      updateOverlay(lastOriginalText, lastTranslatedText);
      if (shouldRetranslate) {
        refreshCurrentTranslation();
      }
    }
    if (changes[CACHE_KEY]) {
      translationCache.clear();
      loadPersistentCache(changes[CACHE_KEY].newValue);
    }
  });
})();
