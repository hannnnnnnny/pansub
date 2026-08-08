# Caption Transition Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the previous translated cue as soon as Panopto enters its empty between-cue state, without showing an empty overlay or allowing stale translation responses to reappear.

**Architecture:** Keep caption lifecycle handling inside the existing `content.js` IIFE. Extend the smoke test to reproduce a translated cue followed by an empty caption node and a repeated cue; then make the empty state cancel pending work, reset deduplication, clear overlay content, and let visibility depend on content available to the selected display mode.

**Tech Stack:** Vanilla JavaScript, Chrome Extension Manifest V3 APIs, Playwright smoke tests, Node.js `assert`.

## Global Constraints

- Do not add dependencies or a build step.
- Keep all production code inside the existing IIFE.
- Do not use `innerHTML`, `eval()`, or unguarded DOM access.
- Preserve current behavior for non-empty captions in `original`, `translation`, and `bilingual` modes.
- A late translation response from an ended cue must not restore stale text.

---

### Task 1: Reproduce and fix empty caption transitions

**Files:**
- Modify: `tests/extension-smoke.js`
- Modify: `content.js:1141-1147`
- Modify: `content.js:2078-2122`

**Interfaces:**
- Consumes: existing `handleCaptionChange()`, `updateOverlay(originalText, translatedText)`, `applyVisibility()`, `debounceTimer`, `translateSeq`, and `lastText` state.
- Produces: an empty-caption transition that clears stale state and hides the overlay until displayable content returns.

- [ ] **Step 1: Write the failing browser regression test**

After the existing latest-translation assertions in `tests/extension-smoke.js`, add a transition through an empty native caption and then repeat the same cue to prove deduplication resets:

```js
  await page.evaluate(() => {
    document.querySelector('#overlayCaption').textContent = '';
  });
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#pansub-overlay');
    return overlay && getComputedStyle(overlay).display === 'none';
  });

  const textDuringGap = await page.locator('#pansub-overlay').textContent();
  assert(!textDuringGap.includes('second database caption'), 'empty caption should clear the previous source text');
  assert(!textDuringGap.includes('第二条数据库字幕'), 'empty caption should clear the previous translation');

  await page.evaluate(() => {
    document.querySelector('#overlayCaption').textContent = 'second database caption';
  });
  await page.waitForFunction(() => document.querySelector('#pansub-overlay')?.textContent.includes('第二条数据库字幕'));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:smoke
```

Expected: FAIL by timing out while waiting for `#pansub-overlay` to become hidden, because the empty-caption branch currently returns without clearing the previous cue.

- [ ] **Step 3: Make overlay visibility content-aware**

Replace the broad bilingual/original visibility rule in `applyVisibility()` with mode-specific content checks:

```js
  function applyVisibility() {
    if (!overlayEl) return;
    const hasSource = Boolean(lastOriginalText);
    const hasTranslation = Boolean(lastTranslatedText) || sourceLooksTranslated(lastOriginalText);
    const hasVisibleSubtitle = settings.displayMode === 'original'
      ? hasSource
      : settings.displayMode === 'translation'
        ? hasTranslation
        : hasSource || hasTranslation;
    overlayEl.style.display = settings.enabled && hasVisibleSubtitle ? 'block' : 'none';
  }
```

- [ ] **Step 4: Handle the empty caption as an ended cue**

In `handleCaptionChange()`, replace the combined empty/duplicate return with an explicit empty branch before the duplicate check:

```js
    const text = caption.el.textContent.trim();
    if (!text) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      translateSeq += 1;
      lastText = '';
      updateOverlay('', '');
      return;
    }
    if (text === lastText) return;
```

This clears displayed source and translation text, invalidates any in-flight translation, prevents an unstarted request, and allows identical caption text to be processed after the gap.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:smoke
```

Expected: PASS with `PanSub extension smoke test passed` and no warning or error output.

- [ ] **Step 6: Run syntax checks and the complete suite**

Run:

```powershell
npm test
```

Expected: PASS for syntax checks and all four smoke-test scripts.

- [ ] **Step 7: Review the diff and commit the fix**

Run:

```powershell
git diff --check
git diff -- content.js tests/extension-smoke.js
git add -- content.js tests/extension-smoke.js docs/superpowers/plans/2026-08-09-caption-transition-fix.md
git commit -m "fix: clear stale captions between cues"
```

Expected: the diff contains only the regression test, caption empty-state handling, content-aware overlay visibility, and this plan; the commit succeeds without staging unrelated user files.
