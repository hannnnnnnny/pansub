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
      'bottom: 80px',
      'left: 50%',
      'transform: translateX(-50%)',
      'max-width: 80%',
      'background: rgba(0,0,0,0.75)',
      'color: #fff',
      'padding: 10px 16px',
      'border-radius: 8px',
      'z-index: 99999',
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
  }

  async function translate(text) {
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      const translated = data && data[0] && data[0][0] && data[0][0][0] ? data[0][0][0] : '';
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
