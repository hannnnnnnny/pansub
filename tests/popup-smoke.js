const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function installChromeMock(page) {
  await page.addInitScript(() => {
    const store = {
      pansubEnabled: true,
      pansubSettings: {
        enabled: true,
        interfaceLanguage: 'en',
        targetLanguage: 'zh-CN',
        displayMode: 'bilingual',
        subtitlePosition: 'auto'
      }
    };

    window.__pansubStore = store;
    window.__pansubOptionsOpened = 0;
    window.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = {};
            for (const key of keys) result[key] = store[key];
            setTimeout(() => callback(result), 0);
          },
          set(next, callback) {
            Object.assign(store, next);
            callback?.();
          }
        }
      },
      runtime: {
        lastError: null,
        openOptionsPage(callback) {
          window.__pansubOptionsOpened += 1;
          callback?.();
        },
        sendMessage() {}
      }
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
  await installChromeMock(page);
  await page.goto(pathToFileURL(path.join(root, 'popup.html')).toString());
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'PanSub is enabled');

  await page.selectOption('#interfaceLanguage', 'zh-CN');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'PanSub 已启用');
  assert.strictEqual(await page.locator('html').getAttribute('lang'), 'zh-CN');
  assert.strictEqual(await page.getByLabel('显示字幕').getAttribute('id'), 'enabled');

  await page.uncheck('#enabled');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === '已关闭');
  const storedEnabled = await page.evaluate(() => window.__pansubStore.pansubSettings.enabled);
  assert.strictEqual(storedEnabled, false);

  await page.selectOption('#displayMode', 'translation');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.displayMode === 'translation');
  await page.click('#openOptions');
  const optionsOpened = await page.evaluate(() => window.__pansubOptionsOpened);
  assert.strictEqual(optionsOpened, 1);

  await browser.close();
  console.log('PanSub popup smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
