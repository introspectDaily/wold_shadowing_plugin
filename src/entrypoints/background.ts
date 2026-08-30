export default defineBackground(() => {
  const MENU_ID = 'lookup-word';

  const registerMenu = () => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: '在「单词跟读」中查询“%s”',
        contexts: ['selection'],
      });
    });
  };

  chrome.runtime.onInstalled.addListener(registerMenu);
  chrome.runtime.onStartup.addListener(registerMenu);

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !info.selectionText) return;
    const word = info.selectionText.trim().split(/\s+/)[0];
    if (!word) return;
    void chrome.storage.local.set({
      pendingLookup: { word, at: Date.now() },
    });
    if (tab?.windowId != null && chrome.sidePanel?.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
  });

  // 有道页面上的面板请求打开侧边栏
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'open-sidepanel') {
      const windowId = sender.tab?.windowId;
      if (windowId != null && chrome.sidePanel?.open) {
        chrome.sidePanel
          .open({ windowId })
          .then(() => sendResponse({ ok: true }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
      } else {
        sendResponse({ ok: false, error: 'no window' });
      }
      return true; // 异步响应
    }
  });
});
