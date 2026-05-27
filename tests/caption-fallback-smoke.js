const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function installChromeMock(page) {
  await page.evaluate(() => {
    const listeners = [];
    const settings = {
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
      floatingButtonDisabledHosts: []
    };
    const store = {
      pansubEnabled: true,
      pansubSettings: settings,
      pansubCache: {}
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
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  await page.route('https://translate.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([[[('回退字幕识别成功'), 'fallback accounting caption', null, null]]])
    });
  });

  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#111;color:white;font-family:sans-serif">
        <aside style="position:absolute;left:0;top:0;width:220px;height:760px;background:#fff;color:#111">
          <div class="caption-transcript-row">This transcript row should not be selected.</div>
        </aside>
        <main id="rightPlayerContainer" style="position:relative;width:840px;height:500px;background:#222;margin:40px 0 0 280px;overflow:hidden">
          <video class="video-js" style="width:840px;height:500px;display:block"></video>
          <div class="panopto-caption-line" style="position:absolute;left:160px;right:160px;bottom:48px;font-size:22px;color:white">fallback accounting caption</div>
        </main>
      </body>
    </html>`);

  await installChromeMock(page);
  await page.addScriptTag({ path: path.join(root, 'glossary.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('回退字幕识别成功'));

  const selectedText = await page.locator('#pansub-overlay').textContent();
  assert(!selectedText.includes('transcript row'), 'fallback should ignore transcript/sidebar captions');

  await browser.close();
  console.log('PanSub fallback caption smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
