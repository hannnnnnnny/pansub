# Study-Use Messaging and Session Cache Design

## Goal

Make PanSub's intended use explicit and prevent lecture subtitle text from accumulating across browser sessions.

## User-facing messaging

- README, Chrome Web Store copy, privacy policy, and Audio Mode first-use consent state that PanSub is for authorised personal study only and that users must not export or share course audio, captions, or translations.
- README and store copy state that PanSub is independent and is not affiliated with, authorised by, sponsored by, or endorsed by Panopto, Inc. or Waipapa Taumata Rau | University of Auckland.
- Subtitle settings display a persistent note that machine translation may be inaccurate and that the original lecture content should be treated as authoritative.
- English and Simplified Chinese interfaces carry equivalent meaning.

## Cache behaviour

- Translation caching remains available within the current Panopto page to avoid repeat requests during one viewing session.
- Cache entries stay only in the content-script `Map`; they are never written to `chrome.storage.local`.
- On startup, PanSub removes the legacy `pansubCache` key created by older versions.
- The existing clear-cache control clears any legacy persistent cache and signals open Panopto tabs to clear their in-memory cache.

## Verification

- Automated content tests prove no translated caption cache is persisted and that legacy cache data is removed.
- Popup/options tests verify the new bilingual notices.
- Package audit and the complete extension test suite remain green.
