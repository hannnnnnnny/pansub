chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'PANSUB_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
  }
});
