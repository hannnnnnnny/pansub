(() => {
  const CAPTION_TARGETS = [
    { selector: '#overlayCaption', mode: 'overlay' },
    { selector: '#dockedCaptionText', mode: 'docked' }
  ];
  const OVERLAY_ID = 'pansub-overlay';
  const ORIGINAL_ID = 'pansub-original';
  const TRANSLATED_ID = 'pansub-translated';
  const DEBOUNCE_MS = 600;
  const POLL_MS = 500;

  const translationCache = new Map();
  let lastText = '';
  let debounceTimer = null;
  let overlayEl = null;
  let enabled = true;
  let activeCaption = null;
  const observedCaptionEls = new WeakSet();

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
    overlayEl.style.cssText = [
      'position: fixed',
      'bottom: 80px',
      'left: 50%',
      'transform: translateX(-50%)',
      'max-width: 80%',
      'background: rgba(0,0,0,0.75)',
      'color: #fff',
      'padding: 10px 16px',
      'border-radius: 8px',
      'z-index: 2147483647',
      'pointer-events: none',
      'text-align: center',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'line-height: 1.4'
    ].join(';');

    const original = document.createElement('div');
    original.id = ORIGINAL_ID;
    original.style.cssText = 'font-size: 14px; opacity: 0.7; margin-bottom: 4px;';

    const translated = document.createElement('div');
    translated.id = TRANSLATED_ID;
    translated.style.cssText = 'font-size: 20px; color: #fff;';

    overlayEl.appendChild(original);
    overlayEl.appendChild(translated);
    document.body.appendChild(overlayEl);
    applyVisibility();
    applyOverlayPosition(activeCaption);

    if (!createOverlay._listenersAttached) {
      createOverlay._listenersAttached = true;
      window.addEventListener('resize', () => applyOverlayPosition(activeCaption));
      window.addEventListener('scroll', () => applyOverlayPosition(activeCaption), true);
    }
  }

  function applyVisibility() {
    if (!overlayEl) return;
    overlayEl.style.display = enabled ? 'block' : 'none';
  }

  function updateOverlay(originalText, translatedText) {
    if (!overlayEl) createOverlay();
    const o = document.getElementById(ORIGINAL_ID);
    const t = document.getElementById(TRANSLATED_ID);
    if (o) o.textContent = originalText;
    if (t) t.textContent = translatedText;
    applyOverlayPosition(activeCaption);
  }

  function applyOverlayPosition(caption) {
    if (!overlayEl) return;

    if (!caption || caption.mode === 'overlay') {
      overlayEl.style.top = 'auto';
      overlayEl.style.bottom = '80px';
      overlayEl.style.left = '50%';
      overlayEl.style.transform = 'translateX(-50%)';
      overlayEl.style.maxWidth = '80%';
      return;
    }

    overlayEl.style.top = 'auto';
    overlayEl.style.bottom = '120px';
    overlayEl.style.left = '50%';
    overlayEl.style.transform = 'translateX(-50%)';
    overlayEl.style.maxWidth = '80%';
  }

  async function translate(text) {
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[PanSub] 翻译接口返回 ${resp.status}`);
        return '';
      }
      const data = await resp.json();
      let translated = '';
      if (data && Array.isArray(data[0])) {
        for (const seg of data[0]) {
          if (seg && typeof seg[0] === 'string') translated += seg[0];
        }
      }
      translated = translated.trim();
      if (!translated) {
        console.warn('[PanSub] 翻译结果为空:', data);
        return '';
      }
      translationCache.set(text, translated);
      return translated;
    } catch (err) {
      console.error('[PanSub] 翻译失败:', err);
      return '';
    }
  }

  function handleCaptionChange() {
    const caption = findCaptionElement();
    if (!caption) return;

    activeCaption = caption;
    attachObserver(caption.el);
    applyOverlayPosition(caption);

    const el = caption.el;
    const text = el.textContent.trim();
    if (!text || text === lastText) return;
    lastText = text;
    console.log(`[PanSub] 新字幕(${caption.mode}): ${text}`);
    updateOverlay(text, '');

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
    setInterval(() => {
      const caption = findCaptionElement();
      if (caption) {
        if (activeCaption?.el !== caption.el || activeCaption?.mode !== caption.mode) {
          console.log(`[PanSub] 找到字幕元素(${caption.mode}):`, caption.el);
        }
        createOverlay();
        handleCaptionChange();
      }
    }, POLL_MS);
  }

  chrome.storage.local.get(['pansubEnabled'], (result) => {
    enabled = result.pansubEnabled !== false;
    if (overlayEl) applyVisibility();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pansubEnabled) {
      enabled = changes.pansubEnabled.newValue !== false;
      applyVisibility();
    }
  });

  waitForCaption();
})();
