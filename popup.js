const SETTINGS_KEY = 'pansubSettings';

const DEFAULT_SETTINGS = {
  enabled: true,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual',
  subtitlePosition: 'auto',
  fontSize: 24,
  originalFontSize: 15,
  maxWidth: 80,
  backgroundOpacity: 76,
  hideNativeCaptions: false,
  cacheEnabled: true,
  debugLogs: true,
  floatingButtonEnabled: true,
  floatingButtonSide: 'right',
  floatingButtonOpacity: 78,
  floatingButtonHoverOnly: false
};

const enabled = document.getElementById('enabled');
const displayMode = document.getElementById('displayMode');
const subtitlePosition = document.getElementById('subtitlePosition');
const status = document.getElementById('status');
const openOptions = document.getElementById('openOptions');

let settings = { ...DEFAULT_SETTINGS };

function render() {
  enabled.checked = settings.enabled;
  displayMode.value = settings.displayMode;
  subtitlePosition.value = settings.subtitlePosition;
  status.textContent = settings.enabled ? 'Running on Panopto pages' : 'Disabled';
}

function save() {
  settings = {
    ...settings,
    enabled: enabled.checked,
    displayMode: displayMode.value,
    subtitlePosition: subtitlePosition.value
  };
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, render);
}

chrome.storage.local.get([SETTINGS_KEY, 'pansubEnabled'], (result) => {
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (typeof result.pansubEnabled === 'boolean') {
    settings.enabled = result.pansubEnabled;
  }
  render();
});

enabled.addEventListener('change', save);
displayMode.addEventListener('change', save);
subtitlePosition.addEventListener('change', save);

openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
