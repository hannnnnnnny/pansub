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

const controls = {
  enabled: document.getElementById('enabled'),
  targetLanguage: document.getElementById('targetLanguage'),
  displayMode: document.getElementById('displayMode'),
  subtitlePosition: document.getElementById('subtitlePosition'),
  fontSize: document.getElementById('fontSize'),
  originalFontSize: document.getElementById('originalFontSize'),
  maxWidth: document.getElementById('maxWidth'),
  backgroundOpacity: document.getElementById('backgroundOpacity'),
  hideNativeCaptions: document.getElementById('hideNativeCaptions'),
  cacheEnabled: document.getElementById('cacheEnabled'),
  debugLogs: document.getElementById('debugLogs'),
  floatingButtonEnabled: document.getElementById('floatingButtonEnabled'),
  floatingButtonSide: document.getElementById('floatingButtonSide'),
  floatingButtonOpacity: document.getElementById('floatingButtonOpacity'),
  floatingButtonHoverOnly: document.getElementById('floatingButtonHoverOnly')
};

const outputs = {
  fontSize: document.getElementById('fontSizeValue'),
  originalFontSize: document.getElementById('originalFontSizeValue'),
  maxWidth: document.getElementById('maxWidthValue'),
  backgroundOpacity: document.getElementById('backgroundOpacityValue'),
  floatingButtonOpacity: document.getElementById('floatingButtonOpacityValue')
};

let settings = { ...DEFAULT_SETTINGS };
let saveTimer = null;
const toast = document.getElementById('saved');

function render() {
  for (const [key, control] of Object.entries(controls)) {
    if (!control) continue;
    if (control.type === 'checkbox') {
      control.checked = Boolean(settings[key]);
    } else {
      control.value = settings[key];
    }
  }
  renderOutputs();
}

function renderOutputs() {
  outputs.fontSize.textContent = `${settings.fontSize}px`;
  outputs.originalFontSize.textContent = `${settings.originalFontSize}px`;
  outputs.maxWidth.textContent = `${settings.maxWidth}%`;
  outputs.backgroundOpacity.textContent = `${settings.backgroundOpacity}%`;
  outputs.floatingButtonOpacity.textContent = `${settings.floatingButtonOpacity}%`;
}

function readSettings() {
  const next = { ...settings };
  for (const [key, control] of Object.entries(controls)) {
    if (!control) continue;
    if (control.type === 'checkbox') {
      next[key] = control.checked;
    } else if (control.type === 'range') {
      next[key] = Number(control.value);
    } else {
      next[key] = control.value;
    }
  }
  return next;
}

function scheduleSave() {
  settings = readSettings();
  renderOutputs();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({
      [SETTINGS_KEY]: settings,
      pansubEnabled: settings.enabled
    }, showSaved);
  }, 150);
}

function showSaved() {
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 900);
}

chrome.storage.local.get([SETTINGS_KEY, 'pansubEnabled'], (result) => {
  settings = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (typeof result.pansubEnabled === 'boolean') {
    settings.enabled = result.pansubEnabled;
  }
  render();
});

for (const control of Object.values(controls)) {
  if (control) control.addEventListener('input', scheduleSave);
}

document.getElementById('reset').addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  render();
  chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    pansubEnabled: settings.enabled
  }, showSaved);
});
