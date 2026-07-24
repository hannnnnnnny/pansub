const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pansub-extension-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`
    ]
  });

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = new URL(worker.url()).host;
    assert(extensionId, 'loaded extension should have an id');

    const apiSupport = await worker.evaluate(() => ({
      offscreen: typeof chrome.offscreen?.createDocument === 'function',
      tabCapture: typeof chrome.tabCapture?.getMediaStreamId === 'function'
    }));
    assert.strictEqual(apiSupport.offscreen, true, 'offscreen API should be available');
    assert.strictEqual(apiSupport.tabCapture, true, 'tabCapture API should be available');

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForSelector('#audioStart');
    assert.strictEqual(await page.locator('.version').textContent(), '1.2.1');
    await page.click('#audioStart');
    await page.check('#audioDisclosureAccepted');
    await page.click('#audioConfirmStart');
    assert.deepStrictEqual(pageErrors, [], `popup should load without errors: ${pageErrors.join('; ')}`);
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  console.log('MV3 extension load test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
