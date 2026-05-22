const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

function render(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? '实时翻译 Panopto 英文字幕' : '已关闭，字幕悬浮层已隐藏';
}

chrome.storage.local.get(['pansubEnabled'], (result) => {
  const enabled = result.pansubEnabled !== false;
  render(enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ pansubEnabled: enabled }, () => {
    render(enabled);
  });
});
