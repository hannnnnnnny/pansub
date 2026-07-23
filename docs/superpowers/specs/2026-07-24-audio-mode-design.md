# PanSub Audio Mode Beta Design

Date: 2026-07-24
Status: Draft for user review
Branch: `feature/audio-mode`

## Objective

Add an optional Audio Mode for Panopto recordings that do not expose usable captions. PanSub captures only the current tab's audio after an explicit user action, performs streaming English speech recognition locally, translates recognized text to the configured target language, and renders the result through the existing PanSub subtitle overlay.

The feature must remain free to use, avoid retaining lecture audio or full transcripts, and preserve the existing native-caption workflow as the preferred source.

## Product Principles

- Native Panopto captions remain the default and fastest source.
- Audio capture never starts automatically.
- Audio recognition runs locally on the user's device.
- Audio is processed in memory and is never recorded to a file.
- Audio Mode does not provide transcript export, history, sharing, or training-data collection.
- The user can see when capture is active and can stop it from the popup or floating control.
- The feature degrades clearly when the browser or device cannot support realtime recognition.

## User Experience

### Source selection

PanSub exposes three source modes:

- `Auto`: use native captions when available; otherwise show that Audio Mode is available.
- `Native captions`: never capture audio and only translate detected Panopto captions.
- `Tab audio`: capture and recognize the current tab after explicit confirmation.

`Auto` is the default. It does not automatically switch on audio capture.

### Entry points

When no native caption is detected for several seconds, the floating PanSub button shows an amber status dot. Opening the floating panel explains that no captions were found and presents an Audio Mode action.

The canonical start action is in the extension popup. The popup requests the optional `tabCapture` permission at runtime, explains why it is needed, and starts capture in the active Panopto tab. This avoids a broad installation-time permission prompt and satisfies Chrome's user-invocation requirement.

The floating panel's start action opens the extension popup with Audio Mode focused. The final `Start listening` click occurs in the popup, where Chrome can reliably associate it with extension invocation and permission consent. Stop actions do not require new permission and remain available directly from both surfaces.

### Visible states

The popup and floating control share one state machine:

1. `native`: translating native captions.
2. `available`: no captions detected; Audio Mode can be started.
3. `permission`: waiting for optional capture permission.
4. `downloading`: downloading and verifying local model assets with progress and cancel controls.
5. `warming`: loading the recognizer and translator.
6. `listening`: capturing tab audio and producing streaming subtitles.
7. `degraded`: device cannot keep up; recognition interval has been increased.
8. `stopping`: closing the stream and clearing in-memory state.
9. `error`: actionable error with retry or fallback guidance.

While listening, the floating button uses a green status dot and restrained audio-level motion. Reduced-motion settings disable waveform animation. The popup and floating panel both expose a clear `Stop listening` command.

### Subtitle behavior

- Audio Mode displays translated text only by default; it does not flash provisional English text.
- Partial English hypotheses remain in memory.
- A stability gate prevents translation until a hypothesis is unchanged for a short interval.
- At most two visible subtitle revisions are emitted per second.
- A voice-activity endpoint commits the current phrase and begins a new phrase.
- Existing glossary protection and latest-result sequence guards remain active.
- The existing draggable, lockable, fullscreen-safe overlay is reused.

## Architecture

### Capture coordinator

`background.js` becomes the session coordinator. It owns the active tab/session identity, permission checks, offscreen-document lifecycle, capture start/stop requests, and state broadcasts.

Only one Audio Mode session may exist at a time. Starting a session in a new tab first stops the previous session.

### Offscreen audio runtime

An extension-owned offscreen document consumes the `tabCapture` stream. It:

- reconnects captured audio to an `AudioContext` destination so the lecture remains audible;
- converts audio to mono 16 kHz PCM;
- feeds short frames into the local recognizer;
- owns model loading and recognition worker lifecycle;
- sends partial and final hypotheses to the background coordinator;
- closes tracks, workers, buffers, and contexts on stop.

All executable JavaScript, workers, AudioWorklet code, and WebAssembly are packaged with the extension. Manifest V3 remote hosted code is not used.

### Recognition adapter

The runtime exposes a small recognizer contract:

```text
load(progressCallback)
start(sampleRate)
pushAudio(float32Frames)
onPartial(callback)
onFinal(callback)
stop()
dispose()
```

The primary candidate is Sherpa-ONNX streaming English Zipformer through WebAssembly SIMD. It is selected for low streaming latency and local execution. The adapter boundary allows a later Whisper or alternative model without changing capture, translation, or UI code.

### Translation adapter

Recognized English passes through a translation adapter:

1. Prefer Chrome's on-device `Translator` API when available and ready.
2. Fall back to the existing Google Translate request path when local translation is unavailable.

The local translator is prepared only after explicit Audio Mode intent. If it requires a model download, progress is shown. Google fallback is disclosed before the first Audio Mode session because recognized text leaves the device in that path.

If the Translator API cannot be kept alive in the offscreen context or initialized from the user gesture, the MVP uses Google fallback after a separate one-time disclosure and consent. If the user declines Google fallback, Audio Mode stops without displaying provisional English.

### Content bridge

`content.js` remains responsible for Panopto caption detection, overlay rendering, floating controls, glossary handling, and fullscreen mounting. It receives normalized source events:

```text
source: native | audio
kind: partial | final | clear | status
text: string
sequence: number
```

Native and audio sources never update the overlay concurrently. Starting Audio Mode suspends native-caption updates for that session; stopping Audio Mode returns source selection to `Auto`.

## Streaming and Latency Strategy

- Capture frames: approximately 100-200 ms.
- Partial recognition polling: approximately 250-400 ms.
- Hypothesis stability gate: approximately 350-500 ms.
- Visible translation updates: no more than twice per second.
- Normal target latency: 1-2 seconds from speech to translated subtitle.
- 95th percentile target: below 3 seconds on a supported modern desktop.

These are acceptance targets, not claims made to users. A benchmark harness measures recognition realtime factor, end-to-end latency, dropped frames, and revision count before the recognizer is accepted.

If processing falls behind, Audio Mode increases the frame aggregation interval and reports `degraded` instead of allowing an unbounded queue. Old audio and stale translation work are discarded rather than replayed late.

## Model Distribution

- Executable runtime assets are bundled inside the extension package.
- Model weights and token data are downloaded on first use from a fixed versioned URL because they are data, not executable extension code.
- Downloaded assets are checksum-verified and stored in browser-managed local cache storage.
- The model version, expected size, source, license, and checksum are pinned in extension code.
- Model download can be cancelled, retried, or cleared from settings.
- Audio Mode never starts until model verification succeeds.

If Chrome Web Store review treats remotely downloaded ONNX assets as remote hosted code, the release package will bundle the selected quantized model instead. No runtime code path downloads JavaScript or WebAssembly.

## Permissions and Privacy

Manifest changes:

- keep `storage` as required;
- add `activeTab` as required so a toolbar invocation grants temporary access to the selected tab without a broad host expansion;
- add `offscreen` as required for the hidden audio runtime;
- declare `tabCapture` as optional and request it only when Audio Mode is enabled;
- set an appropriate minimum Chrome version after the feasibility spike.

Before the first session, the user sees a prominent disclosure covering:

- current-tab audio capture;
- local speech recognition;
- no recording or transcript retention;
- local translation when available;
- recognized-text transmission to Google when fallback is used;
- immediate stop and cleanup behavior.

Privacy policy, store listing, permission justifications, and release notes must match the actual implementation before the PR is marked ready.

## Error Handling

- Permission denied: remain in `available` and explain how to retry.
- Unsupported Chrome version: keep native-caption mode fully functional.
- Model download interruption: retain resumable progress when safe, otherwise restart cleanly.
- Checksum mismatch: delete the asset and refuse to load it.
- Silent tab: show `Waiting for tab audio` without generating empty subtitles.
- Capture ended or tab closed: stop the session and clear the overlay state.
- Device overload: enter `degraded`, reduce update frequency, and keep playback responsive.
- Translator unavailable: request consent for Google fallback; if declined, stop Audio Mode and show an actionable status without exposing provisional English.
- Network or rate limiting: apply existing backoff and latest-result guards without showing stale text.
- Fullscreen transitions: remount existing controls and overlay without interrupting the offscreen session.

## Feasibility Gates

Before full integration, a focused spike must prove:

1. `tabCapture` can start reliably from the popup after runtime permission consent.
2. Captured audio remains audible after routing through the offscreen `AudioContext`.
3. The selected Sherpa-ONNX WebAssembly build works under MV3 CSP without remote executable code.
4. Streaming recognition stays near realtime on representative Windows hardware.
5. Chrome Translator API can be initialized and reused in an extension context; otherwise the separately disclosed Google fallback is offered for MVP and requires explicit consent.
6. The model delivery approach passes package and remote-code policy checks.

Failure of a preferred path does not block the feature when its explicit fallback succeeds.

## Testing

Automated coverage must include:

- Audio Mode state-machine transitions;
- permission grant, denial, removal, and retry;
- session exclusivity across tabs;
- partial hypothesis stability and finalization;
- stale recognition and translation cancellation;
- local translator and Google fallback routing;
- capture cleanup and zero retained audio buffers after stop;
- model checksum and cache behavior;
- native-caption priority and return to `Auto`;
- popup/floating-control state synchronization;
- reduced motion and keyboard accessibility;
- package audit confirming no remote JavaScript or WebAssembly.

Manual Chrome verification must cover normal and fullscreen Panopto playback, tab navigation, pause/resume, silent sections, long lectures, model download cancellation, CPU throttling, and extension reload during a session.

## Non-goals for the Beta

- Microphone capture.
- Recording or downloading lecture audio.
- Full transcript storage, export, search, or sharing.
- Speaker diarization.
- Multi-tab simultaneous recognition.
- Mobile Chrome support.
- Guaranteed sub-second translation.
- Cloud speech-to-text services or developer-paid API usage.

## Release Criteria

Audio Mode Beta is ready for PR review when:

- existing native-caption tests remain green;
- all Audio Mode automated tests pass;
- normal modern-desktop latency meets the 1-2 second target in the benchmark fixture;
- no audio or full transcript survives stop/reload;
- permissions and privacy disclosures match runtime behavior;
- the extension remains usable when Audio Mode is unsupported or declined;
- the release ZIP contains all executable runtime assets and passes MV3 validation.
