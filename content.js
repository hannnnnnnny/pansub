(() => {
  // 不同 Panopto 部署/播放器用的字幕元素不一样，按优先级匹配第一个存在的
  const CAPTION_SELECTORS = [
    '#dockedCaptionText',
    '#captionDisplay',
    '.captionDisplay',
    '.captions-display',
    '.captionWrapper',
    '.captionsArea',
    '.captionItem',
    '[class*="captionText"]',
    '[class*="captionContent"]',
    '[data-captions]'
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
  let activeCaptionEl = null;

  function findCaptionElement() {
    for (const sel of CAPTION_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 0) {
        return el;
      }
    }
    // 兜底：返回第一个存在但暂时为空的
    for (const sel of CAPTION_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
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
      /* 字幕元素本身的隐藏交给 hideNativeCaption() 在运行时按真实匹配到的元素来做。 */
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
        console.warn('[PanSub] 翻译结果为空，原始返回：', data);
        return '';
      }
      translationCache.set(text, translated);
      return translated;
    } catch (err) {
      console.error('[PanSub] 翻译失败:', err);
      return '';
    }
  }

  let translateSeq = 0;

  function handleCaptionChange() {
    const el = activeCaptionEl || findCaptionElement();
    if (!el) return;
    const text = el.textContent.trim();
    if (!text || text === lastText) return;
    lastText = text;
    console.log(`[PanSub] 新字幕: ${text}`);

    // 先把英文铺上去，让 overlay 立刻可见；中文等翻译回来再补
    updateOverlay(text, '');

    if (debounceTimer) clearTimeout(debounceTimer);
    const mySeq = ++translateSeq;
    debounceTimer = setTimeout(async () => {
      const translated = await translate(text);
      // 期间又有新字幕进来了，丢弃这次的结果，避免旧翻译覆盖新字幕
      if (mySeq !== translateSeq) return;
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
      const el = findCaptionElement();
      if (el) {
        clearInterval(intervalId);
        activeCaptionEl = el;
        console.log('[PanSub] 找到字幕元素:', el);
        createOverlay();
        hideNativeCaption(el);
        attachObserver(el);
        // 同时观察 body，万一字幕元素被替换/重建
        observeBodyForReplacement();
      }
    }, POLL_MS);
  }

  function hideNativeCaption(el) {
    // 只隐藏字幕"文字渲染容器"，尽量不波及外层控制条/设置菜单。
    // 找到最近的合理祖先（视觉上的字幕条），通常是显式定位的盒子。
    try {
      el.style.setProperty('opacity', '0', 'important');
      // 同时把直接父节点也淡化，处理那种父容器有黑底的情况
      const parent = el.parentElement;
      if (parent && parent.id !== OVERLAY_ID) {
        const cs = getComputedStyle(parent);
        if (cs.position === 'absolute' || cs.position === 'fixed') {
          parent.style.setProperty('opacity', '0', 'important');
        }
      }
    } catch (_) {}
  }

  function observeBodyForReplacement() {
    const bodyObserver = new MutationObserver(() => {
      if (activeCaptionEl && !document.body.contains(activeCaptionEl)) {
        const el = findCaptionElement();
        if (el && el !== activeCaptionEl) {
          activeCaptionEl = el;
          console.log('[PanSub] 字幕元素被替换，重新挂载:', el);
          attachObserver(el);
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
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
