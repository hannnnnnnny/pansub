# PanSub Privacy Policy

PanSub is a Chrome extension for showing translated subtitles on Panopto recording pages.

## Data PanSub Reads

PanSub reads the visible subtitle text rendered by the Panopto player on matching Panopto pages. It uses that text to create the translated subtitle overlay.

## Translation Requests

When translation is enabled, PanSub sends the current caption text to the Google Translate endpoint:

```text
https://translate.googleapis.com/translate_a/single
```

PanSub does not send the caption text to a server owned by the extension author. Google may process the text according to its own service policies.

Do not use PanSub on confidential or sensitive recordings if sending caption text to Google Translate is not acceptable for your use case.

## Local Storage

PanSub stores the following data locally with `chrome.storage.local`:

- Extension enabled or disabled state
- Subtitle display settings
- Translation cache for repeated caption lines

The translation cache is stored on your device to reduce repeated translation requests. You can disable the cache in PanSub settings or clear extension data from Chrome.

## Analytics and Tracking

PanSub does not include analytics, advertising, tracking pixels, or a remote account system.

## Permissions

PanSub requests:

- `storage`, used for settings and local translation cache
- Access to matching Panopto domains, used to read visible captions and render the subtitle overlay

## Contact

For questions or issues, use the GitHub repository:

```text
https://github.com/hannnnnnnny/pansub
```

---

# PanSub 隐私政策

PanSub 是一个 Chrome 扩展，用于在 Panopto 课程录像页面上显示翻译字幕。

## PanSub 读取的数据

PanSub 会读取 Panopto 播放器在页面上渲染出来的可见字幕文本，并用这些文本生成翻译字幕悬浮层。

## 翻译请求

启用翻译时，PanSub 会把当前字幕文本发送到 Google Translate 接口：

```text
https://translate.googleapis.com/translate_a/single
```

PanSub 不会把字幕文本发送到扩展作者自己拥有的服务器。Google 可能会根据其服务政策处理这些文本。

如果你的课程录像包含机密或敏感内容，并且不适合把字幕文本发送给 Google Translate，请不要在这些录像上使用 PanSub。

## 本地存储

PanSub 会通过 `chrome.storage.local` 在你的设备本地保存：

- 扩展开关状态
- 字幕显示设置
- 重复字幕行的翻译缓存

翻译缓存只用于减少重复翻译请求。你可以在 PanSub 设置页关闭缓存，也可以在 Chrome 中清除扩展数据。

## 分析和追踪

PanSub 不包含分析统计、广告、追踪像素或远程账号系统。

## 权限

PanSub 请求以下权限：

- `storage`，用于保存设置和本地翻译缓存
- Panopto 匹配域名访问权限，用于读取可见字幕并渲染字幕悬浮层

## 联系方式

如有问题，请通过 GitHub 仓库反馈：

```text
https://github.com/hannnnnnnny/pansub
```
