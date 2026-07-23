# Audio Mode Beta manual test

Use Chrome 139 or later with the unpacked `feature/audio-mode` build.

## First start

1. Open a Panopto recording that has audible English speech.
2. Open PanSub, choose **Tab audio**, and click **Start listening**.
3. Confirm the disclosure says:

   > PanSub captures audio only from the tab you explicitly start. Chrome performs English speech recognition on this device. PanSub does not save the audio or a transcript. If Chrome's local Translator is unavailable, recognized text is sent to Google Translate only after you separately allow that fallback.

4. Accept and continue.
5. Confirm Chrome requests tab-capture permission only now, after the click.
6. Confirm the lecture remains audible while the status changes from Preparing to Listening.
7. Confirm translated subtitles appear without an English placeholder.

## State and privacy

1. Close the popup while listening, reopen it, and confirm the Listening state remains visible.
2. Click **Stop listening** and confirm subtitles stop updating and the capture indicator clears.
3. Start again, then close the Panopto tab; confirm capture stops.
4. Start again, then navigate the tab away from Panopto; confirm capture stops.
5. In Settings, choose a different spoken-English locale and confirm it persists.
6. Click **Revoke Audio Mode permissions** and confirm the source returns to Auto.
7. Confirm no audio file, transcript history, analytics event, or author-owned server request is created.

## Local translation fallback

1. Test in a Chrome profile where the local Translator API is unavailable.
2. Confirm PanSub stops with a separate text-fallback disclosure instead of silently sending recognized text.
3. Decline and confirm no Google Translate request occurs.
4. Repeat, allow the fallback, and confirm only recognized text is sent to `translate.googleapis.com`.

## Regression

1. On a recording with native Panopto captions, leave the source on Auto and confirm native captions remain preferred.
2. Verify docked captions, fullscreen, manual subtitle position, subtitle lock, floating controls, page translation protection, glossary handling, and translation cache still work.
3. Verify the popup and Settings page in English and Chinese at desktop and narrow widths.
