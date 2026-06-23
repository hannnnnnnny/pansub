const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

function settings(overrides = {}) {
  return {
    enabled: true,
    interfaceLanguage: 'en',
    targetLanguage: 'zh-CN',
    displayMode: 'translation',
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
    floatingButtonDisabledHosts: [],
    ...overrides
  };
}

async function installChromeMock(page) {
  await page.evaluate((initialSettings) => {
    const NativeMutationObserver = window.MutationObserver;
    const listeners = [];
    const store = {
      pansubEnabled: true,
      pansubSettings: initialSettings,
      pansubCache: {}
    };

    window.__pansubStore = store;
    window.__pansubObserverDisconnects = 0;
    window.MutationObserver = class extends NativeMutationObserver {
      disconnect() {
        window.__pansubObserverDisconnects += 1;
        return super.disconnect();
      }
    };
    window.chrome = {
      storage: {
        local: {
          get(keys, cb) {
            const result = {};
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) result[key] = store[key];
            setTimeout(() => cb(result), 0);
          },
          set(next, cb) {
            const changes = {};
            for (const [key, value] of Object.entries(next)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            listeners.forEach((listener) => listener(changes, 'local'));
            cb?.();
          },
          remove(keys, cb) {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) {
              const oldValue = store[key];
              delete store[key];
              listeners.forEach((listener) => listener({ [key]: { oldValue, newValue: undefined } }, 'local'));
            }
            cb?.();
          }
        },
        onChanged: {
          addListener(listener) {
            listeners.push(listener);
          }
        }
      },
      runtime: {
        sendMessage() {}
      }
    };
  }, settings());
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const translationRequests = [];
  let firstTranslationRequest = null;

  await page.route('https://translate.googleapis.com/**', async (route) => {
    const request = route.request();
    const params = new URLSearchParams(request.postData() || new URL(request.url()).searchParams.toString());
    const source = params.get('q') || '';
    const sourceLanguage = params.get('sl') || '';
    const targetLanguage = params.get('tl') || 'zh-CN';
    translationRequests.push({ source, sourceLanguage, targetLanguage });
    if (source.includes('first')) firstTranslationRequest = request;
    const translated = targetLanguage === 'en'
      ? 'English database subtitle'
      : targetLanguage === 'ja'
      ? '二番目のデータベース字幕'
      : source.includes('replacement')
        ? '替换后的数据库字幕'
      : source.includes('second')
        ? '第二条数据库字幕'
        : '第一条数据库字幕';

    if (source.includes('first')) {
      await page.waitForTimeout(450);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([[[translated, source, null, null]]])
    });
  });

  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#111;color:white;font-family:sans-serif">
        <main id="rightPlayerContainer" style="position:relative;width:900px;height:520px;background:#222;margin:30px auto;overflow:hidden">
          <video class="video-js" style="width:900px;height:520px;display:block"></video>
          <div id="overlayCaption" style="position:absolute;left:140px;right:140px;bottom:50px;font-size:22px;color:white">first database caption</div>
        </main>
      </body>
    </html>`);

  await installChromeMock(page);
  await page.addScriptTag({ path: path.join(root, 'settings.js') });
  await page.addScriptTag({ path: path.join(root, 'glossary.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });

  await page.waitForSelector('#pansub-overlay-lock');
  await page.waitForTimeout(220);

  await page.evaluate(() => {
    document.querySelector('#overlayCaption').textContent = 'second database caption';
  });

  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('第二条数据库字幕'));
  const textAfterRace = await page.locator('#pansub-overlay').textContent();
  assert(textAfterRace.includes('第二条数据库字幕'), 'latest translation should win');
  assert(!textAfterRace.includes('first database caption'), 'translation-only mode should not show English placeholder');
  await page.waitForTimeout(500);
  assert(firstTranslationRequest?.failure(), 'superseded translation request should be aborted');

  await page.evaluate(() => {
    const current = document.querySelector('#overlayCaption');
    const replacement = current.cloneNode(true);
    replacement.textContent = 'replacement database caption';
    current.replaceWith(replacement);
  });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('替换后的数据库字幕'));
  const observerDisconnects = await page.evaluate(() => window.__pansubObserverDisconnects);
  assert(observerDisconnects >= 1, 'replacing the native caption should disconnect the old observer');

  const beforeDrag = await page.locator('#pansub-overlay').boundingBox();
  await page.mouse.move(beforeDrag.x + 30, beforeDrag.y + 16);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 150, beforeDrag.y + 68);
  await page.mouse.up();

  const manualSettings = await page.evaluate(() => window.__pansubStore.pansubSettings);
  assert.strictEqual(manualSettings.subtitlePosition, 'manual', 'dragging should switch to manual position');
  assert(Number.isFinite(manualSettings.overlayManualX), 'manual X should be saved');
  assert(Number.isFinite(manualSettings.overlayManualY), 'manual Y should be saved');

  await page.evaluate(() => {
    const next = {
      ...window.__pansubStore.pansubSettings,
      interfaceLanguage: 'zh-CN',
      targetLanguage: 'ja'
    };
    window.chrome.storage.local.set({ pansubSettings: next, pansubEnabled: true });
  });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('二番目のデータベース字幕'));
  const floatingLabel = await page.locator('#pansub-floating').getAttribute('aria-label');
  assert.strictEqual(floatingLabel, 'PanSub 快捷控制');

  await page.click('#pansub-floating');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pansub-floating-panel')).display !== 'none');
  assert.strictEqual(await page.locator('#pansub-floating-panel').getAttribute('role'), 'dialog');
  await page.waitForFunction(() => document.activeElement?.dataset?.pansubControl === 'enabled');
  await page.click('[data-pansub-action="floatingSettings"]');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#pansub-floating-settings')).display !== 'none');
  assert.strictEqual(await page.locator('#pansub-floating-settings').getAttribute('role'), 'dialog');
  await page.waitForFunction(() => document.activeElement?.dataset?.pansubFloatControl === 'floatingButtonSmall');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.id === 'pansub-floating');

  await page.evaluate(() => {
    const next = { ...window.__pansubStore.pansubSettings, targetLanguage: 'en' };
    window.chrome.storage.local.set({ pansubSettings: next, pansubEnabled: true });
    document.querySelector('#overlayCaption').textContent = '数据库字幕';
  });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('English database subtitle'));
  assert(translationRequests.every((request) => request.sourceLanguage === 'auto'), 'translation requests should auto-detect source language');

  const requestsBeforeDisable = translationRequests.length;
  await page.evaluate(() => {
    const next = {
      ...window.__pansubStore.pansubSettings,
      enabled: false,
      hideNativeCaptions: true
    };
    window.chrome.storage.local.set({ pansubSettings: next, pansubEnabled: false });
    document.querySelector('#overlayCaption').textContent = 'third database caption';
  });
  await page.waitForTimeout(700);
  assert.strictEqual(translationRequests.length, requestsBeforeDisable, 'disabled PanSub should not send translation requests');
  const overlayDisplay = await page.locator('#pansub-overlay').evaluate((el) => getComputedStyle(el).display);
  assert.strictEqual(overlayDisplay, 'none', 'disabled PanSub should hide its overlay');
  const nativeOpacity = await page.locator('#overlayCaption').evaluate((el) => el.style.opacity);
  assert.notStrictEqual(nativeOpacity, '0', 'disabled PanSub should not hide native captions');

  await browser.close();
  console.log('PanSub extension smoke test passed');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
