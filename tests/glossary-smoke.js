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
      cacheEnabled: false,
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
      pansubSettings: settings
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
  let protectedQuery = '';

  await page.route('https://translate.googleapis.com/**', async (route) => {
    const request = route.request();
    const params = new URLSearchParams(request.postData() || new URL(request.url()).searchParams.toString());
    protectedQuery = params.get('q') || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([[[('PANSUBTERM0 links to PANSUBTERM1'), protectedQuery, null, null]]])
    });
  });

  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#111;color:white;font-family:sans-serif">
        <main id="rightPlayerContainer" style="position:relative;width:900px;height:520px;background:#222;margin:30px auto;overflow:hidden">
          <video class="video-js" style="width:900px;height:520px;display:block"></video>
          <div id="overlayCaption" style="position:absolute;left:140px;right:140px;bottom:50px;font-size:22px;color:white">accounts receivable links to primary key</div>
        </main>
      </body>
    </html>`);

  await installChromeMock(page);
  await page.addScriptTag({ path: path.join(root, 'glossary.js') });
  await page.addScriptTag({ path: path.join(root, 'content.js') });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('应收账款'));

  assert(protectedQuery.includes('PANSUBTERM0'), 'glossary should protect the business term');
  assert(protectedQuery.includes('PANSUBTERM1'), 'glossary should protect the database term');
  assert(!protectedQuery.includes('accounts receivable'), 'protected query should not expose the raw matched business term');

  const overlayText = await page.locator('#pansub-overlay').textContent();
  assert(overlayText.includes('应收账款'), 'business term should be restored after translation');
  assert(overlayText.includes('主键'), 'database term should be restored after translation');

  await browser.close();
  console.log('PanSub glossary smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
