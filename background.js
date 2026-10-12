// ErrorGeek background: adds the right-click menu for selected text.
const api = globalThis.browser && globalThis.browser.contextMenus ? globalThis.browser : chrome;
const MENU = 'errorgeek-lookup';

function makeMenu() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({ id: MENU, title: 'Look up error code "%s"', contexts: ['selection'] });
  });
}
api.runtime.onInstalled.addListener(makeMenu);
if (api.runtime.onStartup) api.runtime.onStartup.addListener(makeMenu);

function lookupUrl(text) {
  return api.runtime.getURL('popup.html') + '?win=1&q=' + encodeURIComponent(String(text || '').slice(0, 200));
}

async function openLookup(text) {
  const url = lookupUrl(text);
  try {
    return await api.windows.create({ url, type: 'popup', width: 480, height: 680 });
  } catch (e) {
    return api.tabs.create({ url });
  }
}

function onMenuClick(info) {
  if (info.menuItemId === MENU) return openLookup(info.selectionText);
}
api.contextMenus.onClicked.addListener(onMenuClick);
globalThis.onMenuClick = onMenuClick;
