// background service worker
// sleep - event - wakes - runs handler - idle

// fires when toolbar icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("workbench.html"),
  });
});
