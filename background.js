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

// [色值, 渐变终止色] 每组重复用不同颜色
const DUP_COLORS = [
  ['#ff6b35', '#ff9a5c'], // 橙
  ['#4a90d9', '#6fb3f5'], // 蓝
  ['#5cb85c', '#7dd87d'], // 绿
  ['#9b59b6', '#c07ee0'], // 紫
  ['#e05c5c', '#f07f7f'], // 红
  ['#17a2b8', '#40c4d8'], // 青
  ['#f5a623', '#f7c05c'], // 黄
  ['#e91e8c', '#f06ab5'], // 粉
];

async function applyBanner(tabId, isDuplicate, count, color) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (isDuplicate, count, color) => {
        const ID = '__dup_tab_banner__';
        const TITLE_KEY = '__dup_tab_orig_title__';
        const FAVICON_KEY = '__dup_tab_orig_favicon__';

        // ── 还原 ──
        if (!isDuplicate) {
          const el = document.getElementById(ID);
          if (el) el.remove();

          if (window[TITLE_KEY] !== undefined) {
            document.title = window[TITLE_KEY];
            delete window[TITLE_KEY];
          }
          const origFavicon = window[FAVICON_KEY];
          if (origFavicon !== undefined) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
            link.href = origFavicon;
            delete window[FAVICON_KEY];
          }
          return;
        }

        const [c1, c2] = color;

        // ── 横幅 ──
        let el = document.getElementById(ID);
        if (!el) {
          el = document.createElement('div');
          el.id = ID;
          document.documentElement.appendChild(el);
        }
        el.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
          `background:linear-gradient(90deg,${c1},${c2})`,
          'color:#fff', 'font:bold 13px/32px -apple-system,sans-serif',
          'text-align:center', 'letter-spacing:.3px',
          'box-shadow:0 2px 6px rgba(0,0,0,.25)', 'cursor:default',
        ].join(';');
        el.textContent = `⚠  此页面已重复打开 ${count} 次`;

        // ── 标题前缀 ──
        if (window[TITLE_KEY] === undefined) {
          window[TITLE_KEY] = document.title;
        }
        if (!document.title.startsWith('⚠ ')) {
          document.title = '⚠ ' + window[TITLE_KEY];
        }

        // ── Favicon 彩色圆点 ──
        if (window[FAVICON_KEY] === undefined) {
          const existing = document.querySelector("link[rel~='icon']");
          window[FAVICON_KEY] = existing ? existing.href : '';
        }
        const sz = 32;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = sz;
        const ctx = canvas.getContext('2d');
        const origSrc = window[FAVICON_KEY];
        const draw = () => {
          ctx.beginPath();
          ctx.arc(sz * 0.72, sz * 0.72, sz * 0.26, 0, Math.PI * 2);
          ctx.fillStyle = c1;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sz * 0.72, sz * 0.72, sz * 0.26, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = sz * 0.08;
          ctx.stroke();
          let link = document.querySelector("link[rel~='icon']");
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
          link.href = canvas.toDataURL();
        };
        if (origSrc) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { ctx.drawImage(img, 0, 0, sz, sz); draw(); };
          img.onerror = draw;
          img.src = origSrc;
        } else {
          draw();
        }
      },
      args: [isDuplicate, count, color],
    });
  } catch {
    // 无法注入（PDF、扩展页等），忽略
  }
}

function urlColorIndex(url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  return Math.abs(h) % DUP_COLORS.length;
}

async function refreshAll() {
  const duplicates = await findDuplicates();
  const dupTabIdSet = new Map(); // tabId -> { count, color }
  for (const [url, tabList] of duplicates.entries()) {
    const color = DUP_COLORS[urlColorIndex(url)];
    for (const tab of tabList) dupTabIdSet.set(tab.id, { count: tabList.length, color });
  }

  const allTabs = await chrome.tabs.query({});
  await Promise.all(allTabs.map(tab => {
    if (!isScriptable(tab.url)) return;
    const info = dupTabIdSet.get(tab.id);
    return applyBanner(tab.id, !!info, info ? info.count : 0, info ? info.color : null);
  }));

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
  if (msg.type === 'previewGroupByTitle') {
    previewGroupByTitle().then(result => sendResponse(result));
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

async function previewGroupByTitle() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const siteMap = new Map();
  for (const tab of tabs) {
    if (!isScriptable(tab.url)) continue;
    const site = extractSiteName(tab.title, tab.url);
    if (!siteMap.has(site)) siteMap.set(site, []);
    siteMap.get(site).push({ id: tab.id, title: tab.title });
  }
  const groups = [];
  for (const [site, tabs] of siteMap) {
    if (tabs.length < 2) continue;
    groups.push({ site, count: tabs.length, tabIds: tabs.map(t => t.id) });
  }
  return { groups };
}

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
