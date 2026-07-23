# PanSub Audio Mode Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicitly started, no-cost Audio Mode that captures the active Panopto tab, performs English speech recognition locally in Chrome, translates the recognized text, and renders it in the existing PanSub overlay.

**Architecture:** The popup requests optional tab-capture permission and asks the service worker to create one active session. An offscreen extension page consumes the tab audio, keeps playback audible, and runs Chrome's on-device Web Speech recognizer against the captured audio track. The service worker relays normalized status and subtitle events to the Panopto content script, which reuses PanSub's glossary, translation guards, fullscreen mounting, and draggable overlay.

**Tech Stack:** Chrome Manifest V3, `chrome.tabCapture`, `chrome.offscreen`, Web Audio, on-device Web Speech API, Chrome Translator API with explicitly consented Google text fallback, vanilla JavaScript, Node assertions, Playwright.

## Global Constraints

- Minimum supported Chrome version is `139`.
- Native Panopto captions remain the default source; `Auto` never starts capture automatically.
- Audio capture starts only after a direct `Start listening` click in the extension popup.
- Speech recognition sets `processLocally = true`; there is no cloud speech-to-text fallback.
- Captured audio stays in memory, is not recorded, and is destroyed on stop, tab close, navigation, or extension reload.
- Audio Mode displays translated text only by default and emits at most two visible revisions per second.
- Only one Audio Mode session may run at a time.
- Google text translation fallback requires separate one-time disclosure and consent.
- No remote JavaScript, WebAssembly, or third-party model is downloaded or executed.
- Existing native-caption behavior, glossary handling, fullscreen mounting, dragging, and locking must remain green.

---

## File Structure

- `audio-mode-protocol.js`: shared message constants, session states, validation, and immutable default state.
- `audio-mode-state.js`: pure reducer used by the service worker and unit tests.
- `background.js`: one-session coordinator, offscreen lifecycle, tab-capture stream creation, and event broadcast.
- `offscreen.html`: hidden extension document for persistent media and browser AI APIs.
- `offscreen.js`: tab stream acquisition, audio playback routing, recognizer lifecycle, and translated subtitle emission.
- `audio-recognizer.js`: feature-detected wrapper around Chrome's local Web Speech API.
- `audio-translator.js`: local Chrome Translator adapter and consent-gated Google text fallback.
- `glossary-utils.js`: glossary placeholder protection shared by native-caption and Audio Mode translation.
- `settings.js`: source mode, Audio Mode consent, and spoken-language defaults.
- `popup.html`, `popup.css`, `popup.js`: Audio Mode start/stop, disclosure, preparation, and status UI.
- `content.js`: native-caption availability reporting, audio event rendering, floating status, and return to Auto.
- `manifest.json`: Chrome 139 floor plus `activeTab`, `offscreen`, and optional `tabCapture` permissions.
- `tests/audio-mode-state.test.js`: reducer and stale-session tests.
- `tests/audio-recognizer.test.js`: browser-recognizer adapter tests with fakes.
- `tests/audio-translator.test.js`: local/fallback/consent tests.
- `tests/background-audio.test.js`: service-worker session and cleanup tests with Chrome mocks.
- `tests/audio-mode-ui.js`: Playwright popup/content synchronization smoke test.
- `tests/audio-mode-manual.md`: real-Chrome feasibility and latency checklist.
- `PRIVACY.md`, `README.md`, `STORE_LISTING.md`: user-facing disclosure and usage documentation.

---

### Task 1: Shared Audio Mode State and Settings

**Files:**
- Create: `audio-mode-protocol.js`
- Create: `audio-mode-state.js`
- Modify: `settings.js`
- Create: `tests/audio-mode-state.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `globalThis.PANSUB_AUDIO_PROTOCOL`, `globalThis.PANSUB_AUDIO_STATE`, `reduceAudioState(state, event)`.
- Session state shape: `{ phase, sessionId, tabId, source, error, detail, updatedAt }`.
- Settings: `subtitleSource`, `audioSourceLanguage`, `audioDisclosureAccepted`, `audioGoogleFallbackConsent`.

- [ ] **Step 1: Write the failing reducer test**

```js
const assert = require('assert');
const { createAudioState, reduceAudioState } = require('../audio-mode-state.js');

let state = createAudioState();
state = reduceAudioState(state, { type: 'START_REQUESTED', sessionId: 's1', tabId: 7, now: 10 });
assert.strictEqual(state.phase, 'permission');
state = reduceAudioState(state, { type: 'CAPTURE_READY', sessionId: 's1', now: 20 });
assert.strictEqual(state.phase, 'preparing');
state = reduceAudioState(state, { type: 'LISTENING', sessionId: 's1', now: 30 });
assert.strictEqual(state.phase, 'listening');
assert.strictEqual(reduceAudioState(state, { type: 'ERROR', sessionId: 'old' }), state);
state = reduceAudioState(state, { type: 'STOPPED', sessionId: 's1', now: 40 });
assert.deepStrictEqual(state, createAudioState(40));
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/audio-mode-state.test.js`

Expected: FAIL with `Cannot find module '../audio-mode-state.js'`.

- [ ] **Step 3: Implement the protocol and reducer**

```js
const PHASES = Object.freeze(['idle', 'available', 'permission', 'preparing', 'listening', 'degraded', 'stopping', 'error']);
function createAudioState(updatedAt = 0) {
  return Object.freeze({ phase: 'idle', sessionId: null, tabId: null, source: 'auto', error: null, detail: null, updatedAt });
}
function reduceAudioState(state, event) {
  if (state.sessionId && event.sessionId && state.sessionId !== event.sessionId) return state;
  if (event.type === 'START_REQUESTED') return Object.freeze({ ...state, phase: 'permission', sessionId: event.sessionId, tabId: event.tabId, source: 'audio', error: null, updatedAt: event.now });
  if (event.type === 'CAPTURE_READY') return Object.freeze({ ...state, phase: 'preparing', updatedAt: event.now });
  if (event.type === 'LISTENING') return Object.freeze({ ...state, phase: 'listening', detail: null, updatedAt: event.now });
  if (event.type === 'DEGRADED') return Object.freeze({ ...state, phase: 'degraded', detail: event.detail, updatedAt: event.now });
  if (event.type === 'STOP_REQUESTED') return Object.freeze({ ...state, phase: 'stopping', updatedAt: event.now });
  if (event.type === 'ERROR') return Object.freeze({ ...state, phase: 'error', error: event.error, detail: event.detail || null, updatedAt: event.now });
  if (event.type === 'STOPPED') return createAudioState(event.now);
  return state;
}
```

Add defaults in `settings.js`:

```js
subtitleSource: 'auto',
audioSourceLanguage: 'en-US',
audioDisclosureAccepted: false,
audioGoogleFallbackConsent: false,
```

- [ ] **Step 4: Run the focused and existing tests**

Run: `node tests/audio-mode-state.test.js && npm test`

Expected: reducer test prints `Audio mode state tests passed`; all existing smoke tests pass.

- [ ] **Step 5: Commit**

```bash
git add audio-mode-protocol.js audio-mode-state.js settings.js tests/audio-mode-state.test.js package.json
git commit -m "feat: add audio mode state protocol"
```

### Task 2: MV3 Capture Coordinator

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`
- Create: `tests/background-audio.test.js`

**Interfaces:**
- Consumes: `PANSUB_AUDIO_PROTOCOL`, `createAudioState`, `reduceAudioState`.
- Accepts: `PANSUB_AUDIO_START`, `PANSUB_AUDIO_STOP`, `PANSUB_AUDIO_GET_STATE`, `PANSUB_AUDIO_OFFSCREEN_EVENT`, `PANSUB_NATIVE_CAPTION_STATUS`, `PANSUB_OPEN_AUDIO_POPUP`.
- Produces: `PANSUB_AUDIO_STATE_CHANGED` and `PANSUB_AUDIO_SUBTITLE` tab messages.

- [ ] **Step 1: Write a failing coordinator test with Chrome API fakes**

```js
await chrome.runtime.onMessage.dispatch({ type: 'PANSUB_AUDIO_START', disclosureAccepted: true }, popupSender);
assert.strictEqual(chrome.offscreen.createDocument.calls.length, 1);
assert.strictEqual(chrome.tabCapture.getMediaStreamId.calls[0].targetTabId, 12);
assert.strictEqual(sentToOffscreen[0].type, 'PANSUB_AUDIO_CAPTURE_START');
await chrome.runtime.onMessage.dispatch({ type: 'PANSUB_AUDIO_STOP' }, popupSender);
assert.strictEqual(sentToOffscreen.at(-1).type, 'PANSUB_AUDIO_CAPTURE_STOP');
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/background-audio.test.js`

Expected: FAIL because the current background listener does not handle `PANSUB_AUDIO_START`.

- [ ] **Step 3: Add permissions and coordinator behavior**

Set manifest fields:

```json
"minimum_chrome_version": "139",
"permissions": ["storage", "activeTab", "offscreen"],
"optional_permissions": ["tabCapture"],
```

Implement start sequencing:

```js
async function startAudioMode(sender) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/[^/]*panopto\.com\//i.test(tab.url || '')) throw new Error('PANOPTO_TAB_REQUIRED');
  await stopActiveSession('replaced');
  const sessionId = crypto.randomUUID();
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  activeState = reduceAudioState(activeState, { type: 'START_REQUESTED', sessionId, tabId: tab.id, now: Date.now() });
  await chrome.runtime.sendMessage({ type: 'PANSUB_AUDIO_CAPTURE_START', sessionId, tabId: tab.id, streamId, settings: await loadAudioSettings() });
  return activeState;
}
```

Reject stale offscreen events by `sessionId`, stop on `tabs.onRemoved` and Panopto navigation, and always broadcast the latest state.

Track native-caption availability per tab. `PANSUB_AUDIO_GET_STATE` returns a derived `available` phase when the selected tab has reported no caption text for at least five seconds and no Audio Mode session is active. Handle `PANSUB_OPEN_AUDIO_POPUP` with `chrome.action.openPopup()` and return an explicit `POPUP_OPEN_FAILED` error if Chrome rejects the call.

- [ ] **Step 4: Run coordinator and full tests**

Run: `node tests/background-audio.test.js && npm test`

Expected: coordinator start/replace/stop/stale-event cases pass; existing tests remain green.

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js tests/background-audio.test.js
git commit -m "feat: coordinate tab audio capture sessions"
```

### Task 3: Offscreen Capture and Local Speech Recognition

**Files:**
- Create: `offscreen.html`
- Create: `audio-recognizer.js`
- Create: `offscreen.js`
- Create: `tests/audio-recognizer.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createLocalRecognizer({ Recognition, language, now, emit })`.
- Offscreen accepts: `PANSUB_AUDIO_CAPTURE_START`, `PANSUB_AUDIO_CAPTURE_STOP`.
- Offscreen emits: `PREPARING`, `LISTENING`, `TRANSCRIPT`, `DEGRADED`, `ERROR`, `STOPPED`.

- [ ] **Step 1: Write recognizer tests using a fake Web Speech implementation**

```js
const recognizer = createLocalRecognizer({ Recognition: FakeRecognition, language: 'en-US', emit: events.push.bind(events) });
await recognizer.prepare();
recognizer.start(fakeAudioTrack);
fakeRecognition.emitResult('database schema', false);
fakeRecognition.emitResult('database schema', true);
assert.deepStrictEqual(events.map((event) => event.kind), ['partial', 'final']);
assert.strictEqual(fakeRecognition.processLocally, true);
assert.strictEqual(fakeRecognition.startedTrack, fakeAudioTrack);
recognizer.stop();
assert.strictEqual(fakeRecognition.aborted, true);
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/audio-recognizer.test.js`

Expected: FAIL with `createLocalRecognizer is not defined`.

- [ ] **Step 3: Implement local availability, installation, and recognition**

```js
async function prepare() {
  if (!Recognition || typeof Recognition.available !== 'function') throw codeError('LOCAL_SPEECH_UNSUPPORTED');
  const options = { langs: [language], processLocally: true };
  const availability = await Recognition.available(options);
  if (availability === 'unavailable') throw codeError('LOCAL_LANGUAGE_UNAVAILABLE');
  if (availability !== 'available') {
    const installed = await Recognition.install(options);
    if (!installed) throw codeError('LOCAL_LANGUAGE_INSTALL_FAILED');
  }
}
function start(audioTrack) {
  recognition = new Recognition();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.processLocally = true;
  if ('quality' in recognition) recognition.quality = 'dictation';
  recognition.onresult = emitResults;
  recognition.onerror = (event) => emit({ kind: 'error', code: event.error });
  recognition.onend = restartUnlessStopped;
  recognition.start(audioTrack);
}
```

In `offscreen.js`, acquire the tab stream and preserve audible playback:

```js
stream = await navigator.mediaDevices.getUserMedia({
  audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } },
  video: false
});
audioContext = new AudioContext();
sourceNode = audioContext.createMediaStreamSource(stream);
sourceNode.connect(audioContext.destination);
await recognizer.prepare();
recognizer.start(stream.getAudioTracks()[0].clone());
```

Stop must abort recognition, stop every track, disconnect nodes, close the context, clear references, and emit `STOPPED` in a `finally` block.

- [ ] **Step 4: Run syntax, recognizer, and full tests**

Run: `node tests/audio-recognizer.test.js && npm run check && npm test`

Expected: local preparation/result/restart/cleanup cases pass; no syntax errors.

- [ ] **Step 5: Commit**

```bash
git add offscreen.html offscreen.js audio-recognizer.js tests/audio-recognizer.test.js package.json
git commit -m "feat: recognize captured audio locally"
```

### Task 4: Streaming Translation and Revision Control

**Files:**
- Create: `glossary-utils.js`
- Create: `audio-translator.js`
- Create: `tests/audio-translator.test.js`
- Modify: `manifest.json`
- Modify: `content.js`
- Modify: `offscreen.html`
- Modify: `offscreen.js`

**Interfaces:**
- Produces: `createAudioTranslator({ sourceLanguage, targetLanguage, allowGoogleFallback, fetchImpl, TranslatorClass, glossary })`.
- `translate(text, { sequence, signal })` returns `{ sequence, text, provider }`.
- Offscreen emits only translated subtitle messages, never provisional English.

- [ ] **Step 1: Write failing local, fallback-consent, and stale-result tests**

```js
const local = createAudioTranslator({ TranslatorClass: FakeTranslator, sourceLanguage: 'en', targetLanguage: 'zh-CN' });
assert.deepStrictEqual(await local.translate('database', { sequence: 1 }), { sequence: 1, text: '数据库', provider: 'local' });
await assert.rejects(() => createAudioTranslator({ TranslatorClass: null, allowGoogleFallback: false }).translate('database', { sequence: 2 }), /GOOGLE_CONSENT_REQUIRED/);
assert.strictEqual((await fallback.translate('database', { sequence: 3 })).provider, 'google');
assert.strictEqual((await glossaryTranslator.translate('primary key', { sequence: 4 })).text, '主键');
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/audio-translator.test.js`

Expected: FAIL because `audio-translator.js` does not exist.

- [ ] **Step 3: Implement the adapter and stability gate**

```js
async function createLocalSession() {
  if (!TranslatorClass) return null;
  const options = { sourceLanguage, targetLanguage };
  const availability = await TranslatorClass.availability(options);
  if (availability === 'unavailable') return null;
  return TranslatorClass.create(options);
}
async function translate(text, { sequence, signal }) {
  const prepared = protectGlossaryTerms(text, glossary, targetLanguage);
  const local = await localSessionPromise;
  if (local) return { sequence, text: restoreGlossaryTerms(await local.translate(prepared.text), prepared.replacements), provider: 'local' };
  if (!allowGoogleFallback) throw codeError('GOOGLE_CONSENT_REQUIRED');
  return { sequence, text: restoreGlossaryTerms(await googleTranslate(prepared.text, signal), prepared.replacements), provider: 'google' };
}
```

Move the existing placeholder protection and restoration logic from `content.js` into `glossary-utils.js`; load it after `glossary.js` in both the content-script manifest and `offscreen.html`. Add a 350 ms unchanged-hypothesis gate, a 500 ms minimum visible-update interval, `AbortController` cancellation, and final-result immediate flush. Ignore any completed translation whose sequence is not the current sequence.

- [ ] **Step 4: Run translator and full tests**

Run: `node tests/audio-translator.test.js && npm test`

Expected: local-first, explicit-consent fallback, abort, stale sequence, and two-updates-per-second cases pass.

- [ ] **Step 5: Commit**

```bash
git add glossary-utils.js audio-translator.js manifest.json content.js offscreen.html offscreen.js tests/audio-translator.test.js
git commit -m "feat: stream translated audio subtitles"
```

### Task 5: Content Bridge and Floating Audio Status

**Files:**
- Modify: `content.js`
- Create: `tests/audio-mode-ui.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PANSUB_AUDIO_STATE_CHANGED`, `PANSUB_AUDIO_SUBTITLE`.
- Produces: `PANSUB_NATIVE_CAPTION_STATUS` and `PANSUB_OPEN_AUDIO_POPUP` intent.
- Maintains one selected source: native or audio, never both.

- [ ] **Step 1: Add failing Playwright assertions**

```js
await dispatchRuntimeMessage({ type: 'PANSUB_AUDIO_STATE_CHANGED', state: { phase: 'available', source: 'auto' } });
assert.strictEqual(await page.locator('#pansub-floating').getAttribute('data-audio-state'), 'available');
await dispatchRuntimeMessage({ type: 'PANSUB_AUDIO_STATE_CHANGED', state: { phase: 'listening', source: 'audio', sessionId: 's1' } });
await dispatchRuntimeMessage({ type: 'PANSUB_AUDIO_SUBTITLE', sessionId: 's1', sequence: 4, text: '数据库模式', final: false });
assert.strictEqual(await page.locator('#pansub-translated').textContent(), '数据库模式');
await dispatchRuntimeMessage({ type: 'PANSUB_AUDIO_SUBTITLE', sessionId: 'old', sequence: 5, text: '过期内容' });
assert(!await page.locator('#pansub-overlay').textContent().then((text) => text.includes('过期内容')));
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `node tests/audio-mode-ui.js`

Expected: FAIL because the floating button has no Audio Mode state.

- [ ] **Step 3: Implement source arbitration and UI rendering**

Add a runtime listener that rejects stale session/sequence values, writes translated audio directly into `#pansub-translated`, leaves `#pansub-original` empty, and clears audio state on stop. While audio is listening, native mutation events are ignored; after stop, `Auto` resumes native detection.

Report native caption availability without observing PanSub's own nodes:

```js
let lastNativeCaptionAt = 0;
function reportNativeCaptionStatus(hasCaptions) {
  chrome.runtime.sendMessage({ type: 'PANSUB_NATIVE_CAPTION_STATUS', hasCaptions, observedAt: Date.now() });
}
setInterval(() => {
  if (audioState.phase === 'listening') return;
  reportNativeCaptionStatus(Date.now() - lastNativeCaptionAt < 5000);
}, 1000);
```

Every accepted native-caption mutation updates `lastNativeCaptionAt`. Do not interpret translated transcript sidebar rows, browser-translated DOM, or any `[data-pansub-owned]` node as a native caption.

Render floating states:

```js
const signalColors = {
  available: '#f59e0b',
  preparing: '#60a5fa',
  listening: '#34d399',
  degraded: '#f59e0b',
  error: '#fb7185'
};
floatingEl.dataset.audioState = audioState.phase;
signal.style.background = signalColors[audioState.phase] || (settings.enabled ? '#6ee7c8' : '#94a3b8');
```

The floating panel action sends `PANSUB_OPEN_AUDIO_POPUP`; it never starts capture itself. Add `aria-live="polite"`, keyboard focus restoration, and reduced-motion handling for listening animation.

- [ ] **Step 4: Run the focused, visual, and regression tests**

Run: `node tests/audio-mode-ui.js && npm test && npm run visual:review`

Expected: source arbitration and stale-event tests pass; screenshots have no overflow or overlap failures.

- [ ] **Step 5: Commit**

```bash
git add content.js tests/audio-mode-ui.js package.json
git commit -m "feat: render audio mode in subtitle controls"
```

### Task 6: Popup Start, Stop, Disclosure, and Error Recovery

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Modify: `tests/popup-smoke.js`

**Interfaces:**
- Popup requests `chrome.permissions.request({ permissions: ['tabCapture'] })` inside the Start click.
- Popup sends `PANSUB_AUDIO_START`, `PANSUB_AUDIO_STOP`, and `PANSUB_AUDIO_GET_STATE`.
- Popup persists disclosure and Google text-fallback consent only after explicit checkbox confirmation.

- [ ] **Step 1: Extend the popup smoke test with state and permission paths**

```js
await page.click('#audioStart');
assert.strictEqual(await page.locator('#audioDisclosure').isVisible(), true);
await page.check('#audioDisclosureAccepted');
await page.click('#audioConfirmStart');
assert.deepStrictEqual(permissionRequests[0], { permissions: ['tabCapture'] });
assert.strictEqual(runtimeMessages.at(-1).type, 'PANSUB_AUDIO_START');
await dispatchRuntimeMessage({ type: 'PANSUB_AUDIO_STATE_CHANGED', state: { phase: 'listening' } });
assert.strictEqual(await page.locator('#audioStop').isVisible(), true);
```

- [ ] **Step 2: Run the popup test and verify it fails**

Run: `node tests/popup-smoke.js`

Expected: FAIL because `#audioStart` does not exist.

- [ ] **Step 3: Build the Audio Mode popup panel**

Add a compact source segmented control (`Auto`, `Native`, `Tab audio`), amber no-caption callout, disclosure sheet, local-language-pack preparation state, listening timer, Stop command, and actionable errors. Start remains disabled until the disclosure is checked. Request permission directly in the click handler:

```js
async function confirmAudioStart() {
  const granted = await chrome.permissions.request({ permissions: ['tabCapture'] });
  if (!granted) return renderAudioError('permissionDenied');
  await saveAudioConsent();
  const state = await chrome.runtime.sendMessage({ type: 'PANSUB_AUDIO_START' });
  renderAudioState(state);
}
```

When offscreen reports `GOOGLE_CONSENT_REQUIRED`, show a separate text-only fallback disclosure. The retry button remains disabled until `#audioGoogleFallbackAccepted` is checked, then persists `audioGoogleFallbackConsent: true` and starts a fresh session. Declining or closing this sheet stops Audio Mode and never displays English recognition output.

Use icon plus text for Start/Stop commands, stable button dimensions, no nested cards, and bilingual copy selected by `interfaceLanguage`.

- [ ] **Step 4: Run popup and full tests**

Run: `node tests/popup-smoke.js && npm test`

Expected: disclosure, denial, preparation, listening, stop, and retry paths pass in English and Chinese.

- [ ] **Step 5: Commit**

```bash
git add popup.html popup.css popup.js tests/popup-smoke.js
git commit -m "feat: add audio mode popup controls"
```

### Task 7: Privacy, Options, and User Documentation

**Files:**
- Modify: `options.html`
- Modify: `options.js`
- Modify: `options.css`
- Modify: `tests/options-smoke.js`
- Modify: `PRIVACY.md`
- Modify: `README.md`
- Modify: `STORE_LISTING.md`
- Create: `tests/audio-mode-manual.md`

**Interfaces:**
- Settings can reset disclosure/fallback consent and show browser compatibility.
- Documentation must distinguish local audio recognition from optional Google text translation.

- [ ] **Step 1: Add failing options assertions**

```js
assert.strictEqual(await page.getByLabel('Audio source language').inputValue(), 'en-US');
await page.click('#clearAudioConsent');
assert.strictEqual(await page.evaluate(() => window.__pansubStore.pansubSettings.audioDisclosureAccepted), false);
assert.strictEqual(await page.evaluate(() => window.__pansubStore.pansubSettings.audioGoogleFallbackConsent), false);
```

- [ ] **Step 2: Run the options test and verify it fails**

Run: `node tests/options-smoke.js`

Expected: FAIL because the Audio Mode privacy controls do not exist.

- [ ] **Step 3: Add settings and exact disclosures**

Add Audio Mode settings for source language, consent review/reset, compatibility status, and troubleshooting. State plainly:

```text
PanSub captures audio only from the tab you explicitly start. Chrome performs English speech recognition on this device. PanSub does not save the audio or a transcript. If Chrome's local Translator is unavailable, recognized text is sent to Google Translate only after you separately allow that fallback.
```

Update README installation/use screenshots and Store listing permission reasons for `activeTab`, `offscreen`, optional `tabCapture`, and `storage`. Add real-Chrome steps covering audible playback, language-pack installation, fullscreen, stop cleanup, and measured speech-to-subtitle latency.

- [ ] **Step 4: Run options, policy, and full tests**

Run: `node tests/options-smoke.js && npm test`

Expected: options behavior passes and all required privacy phrases are present in the three documentation files.

- [ ] **Step 5: Commit**

```bash
git add options.html options.css options.js tests/options-smoke.js PRIVACY.md README.md STORE_LISTING.md tests/audio-mode-manual.md
git commit -m "docs: disclose local audio translation mode"
```

### Task 8: Real Chrome Verification, Packaging, and PR

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `scripts/package-extension.ps1`
- Modify: `tests/extension-smoke.js`

**Interfaces:**
- Produces a clean Web Store ZIP with `manifest.json` at its root.
- Produces evidence for capture, local recognition, latency, cleanup, and existing caption regression behavior.

- [ ] **Step 1: Add package-audit assertions**

```js
assert.strictEqual(manifest.minimum_chrome_version, '139');
assert(manifest.permissions.includes('offscreen'));
assert(manifest.optional_permissions.includes('tabCapture'));
assert(packageEntries.includes('offscreen.html'));
assert(packageEntries.includes('audio-recognizer.js'));
assert(!packageEntries.some((name) => name.includes('node_modules') || name.endsWith('.pdf')));
```

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test && npm run visual:review`

Expected: all syntax, state, coordinator, recognizer, translator, popup, content, options, glossary, and visual tests pass.

- [ ] **Step 3: Run the real-Chrome feasibility checklist**

Load the unpacked extension in Chrome 139 or later, open a Panopto recording without native captions, start Audio Mode from the popup, install the local English pack if prompted, and verify:

```text
PASS tab audio remains audible
PASS speech recognition reports local processing
PASS translated subtitles appear without English placeholder
PASS normal latency is 1-2 seconds and p95 is below 3 seconds
PASS fullscreen keeps the overlay stable
PASS Stop immediately ends capture and clears in-memory session state
PASS native-caption Auto mode resumes after Stop
```

- [ ] **Step 4: Increment version and build a clean package**

Set both `manifest.json` and `package.json` to `1.2.0`, then run:

Run: `npm run package:zip`

Expected: one ZIP under `dist/`, root contains `manifest.json`, and package audit passes.

- [ ] **Step 5: Final commit, push, and PR**

```bash
git add manifest.json package.json package-lock.json scripts/package-extension.ps1 tests/extension-smoke.js
git commit -m "release: prepare PanSub audio mode beta"
git push -u origin feature/audio-mode
gh pr create --base main --head feature/audio-mode --title "feat: add local Audio Mode beta" --body-file docs/superpowers/plans/2026-07-24-audio-mode-pr.md
```

Expected: a ready-for-review PR with test evidence, permission/privacy notes, known Chrome 139+ limitation, and rollback instructions.
