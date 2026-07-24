# PanSub Privacy Policy

PanSub is a Chrome extension for showing translated subtitles on Panopto recording pages.

PanSub is intended only for course content the user is authorised to access and for authorised personal study. Users must not use PanSub to export or share course audio, captions, or translations. PanSub is independent and is not affiliated with, authorised by, sponsored by, or endorsed by Panopto, Inc. or Waipapa Taumata Rau | University of Auckland.

## Data PanSub Reads

PanSub reads the visible subtitle text rendered by the Panopto player on matching Panopto pages. It uses that text to create the translated subtitle overlay. When the user explicitly starts Audio Mode, PanSub also captures audio from that Panopto tab for on-device English speech recognition.

## Translation Requests

In native-caption mode, PanSub sends the current caption text to the Google Translate endpoint:

```text
https://translate.googleapis.com/translate_a/single
```

PanSub does not send the caption text to a server owned by the extension author. Google may process the text according to its own service policies.

Do not use PanSub on confidential or sensitive recordings if sending caption text to Google Translate is not acceptable for your use case.

## Audio Mode Beta

PanSub captures audio only from the tab you explicitly start. Chrome performs English speech recognition on this device. PanSub does not save the audio or a transcript. If Chrome's local Translator is unavailable, recognized text is sent to Google Translate only after you separately allow that fallback.

Audio capture stops when you stop Audio Mode, close the captured tab, or navigate away from Panopto. PanSub releases the captured media tracks after stopping. Audio is not sent to the extension author or Google Translate.

## Local Storage

PanSub stores the following data locally with `chrome.storage.local`:

- Extension enabled or disabled state
- Subtitle display settings
- Audio recognition language and Audio Mode consent choices

Translated caption lines are cached only in memory while the current Panopto page remains open. They are not written to `chrome.storage.local`, and the cache disappears when the page closes. PanSub removes persistent caption caches created by older versions.

## Analytics and Tracking

PanSub does not include analytics, advertising, tracking pixels, or a remote account system.

## Permissions

PanSub requests:

- `storage`, used for settings, enabled state, and consent choices
- `activeTab`, used to identify the Panopto tab where the user starts Audio Mode
- `offscreen`, used to keep the user-started tab audio stream and on-device recognition alive while the popup is closed
- `tabCapture`, used only after the user starts Audio Mode and only for that active tab's audio
- Access to matching Panopto domains, used to read visible captions and render the subtitle overlay
- Optional access to `translate.googleapis.com`, requested only if the user allows Audio Mode's recognized-text fallback and removable from PanSub settings

## Contact

For questions or issues, use the GitHub repository:

```text
https://github.com/hannnnnnnny/pansub
```

---

# PanSub 隐私政策

PanSub 是一个 Chrome 扩展，用于在 Panopto 课程录像页面上显示翻译字幕。

PanSub 仅用于用户获准访问的课程内容和个人学习。用户不得使用 PanSub 导出或分享课程音频、字幕或译文。PanSub 是独立开发的非官方扩展，与 Panopto, Inc. 及 Waipapa Taumata Rau | University of Auckland 不存在隶属、授权、赞助或官方认可关系。

## PanSub 读取的数据

PanSub 会读取 Panopto 播放器在页面上渲染出来的可见字幕文本，并用这些文本生成翻译字幕悬浮层。只有用户主动启动音频模式时，PanSub 才会捕获该 Panopto 标签页的音频，用于设备端英语语音识别。

## 翻译请求

在原生字幕模式下，PanSub 会把当前字幕文本发送到 Google Translate 接口：

```text
https://translate.googleapis.com/translate_a/single
```

PanSub 不会把字幕文本发送到扩展作者自己拥有的服务器。Google 可能会根据其服务政策处理这些文本。

如果你的课程录像包含机密或敏感内容，并且不适合把字幕文本发送给 Google Translate，请不要在这些录像上使用 PanSub。

## 音频模式 Beta

PanSub 只捕获你主动启动的标签页音频。Chrome 在本设备完成英语语音识别，PanSub 不保存音频或完整转录。如果 Chrome 本地 Translator 不可用，只有在你另行允许后，识别出的文字才会发送到 Google Translate。

停止音频模式、关闭被捕获的标签页或离开 Panopto 页面时，音频捕获会结束，并释放媒体轨道。音频本身不会发送给扩展作者或 Google Translate。

## 本地存储

PanSub 会通过 `chrome.storage.local` 在你的设备本地保存：

- 扩展开关状态
- 字幕显示设置
- 音频识别语言和音频模式授权选择

已翻译字幕仅在当前 Panopto 页面保持打开时缓存在内存中，不会写入 `chrome.storage.local`，关闭页面后缓存自动消失。PanSub 会清除旧版本创建的持久字幕缓存。

## 分析和追踪

PanSub 不包含分析统计、广告、追踪像素或远程账号系统。

## 权限

PanSub 请求以下权限：

- `storage`，用于保存设置、启用状态和授权选择
- `activeTab`，用于确认用户从哪个 Panopto 标签页启动音频模式
- `offscreen`，用于在 popup 关闭后继续维持用户主动启动的标签页音频流和本地识别
- `tabCapture`，仅在用户启动音频模式后使用，只捕获当前标签页音频
- Panopto 匹配域名访问权限，用于读取可见字幕并渲染字幕悬浮层
- 可选的 `translate.googleapis.com` 访问权限，仅在用户允许音频模式的识别文字回退时请求，可在 PanSub 设置中撤销

## 联系方式

如有问题，请通过 GitHub 仓库反馈：

```text
https://github.com/hannnnnnnny/pansub
```
