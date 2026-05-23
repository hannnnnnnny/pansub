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
- Interface language switch for English or Chinese settings UI
- Display modes: bilingual, translation only, or original only
- Position modes for on-video captions and docked Panopto captions
- Adjustable subtitle size, overlay width, and background opacity
- Optional hiding of native Panopto captions when they overlap
- Floating quick button for turning PanSub on or off while watching
- Local translation cache for repeated caption lines
- Debug logs for checking which Panopto caption element was detected

Privacy note:
PanSub sends the current caption text to the Google Translate endpoint for translation. Settings and translation cache are stored locally with chrome.storage.local. PanSub does not include analytics, ads, tracking pixels, or an author-owned remote server.

PanSub requires captions to be enabled in the Panopto player.
```

## Privacy Tab

Single purpose:

```text
PanSub translates visible Panopto lecture captions and displays them as a subtitle overlay for the current recording page.
```

Permission justification for `storage`:

```text
Used to save the user's PanSub settings, enabled state, and local translation cache on the device.
```

Host permission justification:

```text
Used only on matching Panopto pages to read visible caption text rendered by the Panopto player and display the translated subtitle overlay.
```

User data handling:

```text
PanSub reads visible caption text on Panopto recording pages. The current caption text is sent to Google Translate for translation. PanSub does not sell user data, does not use data for advertising, does not use data for creditworthiness or lending, and does not transfer data to an author-owned remote server.
```

Data types to disclose:

```text
Website content: visible Panopto caption text used for translation.
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
dist/pansub-1.1.1.zip
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
- Interface language switch for English or Chinese settings UI
- Display modes: bilingual, translation only, or original only
- Position modes for on-video captions and docked Panopto captions
- Adjustable subtitle size, overlay width, and background opacity
- Optional hiding of native Panopto captions when they overlap
- Floating quick button for turning PanSub on or off while watching
- Local translation cache for repeated caption lines
- Debug logs for checking which Panopto caption element was detected

Privacy note:
PanSub sends the current caption text to the Google Translate endpoint for translation. Settings and translation cache are stored locally with chrome.storage.local. PanSub does not include analytics, ads, tracking pixels, or an author-owned remote server.

PanSub requires captions to be enabled in the Panopto player.
```

## Privacy 标签页

Single purpose：

```text
PanSub translates visible Panopto lecture captions and displays them as a subtitle overlay for the current recording page.
```

`storage` 权限解释：

```text
Used to save the user's PanSub settings, enabled state, and local translation cache on the device.
```

Panopto 域名权限解释：

```text
Used only on matching Panopto pages to read visible caption text rendered by the Panopto player and display the translated subtitle overlay.
```

用户数据处理说明：

```text
PanSub reads visible caption text on Panopto recording pages. The current caption text is sent to Google Translate for translation. PanSub does not sell user data, does not use data for advertising, does not use data for creditworthiness or lending, and does not transfer data to an author-owned remote server.
```

需要披露的数据类型：

```text
Website content: visible Panopto caption text used for translation.
```
