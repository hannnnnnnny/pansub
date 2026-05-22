(() => {
  const CAPTION_SELECTOR = '#dockedCaptionText';
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

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      overlayEl = document.getElementById(OVERLAY_ID);
      return;
    }
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.style.cssText = [
      'position: fixed',
      'bottom: 96px',
      'left: 50%',
      'transform: translateX(-50%)',
      'max-width: 78%',
      'min-width: 240px',
      'background: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.78))',
      'backdrop-filter: blur(10px)',
      '-webkit-backdrop-filter: blur(10px)',
      'color: #fff',
      'padding: 12px 22px 14px',
      'border-radius: 12px',
      'border: 1px solid rgba(255,255,255,0.08)',
      'box-shadow: 0 8px 28px rgba(0,0,0,0.45)',
      'z-index: 99999',
      'pointer-events: none',
      'text-align: center',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif',
      'line-height: 1.45',
      'opacity: 0',
      'transition: opacity 0.2s ease'
    ].join(';');

    const original = document.createElement('div');
    original.id = ORIGINAL_ID;
    original.style.cssText = [
      'font-size: 14px',
      'font-weight: 400',
      'letter-spacing: 0.2px',
      'color: rgba(255,255,255,0.72)',
      'margin-bottom: 6px',
      'text-shadow: 0 1px 2px rgba(0,0,0,0.6)'
    ].join(';');

    const translated = document.createElement('div');
    translated.id = TRANSLATED_ID;
    translated.style.cssText = [
      'font-size: 22px',
      'font-weight: 600',
      'letter-spacing: 0.5px',
      'color: #fff',
      'text-shadow: 0 2px 4px rgba(0,0,0,0.75)'
    ].join(';');

    overlayEl.appendChild(original);
    overlayEl.appendChild(translated);
    document.body.appendChild(overlayEl);
    injectStyles();
    attachFullscreenHandler();
    applyVisibility();
  }

  function getFullscreenElement() {
    return document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement
      || document.msFullscreenElement
      || null;
  }

  function relocateOverlay() {
    if (!overlayEl) return;
    const fsEl = getFullscreenElement();
    const target = fsEl || document.body;
    if (overlayEl.parentNode !== target) {
      target.appendChild(overlayEl);
    }
  }

  function attachFullscreenHandler() {
    if (attachFullscreenHandler._done) return;
    attachFullscreenHandler._done = true;
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
      .forEach(evt => document.addEventListener(evt, relocateOverlay));
  }

  function injectStyles() {
    if (document.getElementById('pansub-style')) return;
    const style = document.createElement('style');
    style.id = 'pansub-style';
    style.textContent = `
      #${OVERLAY_ID}.pansub-visible { opacity: 1; }
      /* 隐藏 Panopto 自带的字幕条，避免与 PanSub 重叠 */
      #dockedCaptionText,
      .event-tab-caption,
      .captions-display,
      [class*="captionContainer"] {
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
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
    if (overlayEl) overlayEl.classList.add('pansub-visible');
  }

  async function translate(text) {
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      let translated = '';
      if (data && Array.isArray(data[0])) {
        for (const seg of data[0]) {
          if (seg && typeof seg[0] === 'string') translated += seg[0];
        }
      }
      translated = translated.trim();
      translationCache.set(text, translated);
      return translated;
    } catch (err) {
      console.error('[PanSub] 翻译失败:', err);
      return '';
    }
  }

  function handleCaptionChange() {
    const el = document.querySelector(CAPTION_SELECTOR);
    if (!el) return;
    const text = el.textContent.trim();
    if (!text || text === lastText) return;
    lastText = text;
    console.log(`[PanSub] 新字幕: ${text}`);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const translated = await translate(text);
      if (translated) {
        updateOverlay(text, translated);
      }
    }, DEBOUNCE_MS);
  }

  function attachObserver(target) {
    const observer = new MutationObserver(() => {
      handleCaptionChange();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
    handleCaptionChange();
  }

  function waitForCaption() {
    const intervalId = setInterval(() => {
      const el = document.querySelector(CAPTION_SELECTOR);
      if (el) {
        clearInterval(intervalId);
        createOverlay();
        attachObserver(el);
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
