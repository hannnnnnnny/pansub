(() => {
  const CAPTION_TARGETS = [
    { selector: '#overlayCaption', mode: 'overlay' },
    { selector: '#dockedCaptionText', mode: 'docked' }
  ];

  const OVERLAY_ID = 'pansub-overlay';
  const FLOATING_ID = 'pansub-floating';
  const ORIGINAL_ID = 'pansub-original';
  const TRANSLATED_ID = 'pansub-translated';
  const SETTINGS_KEY = 'pansubSettings';
  const CACHE_KEY = 'pansubCache';
  const DEBOUNCE_MS = 150;
  const POLL_MS = 500;
  const CACHE_LIMIT = 500;
  const MAX_GLOSSARY_MATCHES = 8;
  const GLOSSARY = window.PANSUB_GLOSSARY || { version: 'none', terms: [] };

  const DEFAULT_SETTINGS = {
    enabled: true,
    interfaceLanguage: navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en',
    targetLanguage: 'zh-CN',
    displayMode: 'bilingual',
    subtitlePosition: 'auto',
    fontSize: 24,
    originalFontSize: 15,
    maxWidth: 80,
    backgroundOpacity: 76,
    hideNativeCaptions: false,
    glossaryEnabled: true,
    cacheEnabled: true,
    debugLogs: true,
    floatingButtonEnabled: true,
    floatingButtonSide: 'right',
    floatingButtonOpacity: 78,
    floatingButtonHoverOnly: false
  };

  const translationCache = new Map();
  let settings = { ...DEFAULT_SETTINGS };
  let lastText = '';
  let lastOriginalText = '';
  let lastTranslatedText = '';
  let debounceTimer = null;
  let persistTimer = null;
  let overlayEl = null;
  let floatingEl = null;
  let activeCaption = null;
  let nativeCaptionEl = null;
  let captionPollStarted = false;
  const observedCaptionEls = new WeakSet();

  function debug(...args) {
    if (settings.debugLogs) console.log(...args);
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

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden';
  }

  function findCaptionElement() {
    for (const target of CAPTION_TARGETS) {
      const el = document.querySelector(target.selector);
      if (el && el.textContent.trim() && isVisible(el)) {
        return { ...target, el };
      }
    }

    for (const target of CAPTION_TARGETS) {
      const el = document.querySelector(target.selector);
      if (el && isVisible(el)) {
        return { ...target, el };
      }
    }

    return null;
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      overlayEl = document.getElementById(OVERLAY_ID);
      return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;

    const original = document.createElement('div');
    original.id = ORIGINAL_ID;

    const translated = document.createElement('div');
    translated.id = TRANSLATED_ID;

    overlayEl.appendChild(original);
    overlayEl.appendChild(translated);
    document.body.appendChild(overlayEl);

    applyVisibility();
    applyOverlayStyle();
    applyOverlayPosition(activeCaption);

    if (!createOverlay._listenersAttached) {
      createOverlay._listenersAttached = true;
      window.addEventListener('resize', () => applyOverlayPosition(activeCaption));
      window.addEventListener('scroll', () => applyOverlayPosition(activeCaption), true);
    }
  }

  function createFloatingButton() {
    if (document.getElementById(FLOATING_ID)) {
      floatingEl = document.getElementById(FLOATING_ID);
      applyFloatingButtonStyle();
      return;
    }

    floatingEl = document.createElement('button');
    floatingEl.id = FLOATING_ID;
    floatingEl.type = 'button';
    floatingEl.textContent = 'P';
    floatingEl.title = 'Toggle PanSub subtitles';
    floatingEl.addEventListener('click', () => {
      settings.enabled = !settings.enabled;
      chrome.storage.local.set({
        [SETTINGS_KEY]: settings,
        pansubEnabled: settings.enabled
      });
      applyVisibility();
      applyFloatingButtonStyle();
    });
    document.body.appendChild(floatingEl);
    applyFloatingButtonStyle();
  }

  function applyVisibility() {
    if (!overlayEl) return;
    overlayEl.style.display = settings.enabled ? 'block' : 'none';
  }

  function applyFloatingButtonStyle() {
    if (!floatingEl) return;
    const visible = settings.floatingButtonEnabled;
    const alpha = clamp(settings.floatingButtonOpacity, 20, 100) / 100;
    const side = settings.floatingButtonSide === 'left' ? 'left' : 'right';
    const awaySide = side === 'left' ? 'right' : 'left';
    floatingEl.style.cssText = [
      'position: fixed',
      'top: 50%',
      `${side}: 18px`,
      `${awaySide}: auto`,
      'width: 44px',
      'height: 44px',
      'border: 0',
      'border-radius: 50%',
      `background: rgba(${settings.enabled ? '47,109,246' : '93,103,118'},${alpha})`,
      'color: #fff',
      'font: 800 18px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'box-shadow: 0 10px 24px rgba(0,0,0,0.26)',
      'z-index: 2147483647',
      'cursor: pointer',
      'pointer-events: auto',
      'transform: translateY(-50%)',
      settings.floatingButtonHoverOnly ? 'opacity: 0.2' : 'opacity: 1',
      'transition: opacity .16s ease, transform .16s ease, background .16s ease',
      visible ? 'display: block' : 'display: none'
    ].join(';');

    floatingEl.onmouseenter = () => {
      floatingEl.style.opacity = '1';
      floatingEl.style.transform = 'translateY(-50%) scale(1.04)';
    };
    floatingEl.onmouseleave = () => {
      floatingEl.style.opacity = settings.floatingButtonHoverOnly ? '0.2' : '1';
      floatingEl.style.transform = 'translateY(-50%)';
    };
  }

  function applyOverlayStyle() {
    if (!overlayEl) return;

    const alpha = clamp(settings.backgroundOpacity, 0, 100) / 100;
    overlayEl.style.cssText = [
      'position: fixed',
      'left: 50%',
      'transform: translateX(-50%)',
      `max-width: ${clamp(settings.maxWidth, 40, 96)}%`,
      `background: rgba(0,0,0,${alpha})`,
      'color: #fff',
      'padding: 10px 16px',
      'border-radius: 8px',
      'z-index: 2147483647',
      'pointer-events: none',
      'text-align: center',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif',
      'line-height: 1.35',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.28)'
    ].join(';');

    const original = document.getElementById(ORIGINAL_ID);
    const translated = document.getElementById(TRANSLATED_ID);
    if (original) {
      original.style.cssText = [
        `font-size: ${clamp(settings.originalFontSize, 10, 24)}px`,
        'opacity: 0.72',
        'margin-bottom: 4px'
      ].join(';');
    }
    if (translated) {
      translated.style.cssText = [
        `font-size: ${clamp(settings.fontSize, 14, 42)}px`,
        'font-weight: 650',
        'color: #fff'
      ].join(';');
    }
  }

  function applyOverlayPosition(caption) {
    if (!overlayEl) return;

    const position = settings.subtitlePosition;
    if (position === 'page-bottom') {
      setFixedBottom(32);
      return;
    }
    if (position === 'video-bottom') {
      setFixedBottom(80);
      return;
    }
    if (position === 'follow-caption' && caption) {
      setNearCaption(caption.el);
      return;
    }
    if (!caption || caption.mode === 'overlay') {
      setFixedBottom(80);
      return;
    }
    setFixedBottom(120);
  }

  function setFixedBottom(bottom) {
    overlayEl.style.top = 'auto';
    overlayEl.style.bottom = `${bottom}px`;
    overlayEl.style.left = '50%';
    overlayEl.style.transform = 'translateX(-50%)';
  }

  function setNearCaption(el) {
    const rect = el.getBoundingClientRect();
    const overlayHeight = overlayEl.offsetHeight || 64;
    const left = clamp(rect.left + rect.width / 2, 120, window.innerWidth - 120);
    const top = Math.max(12, rect.top - overlayHeight - 10);
    overlayEl.style.top = `${top}px`;
    overlayEl.style.bottom = 'auto';
    overlayEl.style.left = `${left}px`;
    overlayEl.style.transform = 'translateX(-50%)';
  }

  function updateOverlay(originalText, translatedText) {
    if (!overlayEl) createOverlay();
    lastOriginalText = originalText;
    lastTranslatedText = translatedText;

    const original = document.getElementById(ORIGINAL_ID);
    const translated = document.getElementById(TRANSLATED_ID);
    applyOverlayStyle();

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
        translated.textContent = translatedText || originalText;
        translated.style.display = 'block';
      }
    } else {
      if (original) {
        original.textContent = originalText;
        original.style.display = 'block';
        original.style.marginBottom = '4px';
      }
      if (translated) {
        translated.textContent = translatedText;
        translated.style.display = 'block';
      }
    }

    applyOverlayPosition(activeCaption);
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
    debug(`[PanSub] loaded ${translationCache.size} cached translations`);
  }

  function scheduleCachePersist() {
    if (!settings.cacheEnabled) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const entries = Array.from(translationCache.entries()).slice(-CACHE_LIMIT);
      chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
    }, 1200);
  }

  async function translate(text) {
    if (!settings.cacheEnabled) {
      return requestTranslation(text);
    }

    const key = cacheKey(text);
    if (translationCache.has(key)) {
      return translationCache.get(key);
    }

    const translated = await requestTranslation(text);
    if (translated) {
      translationCache.set(key, translated);
      scheduleCachePersist();
    }
    return translated;
  }

  async function requestTranslation(text) {
    const prepared = protectGlossaryTerms(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(settings.targetLanguage)}&dt=t&q=${encodeURIComponent(prepared.text)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[PanSub] translation API returned ${resp.status}`);
        return '';
      }
      const data = await resp.json();
      let translated = '';
      if (data && Array.isArray(data[0])) {
        for (const seg of data[0]) {
          if (seg && typeof seg[0] === 'string') translated += seg[0];
        }
      }
      translated = restoreGlossaryTerms(translated.trim(), prepared.replacements);
      if (!translated) {
        console.warn('[PanSub] empty translation result:', data);
        return '';
      }
      return translated;
    } catch (err) {
      console.error('[PanSub] translation failed:', err);
      return '';
    }
  }

  function applyNativeCaptionVisibility(caption) {
    if (nativeCaptionEl && nativeCaptionEl !== caption?.el) {
      nativeCaptionEl.style.removeProperty('opacity');
    }
    nativeCaptionEl = caption?.el || null;
    if (!nativeCaptionEl) return;

    if (settings.hideNativeCaptions) {
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
    applyNativeCaptionVisibility(caption);
    applyOverlayPosition(caption);

    const text = caption.el.textContent.trim();
    if (!text || text === lastText) return;
    lastText = text;
    debug(`[PanSub] New caption(${caption.mode}): ${text}`);
    updateOverlay(text, '');

    if (settings.displayMode === 'original') return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const translated = await translate(text);
      if (translated) {
        updateOverlay(text, translated);
      }
    }, DEBOUNCE_MS);
  }

  function attachObserver(target) {
    if (observedCaptionEls.has(target)) return;
    observedCaptionEls.add(target);

    const observer = new MutationObserver(() => {
      handleCaptionChange();
    });
    observer.observe(target, {
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
        handleCaptionChange();
      }
    }, POLL_MS);
  }

  chrome.storage.local.get(['pansubEnabled', SETTINGS_KEY, CACHE_KEY], (result) => {
    mergeSettings(result[SETTINGS_KEY], result.pansubEnabled);
    loadPersistentCache(result[CACHE_KEY]);
    if (overlayEl) {
      applyVisibility();
      applyOverlayStyle();
      updateOverlay(lastOriginalText, lastTranslatedText);
    }
    createFloatingButton();
    waitForCaption();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SETTINGS_KEY] || changes.pansubEnabled) {
      const nextSettings = changes[SETTINGS_KEY]?.newValue || settings;
      const nextEnabled = changes.pansubEnabled?.newValue;
      mergeSettings(nextSettings, nextEnabled);
      applyVisibility();
      applyOverlayStyle();
      applyFloatingButtonStyle();
      applyNativeCaptionVisibility(activeCaption);
      updateOverlay(lastOriginalText, lastTranslatedText);
    }
  });
})();
