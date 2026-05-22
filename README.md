# PanSub

> Chrome extension that adds real-time Chinese subtitles to Panopto lecture recordings.

PanSub 监听 Panopto 播放器的英文字幕节点，调用 Google Translate 实时翻译为中文，并以双语悬浮字幕的形式叠加在视频底部。

## 预览

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│                  [ Panopto 视频区 ]                   │
│                                                      │
│                                                      │
│        ┌────────────────────────────────────┐        │
│        │  Today we'll discuss neural nets   │  ← 英文 14px / 0.7
│        │  今天我们来讨论神经网络             │  ← 中文 20px 白色
│        └────────────────────────────────────┘        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

悬浮字幕样式：

- 固定定位，距底 80px，水平居中
- 最大宽度 80%，背景 `rgba(0,0,0,0.75)`，圆角 8px
- 英文原文 14px，透明度 0.7
- 中文译文 20px，纯白
- `z-index: 99999`，`pointer-events: none`（不影响播放器交互）

Popup（点击工具栏图标）：

```
┌──────────────────────────┐
│  PanSub 已启用            │
│  实时翻译 Panopto 英文字幕 │
│                          │
│  显示字幕         [ ●━━ ] │
└──────────────────────────┘
```

## 功能

- 自动识别 Panopto 字幕节点 `#dockedCaptionText`
- `MutationObserver` 监听字幕变化（childList / subtree / characterData）
- 600ms debounce + 内存 `Map` 缓存，避免重复请求
- 双语悬浮层（英文原文 + 中文译文）
- 一键开关，状态持久化到 `chrome.storage.local`

## 安装

1. 克隆仓库
   ```bash
   git clone https://github.com/hannnnnnnny/pansub.git
   ```
2. 打开 Chrome，访问 `chrome://extensions`
3. 打开右上角"开发者模式"
4. 点击"加载已解压的扩展程序"，选择本仓库目录
5. 打开任意 Panopto 视频，开启字幕（CC），即可看到底部中文悬浮字幕

## 匹配域名

- `*://*.panopto.com/*`
- `*://*.au.panopto.com/*`

如需支持其他 Panopto 子域，编辑 `manifest.json` 的 `host_permissions` 与 `content_scripts.matches`。

## 文件结构

```
pansub/
├── manifest.json   # MV3 配置
├── content.js      # 字幕监听 + 翻译 + 悬浮层渲染
├── popup.html      # 工具栏弹窗 UI
├── popup.js        # 开关逻辑
└── README.md
```

## 技术说明

- **Manifest V3**，权限 `storage` + `activeTab`
- 翻译接口：`translate.googleapis.com/translate_a/single`（无 key，`client=gtx`）
- 缓存：进程内 `Map<原文, 译文>`，刷新页面即清空
- 控制台日志：`[PanSub] 新字幕: ...`，便于调试

## 已知限制

- 依赖 Google Translate 免费接口，可能有速率限制或地区不可用
- 仅在字幕节点 `#dockedCaptionText` 存在时工作（需开启 Panopto 自带 CC）
- 长字幕的翻译延迟取决于网络

## License

见 [LICENSE](LICENSE)。
