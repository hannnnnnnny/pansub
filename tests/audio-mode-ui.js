const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function installChromeMock(page) {
  await page.evaluate(() => {
    const runtimeListeners = [];
    const storageListeners = [];
    const sentMessages = [];
    const store = {
      pansubEnabled: true,
      pansubSettings: {
        ...window.PANSUB_DEFAULT_SETTINGS,
        enabled: true,
        interfaceLanguage: 'en',
        displayMode: 'bilingual',
        subtitleSource: 'auto'
      },
      pansubCache: {}
    };

    window.__pansubRuntimeListeners = runtimeListeners;
    window.__pansubSentMessages = sentMessages;
    window.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = {};
            for (const key of keys) result[key] = store[key];
            setTimeout(() => callback(result), 0);
          },
          set(next, callback) {
            const changes = {};
            for (const [key, value] of Object.entries(next)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            storageListeners.forEach((listener) => listener(changes, 'local'));
            callback?.();
          },
          remove(keys, callback) {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) {
              const oldValue = store[key];
              delete store[key];
              storageListeners.forEach((listener) => listener({ [key]: { oldValue, newValue: undefined } }, 'local'));
            }
            callback?.();
          }
        },
        onChanged: {
          addListener(listener) {
            storageListeners.push(listener);
          }
        }
      },
      runtime: {
        lastError: null,
        onMessage: {
          addListener(listener) {
            runtimeListeners.push(listener);
          }
        },
        sendMessage(message, callback) {
          sentMessages.push(message);
          if (message.type === 'PANSUB_AUDIO_GET_STATE') {
            callback?.({
              ok: true,
              state: {
                phase: 'idle',
                sessionId: null,
                tabId: null,
                source: 'auto',
                error: null,
                detail: null,
                updatedAt: 0
              }
            });
          } else {
            callback?.({ ok: true });
          }
        }
      }
    };
  });
}

async function dispatchRuntimeMessage(page, message) {
  await page.evaluate(async (payload) => {
    for (const listener of window.__pansubRuntimeListeners) {
      await new Promise((resolve) => {
        const result = listener(payload, {}, () => resolve());
        if (result !== true) resolve();
      });
    }
  }, message);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#111;color:white;font-family:sans-serif">
        <main id="rightPlayerContainer" style="position:relative;width:900px;height:520px;background:#222;margin:30px auto;overflow:hidden">
          <video class="video-js" style="width:900px;height:520px;display:block"></video>
          <div id="overlayCaption" style="position:absolute;left:100px;bottom:24px;width:700px;height:40px"></div>
        </main>
      </body>
    </html>`);

  await page.addScriptTag({ path: path.join(root, 'settings.js') });
  await installChromeMock(page);
  await page.addScriptTag({ path: path.join(root, 'glossary.js') });
  await page.addScriptTag({ path: path.join(root, 'glossary-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'audio-mode-protocol.js') });
  await page.addScriptTag({ path: path.join(root, 'audio-mode-state.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });
  await page.waitForSelector('#pansub-floating');
  await page.waitForFunction(() => window.__pansubSentMessages.some((message) => (
    message.type === 'PANSUB_NATIVE_CAPTION_STATUS' && message.hasCaptions === false
  )), null, { timeout: 7000 });

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_STATE_CHANGED',
    state: {
      phase: 'available',
      sessionId: null,
      tabId: 12,
      source: 'auto',
      error: null,
      detail: null,
      updatedAt: 10
    }
  });
  assert.strictEqual(await page.locator('#pansub-floating').getAttribute('data-audio-state'), 'available');

  await page.click('#pansub-floating');
  await page.waitForSelector('[data-pansub-action="audioMode"]', { state: 'visible' });
  assert.strictEqual(await page.locator('[data-pansub-audio="status"]').textContent(), 'No native captions detected');
  await page.click('[data-pansub-action="audioMode"]');
  const sentTypes = await page.evaluate(() => window.__pansubSentMessages.map((message) => message.type));
  assert(sentTypes.includes('PANSUB_OPEN_AUDIO_POPUP'));

  await page.locator('#overlayCaption').evaluate((element) => {
    element.textContent = 'A primary key identifies a database record.';
  });
  await page.waitForTimeout(700);
  assert((await page.locator('#pansub-original').textContent()).includes('primary key'));

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_STATE_CHANGED',
    state: {
      phase: 'listening',
      sessionId: 'session-1',
      tabId: 12,
      source: 'audio',
      error: null,
      detail: null,
      updatedAt: 20
    }
  });
  assert.strictEqual(await page.locator('#pansub-original').textContent(), '', 'Audio Mode should clear native caption work immediately');
  assert.strictEqual((await page.locator('#pansub-translated').textContent()).trim(), '', 'Audio Mode should clear stale native translation immediately');
  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_SUBTITLE',
    sessionId: 'session-1',
    sequence: 4,
    text: '数据库模式',
    final: false
  });
  await page.waitForFunction(() => document.querySelector('#pansub-translated')?.textContent === '数据库模式');
  assert.strictEqual(await page.locator('#pansub-original').textContent(), '');

  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_SUBTITLE',
    sessionId: 'session-old',
    sequence: 5,
    text: '过期会话',
    final: false
  });
  await dispatchRuntimeMessage(page, {
    type: 'PANSUB_AUDIO_SUBTITLE',
    sessionId: 'session-1',
    sequence: 3,
    text: '倒序字幕',
    final: false
  });
  assert.strictEqual(await page.locator('#pansub-translated').textContent(), '数据库模式');

  await page.click('#pansub-floating');
  await page.waitForSelector('[data-pansub-action="audioStop"]', { state: 'visible' });
  await page.click('[data-pansub-action="audioStop"]');
  const finalTypes = await page.evaluate(() => window.__pansubSentMessages.map((message) => message.type));
  assert(finalTypes.includes('PANSUB_AUDIO_STOP'));

  await browser.close();
  console.log('Audio mode content UI tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
