chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: false,
    speed: 1.0,
    extraMode: false,
    extraSpeed: 10
  });
});