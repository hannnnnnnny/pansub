const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function installChromeMock(page) {
  await page.addInitScript(() => {
    const runtimeListeners = [];
    const runtimeMessages = [];
    const localModelCalls = [];
    const permissionRequests = [];
    const store = {
      pansubEnabled: true,
      pansubSettings: {
        enabled: true,
        interfaceLanguage: 'en',
        targetLanguage: 'zh-CN',
        displayMode: 'bilingual',
        subtitlePosition: 'auto',
        subtitleSource: 'auto',
        audioSourceLanguage: 'en-US',
        audioDisclosureAccepted: false,
        audioGoogleFallbackConsent: false
      }
    };

    window.__pansubStore = store;
    window.__pansubOptionsOpened = 0;
    window.__pansubRuntimeMessages = runtimeMessages;
    window.__pansubRuntimeListeners = runtimeListeners;
    window.__pansubLocalModelCalls = localModelCalls;
    window.__pansubPermissionRequests = permissionRequests;
    class MockSpeechRecognition {}
    MockSpeechRecognition.install = async (options) => {
      localModelCalls.push({ api: 'speech', options });
      return true;
    };
    window.SpeechRecognition = MockSpeechRecognition;
    window.Translator = {
      async create(options) {
        localModelCalls.push({ api: 'translator', options });
        return { destroy() {} };
      }
    };
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
      permissions: {
        request(options, callback) {
          permissionRequests.push(options);
          callback?.(true);
          return Promise.resolve(true);
        }
      },
      runtime: {
        lastError: null,
        onMessage: {
          addListener(listener) {
            runtimeListeners.push(listener);
          }
        },
        openOptionsPage(callback) {
          window.__pansubOptionsOpened += 1;
          callback?.();
        },
        sendMessage(message, callback) {
          runtimeMessages.push(message);
          const response = message.type === 'PANSUB_AUDIO_GET_STATE'
            ? {
                ok: true,
                state: {
                  phase: 'available',
                  sessionId: null,
                  tabId: 12,
                  source: 'auto',
                  error: null,
                  detail: null,
                  updatedAt: 1
                }
              }
            : message.type === 'PANSUB_AUDIO_START'
              ? {
                  ok: true,
                  state: {
                    phase: 'preparing',
                    sessionId: 'session-1',
                    tabId: 12,
                    source: 'audio',
                    error: null,
                    detail: null,
                    updatedAt: 2
                  }
                }
              : { ok: true };
          callback?.(response);
          return Promise.resolve(response);
        }
      }
    };
  });
}

async function dispatchRuntimeMessage(page, message) {
  await page.evaluate((payload) => {
    for (const listener of window.__pansubRuntimeListeners) listener(payload, {}, () => {});
  }, message);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
  await installChromeMock(page);
  await page.goto(pathToFileURL(path.join(root, 'popup.html')).toString());
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'PanSub is enabled');

  assert.strictEqual(await page.locator('#audioStart').isVisible(), true);
  await page.click('#audioStart');
  assert.strictEqual(await page.locator('#audioDisclosure').isVisible(), true);
  await page.check('#audioDisclosureAccepted');
  await page.click('#audioConfirmStart');
  await page.waitForFunction(() => window.__pansubRuntimeMessages.some((message) => message.type === 'PANSUB_AUDIO_START'));
  const localModelCalls = await page.evaluate(() => window.__pansubLocalModelCalls);
  assert.strictEqual(localModelCalls.some((call) => call.api === 'speech' && call.options.processLocally === true), true);
  assert.strictEqual(localModelCalls.some((call) => call.api === 'translator' && call.options.targetLanguage === 'zh'), true);
  assert.strictEqual(await page.evaluate(() => window.__pansubStore.pansubSettings.audioDisclosureAccepted), true);

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_STATE_CHANGED',
    state: {
      phase: 'listening',
      sessionId: 'session-1',
      tabId: 12,
      source: 'audio',
      error: null,
      detail: null,
      updatedAt: 3
    }
  });
  assert.strictEqual(await page.locator('#audioStop').isVisible(), true);
  await page.click('#audioStop');
  await page.waitForFunction(() => window.__pansubRuntimeMessages.some((message) => message.type === 'PANSUB_AUDIO_STOP'));

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_STATE_CHANGED',
    state: {
      phase: 'error',
      sessionId: 'session-2',
      tabId: 12,
      source: 'audio',
      error: 'GOOGLE_CONSENT_REQUIRED',
      detail: null,
      updatedAt: 4
    }
  });
  assert.strictEqual(await page.locator('#audioGoogleFallback').isVisible(), true);
  await page.check('#audioGoogleFallbackAccepted');
  await page.click('#audioConfirmFallback');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.audioGoogleFallbackConsent === true);
  const fallbackPermission = await page.evaluate(() => window.__pansubPermissionRequests.at(-1));
  assert.deepStrictEqual(fallbackPermission.origins, ['https://translate.googleapis.com/*']);

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_STATE_CHANGED',
    state: {
      phase: 'available',
      sessionId: null,
      tabId: 12,
      source: 'auto',
      error: null,
      detail: null,
      updatedAt: 5
    }
  });

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
  await page.selectOption('#targetLanguage', 'ja');
  await page.waitForFunction(() => window.__pansubStore.pansubSettings.targetLanguage === 'ja');
  assert.strictEqual(await page.locator('.status-panel').getAttribute('class'), 'status-panel is-off');
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
