const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

function settings(overrides = {}) {
  return {
    enabled: true,
    interfaceLanguage: 'en',
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
    floatingButtonDisabledHosts: [],
    ...overrides
  };
}

async function installChromeMock(page) {
  await page.addInitScript((initialSettings) => {
    const listeners = [];
    const store = {
      pansubEnabled: initialSettings.enabled,
      pansubSettings: initialSettings,
      pansubCache: { old: '旧缓存' }
    };

    window.__pansubStore = store;
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
      }
    };
  }, settings({
    subtitlePosition: 'manual',
    overlayManualX: 0.3,
    overlayManualY: 0.4
  }));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installChromeMock(page);

  await page.goto(pathToFileURL(path.join(root, 'options.html')).toString());
  await page.waitForSelector('#interfaceLanguage');
  assert.strictEqual(await page.title(), 'PanSub Settings');

  await page.selectOption('#interfaceLanguage', 'zh-CN');
  await page.waitForFunction(() => document.title === 'PanSub 设置');
  const pageHeading = await page.locator('h2').textContent();
  assert.strictEqual(pageHeading, '课程字幕控制');

  await page.fill('#floatingButtonDisabledHosts', 'auckland.au.panopto.com\nexample.panopto.com');
  await page.dispatchEvent('#floatingButtonDisabledHosts', 'input');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.floatingButtonDisabledHosts.length === 2);
  const storedHosts = await page.evaluate(() => window.__pansubStore.pansubSettings.floatingButtonDisabledHosts);
  assert.deepStrictEqual(storedHosts, ['auckland.au.panopto.com', 'example.panopto.com']);

  await page.click('#resetSubtitlePosition');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.subtitlePosition === 'auto');
  const resetPosition = await page.evaluate(() => window.__pansubStore.pansubSettings);
  assert.strictEqual(resetPosition.overlayManualX, null);
  assert.strictEqual(resetPosition.overlayManualY, null);

  await page.click('#clearTranslationCache');
  await page.waitForFunction(() => !('pansubCache' in window.__pansubStore));

  await page.click('#reset');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.interfaceLanguage === 'zh-CN');
  const resetSettings = await page.evaluate(() => window.__pansubStore.pansubSettings);
  assert.strictEqual(resetSettings.enabled, true);
  assert.strictEqual(resetSettings.displayMode, 'bilingual');

  await browser.close();
  console.log('PanSub options smoke test passed');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
