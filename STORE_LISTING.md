# Chrome Web Store Listing Draft

Use this file as copy-paste material for the Chrome Web Store Developer Dashboard.

## Basic Details

Name:

```text
PanSub - Panopto Chinese Subtitles
```

Summary:

```text
Real-time translated Chinese subtitles for Panopto lecture recordings.
```

Category:

```text
Accessibility
```

Language:

```text
English
```

Homepage URL:

```text
https://github.com/hannnnnnnny/pansub
```

Support URL:

```text
https://github.com/hannnnnnnny/pansub/issues
```

Privacy Policy URL:

```text
https://github.com/hannnnnnnny/pansub/blob/main/PRIVACY.md
```

## Detailed Description

```text
PanSub adds real-time translated subtitles to Panopto lecture recordings, especially useful for students watching Canvas / Panopto course videos.

It watches the visible English captions rendered by the Panopto player, translates the current caption line, and displays a clean subtitle overlay on top of the recording page.

Features:
- Real-time bilingual subtitles for Canvas / Panopto recordings
- Audio Mode Beta for recordings without captions, using Chrome on-device English speech recognition
- Spoken-English choices for US, UK, Australia, New Zealand, and Canada
- Built-in academic glossary for business, arts, IT, science, law, and more
- Interface language switch for English or Chinese settings UI
- Searchable settings command panel and live subtitle style preview
- Compact popup controls with target-language switching and clear runtime status
- Display modes: bilingual, translation only, or original only
- Position modes for on-video captions and docked Panopto captions
- Adjustable subtitle size, overlay width, and background opacity
- Optional hiding of native Panopto captions when they overlap
- Draggable floating quick controls with compact mode, temporary hide, per-site hide, global disable, and position reset
- Fullscreen support for PanSub subtitles and controls inside the Panopto player
- Stable subtitle anchoring reduces per-line jumping when captions reflow
- Player-area anchoring keeps subtitles centered on the actual video, even with sidebars or DevTools open
- Protects PanSub overlays and Panopto caption nodes from browser page translation when possible
- Session-only translation cache for repeated caption lines while the current Panopto page remains open
- Debug logs for checking which Panopto caption element was detected

Privacy note:
Native-caption mode sends current caption text to Google Translate. Audio Mode starts only after an explicit user click; Chrome recognizes English locally and PanSub does not save audio or transcripts. Audio Mode prefers Chrome's local Translator. If it is unavailable, recognized text is sent to Google Translate only after separate consent. Settings and consent choices are stored locally with chrome.storage.local. Translated caption cache remains only in memory for the current Panopto page session and is cleared when the page closes. PanSub does not include analytics, ads, tracking pixels, or an author-owned remote server.

PanSub requires Chrome 139 or later. Native captions remain the preferred source; Audio Mode Beta is available for recordings without captions.

Use PanSub only with course content you are authorised to access and for personal study only. Do not export or share course audio, captions, or translations. Machine translations may be inaccurate; treat the original lecture content as authoritative.

PanSub is an independent, unofficial browser extension. It is not affiliated with, authorised by, sponsored by, or endorsed by Panopto, Inc. or Waipapa Taumata Rau | University of Auckland. All related names and trademarks belong to their respective owners.
```

## Privacy Tab

Single purpose:

```text
PanSub translates visible Panopto lecture captions, or user-started on-device speech recognition results when captions are unavailable, and displays them as a subtitle overlay for the current recording page.
```

Permission justification for `storage`:

```text
Used to save the user's PanSub settings, enabled state, and consent choices on the device. Translated caption lines are cached only in memory for the current page session and are not stored with this permission.
```

Permission justification for `activeTab`:

```text
Used after a direct user action to identify the active Panopto recording tab where Audio Mode should start.
```

Permission justification for `offscreen`:

```text
Used to maintain the user-started tab audio stream and Chrome on-device speech recognition after the popup closes. No offscreen UI, audio storage, analytics, or tracking is used.
```

Permission justification for `tabCapture`:

```text
Used only when the user clicks Start listening. Chrome also requires this direct extension invocation before capture can begin. It captures audio only from that active Panopto tab for on-device speech recognition and is released when Audio Mode stops.
```

Optional host permission justification for `https://translate.googleapis.com/*`:

```text
Requested only after Chrome's local Translator is unavailable and the user separately allows the recognized-text fallback. It is used only to send recognized text for translation, never audio, and can be revoked from PanSub settings.
```

Host permission justification:

```text
Used only on matching Panopto pages to read visible caption text rendered by the Panopto player and display the translated subtitle overlay.
```

User data handling:

```text
PanSub reads visible caption text on Panopto recording pages. Native caption text is sent to Google Translate for translation. Audio Mode captures only a user-selected tab and Chrome recognizes speech locally; PanSub does not save or transmit audio or transcript history. Recognized text is sent to Google Translate only if local translation is unavailable and the user separately consents. PanSub does not sell user data, use it for advertising, creditworthiness, or lending, or transfer it to an author-owned remote server.
```

Data types to disclose:

```text
Website content: visible Panopto caption text, or recognized text explicitly allowed for Google fallback, used only for translation. Tab audio is processed locally and is not saved or transmitted.
```

## Distribution

Recommended first release:

```text
Visibility: Unlisted or Public
Regions: All regions where you want users to install it
Pricing: Free
In-app purchases: No
Publish automatically after review: Off for staged review, On if you want immediate publication after approval
```

## Assets

Extension package:

```text
dist/pansub-1.2.1.zip
```

Icon:

```text
assets/icon128.png
```

Screenshots:

```text
assets/store/screenshot-main-1280x800.png
assets/store/screenshot-settings-1280x800.png
```

Small promo tile:

```text
assets/store/promo-small-440x280.png
```

Optional marquee promo tile:

```text
assets/store/promo-marquee-1400x560.png
```

---

# Chrome Web Store 发布文案草稿

可以把这里的内容复制到 Chrome Web Store Developer Dashboard。

## 基本信息

名称：

```text
PanSub - Panopto Chinese Subtitles
```

一句话简介：

```text
Real-time translated Chinese subtitles for Panopto lecture recordings.
```

分类：

```text
Accessibility
```

语言：

```text
English
```

主页：

```text
https://github.com/hannnnnnnny/pansub
```

支持链接：

```text
https://github.com/hannnnnnnny/pansub/issues
```

隐私政策链接：

```text
https://github.com/hannnnnnnny/pansub/blob/main/PRIVACY.md
```

## 详细描述

```text
PanSub adds real-time translated subtitles to Panopto lecture recordings, especially useful for students watching Canvas / Panopto course videos.

It watches the visible English captions rendered by the Panopto player, translates the current caption line, and displays a clean subtitle overlay on top of the recording page.

Features:
- Real-time bilingual subtitles for Canvas / Panopto recordings
- Audio Mode Beta for recordings without captions, using Chrome on-device English speech recognition
- Spoken-English choices for US, UK, Australia, New Zealand, and Canada
- Built-in academic glossary for business, arts, IT, science, law, and more
- Interface language switch for English or Chinese settings UI
- Searchable settings command panel and live subtitle style preview
- Compact popup controls with target-language switching and clear runtime status
- Display modes: bilingual, translation only, or original only
- Position modes for on-video captions and docked Panopto captions
- Adjustable subtitle size, overlay width, and background opacity
- Optional hiding of native Panopto captions when they overlap
- Draggable floating quick controls with compact mode, temporary hide, per-site hide, global disable, and position reset
- Fullscreen support for PanSub subtitles and controls inside the Panopto player
- Stable subtitle anchoring reduces per-line jumping when captions reflow
- Player-area anchoring keeps subtitles centered on the actual video, even with sidebars or DevTools open
- Protects PanSub overlays and Panopto caption nodes from browser page translation when possible
- Session-only translation cache for repeated caption lines while the current Panopto page remains open
- Debug logs for checking which Panopto caption element was detected

Privacy note:
Native-caption mode sends current caption text to Google Translate. Audio Mode starts only after an explicit user click; Chrome recognizes English locally and PanSub does not save audio or transcripts. Audio Mode prefers Chrome's local Translator. If it is unavailable, recognized text is sent to Google Translate only after separate consent. Settings and consent choices are stored locally with chrome.storage.local. Translated caption cache remains only in memory for the current Panopto page session and is cleared when the page closes. PanSub does not include analytics, ads, tracking pixels, or an author-owned remote server.

PanSub requires Chrome 139 or later. Native captions remain the preferred source; Audio Mode Beta is available for recordings without captions.

Use PanSub only with course content you are authorised to access and for personal study only. Do not export or share course audio, captions, or translations. Machine translations may be inaccurate; treat the original lecture content as authoritative.

PanSub is an independent, unofficial browser extension. It is not affiliated with, authorised by, sponsored by, or endorsed by Panopto, Inc. or Waipapa Taumata Rau | University of Auckland. All related names and trademarks belong to their respective owners.
```

## Privacy 标签页

Single purpose：

```text
PanSub translates visible Panopto lecture captions, or user-started on-device speech recognition results when captions are unavailable, and displays them as a subtitle overlay for the current recording page.
```

`storage` 权限解释：

```text
Used to save the user's PanSub settings, enabled state, and consent choices on the device. Translated caption lines are cached only in memory for the current page session and are not stored with this permission.
```

`activeTab` 权限解释：

```text
Used after a direct user action to identify the active Panopto recording tab where Audio Mode should start.
```

`offscreen` 权限解释：

```text
Used to maintain the user-started tab audio stream and Chrome on-device speech recognition after the popup closes. No offscreen UI, audio storage, analytics, or tracking is used.
```

`tabCapture` 权限解释：

```text
Used only when the user clicks Start listening. Chrome also requires this direct extension invocation before capture can begin. It captures audio only from that active Panopto tab for on-device speech recognition and is released when Audio Mode stops.
```

可选 `https://translate.googleapis.com/*` 主机权限解释：

```text
Requested only after Chrome's local Translator is unavailable and the user separately allows the recognized-text fallback. It is used only to send recognized text for translation, never audio, and can be revoked from PanSub settings.
```

Panopto 域名权限解释：

```text
Used only on matching Panopto pages to read visible caption text rendered by the Panopto player and display the translated subtitle overlay.
```

用户数据处理说明：

```text
PanSub reads visible caption text on Panopto recording pages. Native caption text is sent to Google Translate for translation. Audio Mode captures only a user-selected tab and Chrome recognizes speech locally; PanSub does not save or transmit audio or transcript history. Recognized text is sent to Google Translate only if local translation is unavailable and the user separately consents. PanSub does not sell user data, use it for advertising, creditworthiness, or lending, or transfer it to an author-owned remote server.
```

需要披露的数据类型：

```text
Website content: visible Panopto caption text, or recognized text explicitly allowed for Google fallback, used only for translation. Tab audio is processed locally and is not saved or transmitted.
```
