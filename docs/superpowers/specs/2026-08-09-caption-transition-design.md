# Caption Transition Design

## Problem

Panopto briefly empties its live-caption element between cues. PanSub currently
returns early when it reads that empty value, leaving the previous source text,
translation, and overlay visible. When the next cue arrives, it replaces the
stale overlay, which makes the previous sentence flash during every transition.

## Desired behavior

- Treat an empty native caption as the end of the current cue.
- Immediately stop showing text from the ended cue.
- Invalidate its pending translation so a late response cannot restore stale text.
- Reset caption deduplication so identical text can be translated again after a
  genuine empty interval.
- Hide the overlay completely when the selected display mode has no visible text.
- Preserve normal behavior for `original`, `translation`, and `bilingual` modes
  once a non-empty cue arrives.

## Design

`handleCaptionChange()` will handle the empty-caption branch before the existing
duplicate-caption check. The branch will clear the debounce timer, increment the
translation sequence, reset `lastText`, and call `updateOverlay('', '')`.

`applyVisibility()` will decide visibility from the content available to the
active display mode:

- `original`: visible only when source text exists.
- `translation`: visible only when translated text exists, including the existing
  page-translated-source case.
- `bilingual`: visible when either source or translated text exists.

This makes the transition atomic from the user's perspective: the stale cue is
removed as soon as Panopto signals the gap, and the overlay returns only when the
next cue has content appropriate for the selected mode.

## Concurrency and failure handling

Incrementing `translateSeq` invalidates an in-flight response for the ended cue.
Clearing `debounceTimer` prevents a request that has not started yet. Existing
network error handling remains unchanged; an empty or failed translation never
restores the previous cue.

## Verification

Extend the Playwright extension smoke test with a controlled sequence:

1. Translate a first caption successfully.
2. Empty the Panopto caption node.
3. Assert that the overlay is hidden and contains no first-caption text.
4. Insert a second caption.
5. Assert that the second translation appears and the first caption does not.

Run the focused smoke test first, followed by the complete `npm test` suite.
