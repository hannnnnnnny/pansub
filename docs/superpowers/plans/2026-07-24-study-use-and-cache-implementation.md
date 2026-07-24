# Study-Use Messaging and Session Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear study-use safeguards and replace persistent caption caching with a page-session cache.

**Architecture:** Keep the existing in-memory translation `Map`, remove disk persistence, and use the legacy storage key only as a cross-tab invalidation signal. Add shared bilingual wording to existing documentation, popup consent, and options UI patterns.

**Tech Stack:** Chrome MV3, vanilla JavaScript, HTML/CSS, Node/Playwright smoke tests.

## Global Constraints

- Audio and transcript export must not be added.
- Existing translations remain responsive within the current page session.
- English and Simplified Chinese messaging must remain semantically equivalent.

---

### Task 1: Session-only translation cache

**Files:**
- Modify: `content.js`
- Modify: `options.js`
- Test: `tests/extension-smoke.js`
- Test: `tests/options-smoke.js`

- [ ] Add failing assertions that no caption entries are persisted and legacy `pansubCache` data is removed.
- [ ] Run the focused tests and confirm they fail for persistence behaviour.
- [ ] Remove cache loading/persistence while retaining the bounded in-memory map and clear-cache invalidation.
- [ ] Run focused tests and confirm they pass.

### Task 2: Study-use and accuracy messaging

**Files:**
- Modify: `popup.js`
- Modify: `popup.html`
- Modify: `options.js`
- Modify: `options.html`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `STORE_LISTING.md`
- Test: `tests/popup-smoke.js`
- Test: `tests/options-smoke.js`
- Test: `tests/package-audit.test.js`

- [ ] Add failing assertions for the bilingual personal-study, non-affiliation, and translation-accuracy notices.
- [ ] Run the focused tests and confirm the missing copy fails.
- [ ] Add concise copy to the existing consent, settings, store, README, and privacy surfaces.
- [ ] Run focused tests and confirm they pass.

### Task 3: Release verification

**Files:**
- Modify: `tests/audio-mode-manual.md`

- [ ] Add manual checks for study-use messaging and session-only cache behaviour.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run visual:review` and inspect desktop/mobile options and popup captures.
- [ ] Run `npm.cmd run package:zip` and inspect the ZIP root.
- [ ] Commit and push the changes to `feature/audio-mode` so pull request #1 updates.
