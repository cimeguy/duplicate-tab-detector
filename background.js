function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return u.origin + path + u.search + u.hash;
  } catch {
    return url;
  }
}

function isScriptable(url) {
  if (!url) return false;
  return !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('about:');
}

async function findDuplicates() {
  const tabs = await chrome.tabs.query({});
  const urlMap = new Map();
  for (const tab of tabs) {
    if (!isScriptable(tab.url)) continue;
    const key = normalizeUrl(tab.url);
    if (!urlMap.has(key)) urlMap.set(key, []);
    urlMap.get(key).push(tab);
  }
  const duplicates = new Map();
  for (const [url, tabList] of urlMap) {
    if (tabList.length > 1) duplicates.set(url, tabList);
  }
  return duplicates;
}

async function applyBanner(tabId, isDuplicate, count) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (isDuplicate, count) => {
        const ID = '__dup_tab_banner__';
        let el = document.getElementById(ID);
        if (!isDuplicate) {
          if (el) el.remove();
          return;
        }
        if (!el) {
          el = document.createElement('div');
          el.id = ID;
          el.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
            'background:linear-gradient(90deg,#ff6b35,#ff9a5c)',
            'color:#fff', 'font:bold 13px/32px -apple-system,sans-serif',
            'text-align:center', 'letter-spacing:.3px',
            'box-shadow:0 2px 6px rgba(0,0,0,.25)', 'cursor:default',
          ].join(';');
          document.documentElement.appendChild(el);
        }
        el.textContent = `⚠  此页面已重复打开 ${count} 次`;
      },
      args: [isDuplicate, count],
    });
  } catch {
    // 无法注入（PDF、扩展页等），忽略
  }
}

async function refreshAll() {
  const duplicates = await findDuplicates();
  const dupTabIdSet = new Map(); // tabId -> count
  for (const tabList of duplicates.values()) {
    for (const tab of tabList) dupTabIdSet.set(tab.id, tabList.length);
  }

  const allTabs = await chrome.tabs.query({});
  for (const tab of allTabs) {
    if (!isScriptable(tab.url)) continue;
    const isDup = dupTabIdSet.has(tab.id);
    await applyBanner(tab.id, isDup, isDup ? dupTabIdSet.get(tab.id) : 0);
  }

  // 更新 badge
  const groupCount = duplicates.size;
  chrome.action.setBadgeText({ text: groupCount > 0 ? String(groupCount) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6b35' });
}

// 事件监听
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status === 'complete') refreshAll();
});
chrome.tabs.onRemoved.addListener(() => setTimeout(refreshAll, 100));
chrome.tabs.onCreated.addListener(() => setTimeout(refreshAll, 300));

// popup 通信
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getDuplicates') {
    findDuplicates().then(dupes => {
      const result = [...dupes.entries()].map(([url, tabs]) => ({
        url,
        tabs: tabs.map(t => ({ id: t.id, title: t.title, favIconUrl: t.favIconUrl })),
      }));
      sendResponse(result);
    });
    return true;
  }
  if (msg.type === 'focusTab') {
    chrome.tabs.update(msg.tabId, { active: true });
    chrome.tabs.get(msg.tabId, tab => chrome.windows.update(tab.windowId, { focused: true }));
  }
  if (msg.type === 'closeTab') {
    chrome.tabs.remove(msg.tabId).then(() => refreshAll());
  }
  if (msg.type === 'closeAllDuplicates') {
    findDuplicates().then(dupes => {
      for (const tabList of dupes.values()) {
        tabList.slice(1).forEach(t => chrome.tabs.remove(t.id));
      }
      setTimeout(refreshAll, 200);
    });
  }
  if (msg.type === 'groupByTitle') {
    groupTabsByTitle().then(result => sendResponse(result));
    return true;
  }
});

// 从标题提取网站名，如 "文章标题 - GitHub" → "GitHub"
function extractSiteName(title, url) {
  if (title) {
    const sep = [' - ', ' | ', ' – ', ' · ', ' • '];
    for (const s of sep) {
      const parts = title.split(s);
      if (parts.length > 1) return parts[parts.length - 1].trim();
    }
  }
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '其他';
  }
}

const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

async function groupTabsByTitle() {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  // 按网站名归类
  const siteMap = new Map();
  for (const tab of tabs) {
    if (!isScriptable(tab.url)) continue;
    const site = extractSiteName(tab.title, tab.url);
    if (!siteMap.has(site)) siteMap.set(site, []);
    siteMap.get(site).push(tab.id);
  }

  let colorIdx = 0;
  let groupCount = 0;

  for (const [site, tabIds] of siteMap) {
    if (tabIds.length < 2) continue; // 只归类有 2 个以上标签的网站
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: site,
      color: GROUP_COLORS[colorIdx % GROUP_COLORS.length],
      collapsed: false,
    });
    colorIdx++;
    groupCount++;
  }

  return { groupCount };
}
