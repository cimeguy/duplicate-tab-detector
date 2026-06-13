const list = document.getElementById('list');
const summary = document.getElementById('summary');
const groupBtn = document.getElementById('group-btn');
const groupMsg = document.getElementById('group-msg');
const groupPreview = document.getElementById('group-preview');
const previewRows = document.getElementById('preview-rows');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');

let pendingGroups = [];

groupBtn.addEventListener('click', () => {
  groupBtn.disabled = true;
  groupBtn.textContent = '分析中…';
  chrome.runtime.sendMessage({ type: 'previewGroupByTitle' }, ({ groups }) => {
    groupBtn.disabled = false;
    groupBtn.textContent = '🗂 按标题归类标签';
    if (!groups.length) {
      groupMsg.textContent = '没有可归类的标签（需同一网站 2 个以上）';
      setTimeout(() => { groupMsg.textContent = ''; }, 3000);
      return;
    }
    pendingGroups = groups;
    previewRows.innerHTML = '';
    for (const g of groups) {
      const row = document.createElement('div');
      row.className = 'preview-row';
      row.innerHTML = `<span>${g.site}</span><span class="preview-count">${g.count} 个标签</span>`;
      previewRows.appendChild(row);
    }
    groupPreview.style.display = 'block';
  });
});

cancelBtn.addEventListener('click', () => {
  groupPreview.style.display = 'none';
  pendingGroups = [];
});

confirmBtn.addEventListener('click', () => {
  confirmBtn.disabled = true;
  confirmBtn.textContent = '归类中…';
  chrome.runtime.sendMessage({ type: 'groupByTitle' }, ({ groupCount }) => {
    groupPreview.style.display = 'none';
    confirmBtn.disabled = false;
    confirmBtn.textContent = '确认归类';
    pendingGroups = [];
    groupMsg.textContent = `已创建 ${groupCount} 个分组 ✓`;
    setTimeout(() => { groupMsg.textContent = ''; }, 3000);
  });
});

function render(groups) {
  list.innerHTML = '';
  if (!groups || !groups.length) {
    summary.textContent = '无重复标签';
    list.innerHTML = '<div class="empty">🎉 当前没有重复的标签页</div>';
    return;
  }

  const total = groups.reduce((s, g) => s + g.tabs.length, 0);
  summary.textContent = `${groups.length} 组，共 ${total} 个重复`;

  for (const group of groups) {
    const div = document.createElement('div');
    div.className = 'group';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = group.url;
    header.title = group.url;
    div.appendChild(header);

    group.tabs.forEach((tab, i) => {
      const row = document.createElement('div');
      row.className = 'tab-row';
      row.title = '点击跳转到此标签';

      const img = document.createElement('img');
      img.src = tab.favIconUrl || '';
      img.onerror = () => { img.style.visibility = 'hidden'; };
      row.appendChild(img);

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || '(无标题)';
      row.appendChild(title);

      const idx = document.createElement('span');
      idx.className = 'tab-idx';
      idx.textContent = `#${i + 1}`;
      row.appendChild(idx);

      row.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'focusTab', tabId: tab.id });
      });

      div.appendChild(row);
    });

    list.appendChild(div);
  }

  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.textContent = '点击任意行可跳转到对应标签页';
  list.appendChild(tip);
}

chrome.runtime.sendMessage({ type: 'getDuplicates' }, render);
