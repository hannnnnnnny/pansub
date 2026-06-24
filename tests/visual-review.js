const path = require('path');
const os = require('os');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(os.tmpdir(), 'pansub-visual-review');

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
    overlayTheme: 'glass',
    overlayFontFamily: 'system',
    subtitleColor: '#ffffff',
    originalColor: '#dbeafe',
    overlayBackgroundColor: '#111827',
    overlayBorderColor: '#6ee7c8',
    overlayLocked: false,
    overlayManualX: null,
    overlayManualY: null,
    hideNativeCaptions: false,
    glossaryEnabled: true,
    cacheEnabled: true,
    debugLogs: false,
    floatingButtonEnabled: true,
    floatingButtonSide: 'right',
    floatingButtonOpacity: 88,
    floatingButtonHoverOnly: false,
    floatingButtonX: null,
    floatingButtonY: null,
    floatingButtonSmall: false,
    floatingButtonDisabledHosts: [],
    ...overrides
  };
}

async function installChromeMock(page, initialSettings = settings()) {
  await page.addInitScript((storedSettings) => {
    const store = { pansubEnabled: storedSettings.enabled, pansubSettings: storedSettings, pansubCache: {} };
    window.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = {};
            for (const key of (Array.isArray(keys) ? keys : [keys])) result[key] = store[key];
            setTimeout(() => callback(result), 0);
          },
          set(next, callback) { Object.assign(store, next); callback?.(); },
          remove(keys, callback) {
            for (const key of (Array.isArray(keys) ? keys : [keys])) delete store[key];
            callback?.();
          }
        },
        onChanged: { addListener() {} }
      },
      runtime: { lastError: null, openOptionsPage(callback) { callback?.(); }, sendMessage() {} }
    };
  }, initialSettings);
}

async function installRuntimeChromeMock(page, initialSettings = settings()) {
  await page.evaluate((storedSettings) => {
    const listeners = [];
    const store = { pansubEnabled: storedSettings.enabled, pansubSettings: storedSettings, pansubCache: {} };
    window.chrome = {
      storage: {
        local: {
          get(keys, callback) {
            const result = {};
            for (const key of (Array.isArray(keys) ? keys : [keys])) result[key] = store[key];
            setTimeout(() => callback(result), 0);
          },
          set(next, callback) {
            const changes = {};
            for (const [key, value] of Object.entries(next)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            listeners.forEach((listener) => listener(changes, 'local'));
            callback?.();
          },
          remove(keys, callback) {
            for (const key of (Array.isArray(keys) ? keys : [keys])) delete store[key];
            callback?.();
          }
        },
        onChanged: { addListener(listener) { listeners.push(listener); } }
      },
      runtime: { sendMessage() {} }
    };
  }, initialSettings);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const optionsPage = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  await installChromeMock(optionsPage);
  await optionsPage.goto(pathToFileURL(path.join(root, 'options.html')).toString());
  await optionsPage.waitForSelector('body:not(.is-loading)');
  await optionsPage.waitForTimeout(500);
  const sectionOpacity = await optionsPage.evaluate(() => Object.fromEntries(
    Array.from(document.querySelectorAll('.group')).map((section) => [section.id, getComputedStyle(section).opacity])
  ));
  if (Object.values(sectionOpacity).some((opacity) => opacity !== '1')) {
    throw new Error(`Visual sections are not fully visible: ${JSON.stringify(sectionOpacity)}`);
  }
  await optionsPage.screenshot({ path: path.join(outputDir, 'options-desktop.png'), fullPage: true });

  await optionsPage.keyboard.press('Control+K');
  await optionsPage.waitForSelector('#commandPalette:not([hidden])');
  await optionsPage.waitForTimeout(250);
  await optionsPage.screenshot({ path: path.join(outputDir, 'options-command.png') });

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await installChromeMock(mobilePage, settings({ interfaceLanguage: 'zh-CN' }));
  await mobilePage.goto(pathToFileURL(path.join(root, 'options.html')).toString());
  await mobilePage.waitForSelector('body:not(.is-loading)');
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(outputDir, 'options-mobile.png'), fullPage: true });

  const popupPage = await browser.newPage({ viewport: { width: 380, height: 620 }, deviceScaleFactor: 1 });
  await installChromeMock(popupPage, settings({ interfaceLanguage: 'zh-CN' }));
  await popupPage.goto(pathToFileURL(path.join(root, 'popup.html')).toString());
  await popupPage.waitForSelector('body:not(.is-loading)');
  await popupPage.waitForTimeout(350);
  await popupPage.screenshot({ path: path.join(outputDir, 'popup.png') });

  const playerPage = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await playerPage.route('https://translate.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([[['事务由一组操作组成，它们作为一个逻辑单元一起执行。', 'A transaction is a group of operations performed as one logical unit.', null, null]]])
  }));
  await playerPage.setContent(`<!doctype html><html><body style="margin:0;background:#07100f;color:#fff;font-family:Arial,sans-serif">
    <main id="rightPlayerContainer" style="position:relative;width:1000px;height:650px;margin:50px auto;background:#111b1a;overflow:hidden;border:1px solid #20302d">
      <div style="height:50px;padding:18px 22px;border-bottom:1px solid #263633;color:#6ee7c8;font:700 11px monospace">PANOPTO · COMPSCI 719</div>
      <div style="padding:90px 100px"><small style="color:#6ee7c8">DATABASE SYSTEMS</small><h1 style="font-size:38px;margin:12px 0">Transaction management</h1><p style="color:#93a5a0;font-size:18px">Atomicity · Consistency · Isolation · Durability</p></div>
      <video class="video-js" style="position:absolute;inset:0;width:100%;height:100%;opacity:0"></video>
      <div id="overlayCaption" style="position:absolute;left:160px;right:160px;bottom:70px;font-size:22px">A transaction is a group of operations performed as one logical unit.</div>
    </main></body></html>`);
  await installRuntimeChromeMock(playerPage);
  await playerPage.addScriptTag({ path: path.join(root, 'settings.js') });
  await playerPage.addScriptTag({ path: path.join(root, 'glossary.js') });
  await playerPage.addScriptTag({ path: path.join(root, 'content.js') });
  await playerPage.waitForSelector('#pansub-floating');
  await playerPage.click('#pansub-floating');
  await playerPage.waitForSelector('#pansub-floating-panel');
  await playerPage.waitForTimeout(350);
  await playerPage.screenshot({ path: path.join(outputDir, 'player-controls.png') });

  await browser.close();
  console.log(outputDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
