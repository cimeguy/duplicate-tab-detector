const list = document.getElementById('list');
const summary = document.getElementById('summary');

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
