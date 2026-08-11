/* ============ 火哥的个人站 · 个人工作台 逻辑 ============ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    var box = $('#toast');
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3600);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  var safeFetch = (window.fetch || function () { return Promise.reject(new Error('fetch unavailable')); });
  function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function todayStr() { return fmtDate(new Date()); }

  /* ---------- 数据 ---------- */
  var PRI = [
    { v: 0, label: '又急又重要', color: '#e5484d' },
    { v: 1, label: '急但不重要', color: '#f5a623' },
    { v: 2, label: '不急但重要', color: '#2f6fed' },
    { v: 3, label: '不急不重要', color: '#9ca3af' }
  ];
  var todos = LS.get('hg_todos', []);
  var kb = LS.get('hg_kb', { inbox: [], material: [], case: [], sop: [], contacts: [] });
  var KB_TABS = [
    { k: 'inbox', label: '灵感收件箱', img: false },
    { k: 'material', label: '素材库', img: true },
    { k: 'case', label: '案例库', img: true },
    { k: 'sop', label: '方法论 SOP', img: false },
    { k: 'contacts', label: '人脉关系', img: false }
  ];
  var NEWS_TABS = [
    { k: 'weibo', label: '微博' },
    { k: 'baidu', label: '百度' },
    { k: 'zhihu', label: '知乎' },
    { k: 'bilibili', label: '哔哩哔哩' }
  ];
  var NEWS_FALLBACK = {
    weibo: [ { title: '热搜示例：国产大模型发布新版本', hot: '486万' }, { title: '热搜示例：高温天气持续多日', hot: '372万' }, { title: '热搜示例：暑期文旅市场升温', hot: '265万' }, { title: '热搜示例：AI 编程工具迎来更新', hot: '198万' }, { title: '热搜示例：新能源汽车出口创新高', hot: '156万' } ],
    baidu: [ { title: '百度热点示例：人工智能训练师新职业标准发布', hot: '1200万' }, { title: '百度热点示例：多地发布高温预警', hot: '980万' }, { title: '百度热点示例：新版考试大纲即将实施', hot: '760万' }, { title: '百度热点示例：AI 改变职场办公方式', hot: '540万' }, { title: '百度热点示例：暑期档电影票房破纪录', hot: '430万' } ],
    zhihu: [ { title: '知乎热榜示例：如何系统学习人工智能？', hot: '890万' }, { title: '知乎热榜示例：工作中用 AI 提效的真实经验', hot: '720万' }, { title: '知乎热榜示例：普通人如何建立个人知识库', hot: '610万' }, { title: '知乎热榜示例：转行做数据相关工作的建议', hot: '500万' }, { title: '知乎热榜示例：哪些技能在未来三年最值钱', hot: '410万' } ],
    bilibili: [ { title: 'B站热门示例：AI 训练营全套教程', hot: '320万' }, { title: 'B站热门示例：从零搭建个人网站', hot: '280万' }, { title: 'B站热门示例：程序员的一天 Vlog', hot: '210万' }, { title: 'B站热门示例：年度科技盘点', hot: '180万' }, { title: 'B站热门示例：效率工具合集', hot: '150万' } ]
  };
  var currentView = 'plan', currentKbTab = 'inbox', currentNewsTab = 'weibo';
  (function () {
    var h = (location.hash || '').replace('#', '');
    if (['plan', 'kb', 'news', 'projects', 'settings'].indexOf(h) >= 0) currentView = h;
  })();
  var newsCache = {};   // tab -> {data, at}
  var selectedNews = null;

  function saveTodos() { LS.set('hg_todos', todos); }
  function saveKb() { LS.set('hg_kb', kb); }

  /* ---------- 首次打开预置示例数据（铁律6：含 1 条逾期 + 1 条已完成） ---------- */
  function seedDemo() {
    var now = Date.now(), day = 86400000;
    var overdue = new Date(now - 2 * day); overdue.setHours(9, 0, 0, 0);
    var soon = new Date(now + 1 * day); soon.setHours(10, 30, 0, 0);
    var later = new Date(now + 5 * day); later.setHours(15, 0, 0, 0);
    todos = [
      { id: 'seed-1', text: '示例：跟进 Renesas 百度品牌项目周报（这条已逾期，方便你体验标红）', pri: 0, remindAt: overdue.toISOString(), done: false, notified: true, createdAt: new Date(now - 3 * day).toISOString() },
      { id: 'seed-2', text: '示例：整理本周 AI 新闻选题', pri: 2, remindAt: soon.toISOString(), done: false, notified: false, createdAt: new Date(now - 1 * day).toISOString() },
      { id: 'seed-3', text: '示例：读一篇 SEM 出价策略文章', pri: 3, remindAt: later.toISOString(), done: false, notified: false, createdAt: new Date(now).toISOString() },
      { id: 'seed-4', text: '示例（已完成）：配置新闻 AI 文案接口', pri: 1, remindAt: new Date(now - 1 * day).toISOString(), done: true, doneAt: new Date(now - 0.5 * day).toISOString(), notified: true, createdAt: new Date(now - 2 * day).toISOString() }
    ];
    kb.inbox = [ { id: 'seed-kb-1', text: '示例：知识库自动保存在本地浏览器，刷新不丢。切到「素材库 / 案例库」还能贴图（已加本地存储体积预警）。', img: null, createdAt: new Date(now - 1 * day).toISOString() } ];
    saveTodos(); saveKb();
  }

  /* ---------- 本地存储用量（UTF-16 字符数，浏览器通常上限约 5MB） ---------- */
  var LS_LIMIT = 5 * 1024 * 1024;
  function lsUsageWithoutKb() {
    var n = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k === 'hg_kb') continue;
      n += (k ? k.length : 0) + (localStorage.getItem(k) || '').length;
    }
    return n;
  }

  /* ---------- 提醒（声音 + 弹窗 + 系统通知） ---------- */
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      var ctx = new C();
      [0, 0.2].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
      });
    } catch (e) {}
  }
  function notifyTodo(t) {
    beep();
    toast('提醒：' + t.text);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('火哥的个人站', { body: t.text });
      }
    } catch (e) {}
  }
  function tickReminders() {
    var now = Date.now(), changed = false;
    todos.forEach(function (t) {
      if (t.done || t.notified || !t.remindAt) return;
      if (new Date(t.remindAt).getTime() <= now) {
        t.notified = true; changed = true;
        notifyTodo(t);
      }
    });
    if (changed) { saveTodos(); render(); }
  }

  /* ---------- 渲染 ---------- */
  var content = $('#content');
  function render() {
    if (currentView === 'plan') renderPlan();
    else if (currentView === 'kb') renderKb();
    else if (currentView === 'news') renderNews();
    else if (currentView === 'projects') renderProjects();
    else if (currentView === 'settings') renderSettings();
  }

  function menuActivate() {
    var items = document.querySelectorAll('.menu-item');
    items.forEach(function (it) {
      it.classList.toggle('active', it.getAttribute('data-view') === currentView);
    });
    if (location.hash !== '#' + currentView) {
      try { history.replaceState(null, '', '#' + currentView); } catch (e) { location.hash = currentView; }
    }
  }

  function renderPlan() {
    var today = todayStr();
    var todayList = [], laterList = [], doneList = [];
    todos.forEach(function (t) {
      if (t.done) { doneList.push(t); return; }
      var ds = t.remindAt ? fmtDate(new Date(t.remindAt)) : null;
      if (ds && ds <= today) todayList.push(t);
      else laterList.push(t);
    });
    todayList.sort(function (a, b) { return (a.remindAt || '') < (b.remindAt || '') ? -1 : 1; });
    laterList.sort(function (a, b) { return (a.remindAt || '') < (b.remindAt || '') ? -1 : 1; });
    doneList.sort(function (a, b) { return (b.doneAt || '') < (a.doneAt || '') ? -1 : 1; });

    var total = todos.length;
    var doneCount = doneList.length;
    var rate = total ? Math.round(doneCount / total * 100) : 0;
    var overdueCount = todayList.filter(function (t) { return t.remindAt && new Date(t.remindAt).getTime() < Date.now(); }).length;

    content.innerHTML =
      '<h2>计划安排</h2>' +
      '<p class="sub">今日待办自动归位 · 到点弹窗 + 响铃</p>' +
      statRingHtml(rate, total, doneCount, overdueCount) +
      '<section class="card"><h3>今天要处理' + (overdueCount ? ' <span class="badge-red">' + overdueCount + ' 项逾期</span>' : '') + '</h3>' +
        todoListHtml(todayList, '今天没有到点的待办，去下面添加并设定提醒时间吧', 'active') + '</section>' +
      '<section class="card"><h3>添加待做事项</h3>' +
        '<div class="add-line"><input id="td-text" type="text" placeholder="输入要做的某件事…"></div>' +
        '<div class="pri-row">' + PRI.map(function (p) {
          return '<span class="pri-opt' + (p.v === 0 ? ' sel' : '') + '" data-pri="' + p.v + '">' +
                 '<span class="dot" style="background:' + p.color + '"></span>' + p.label + '</span>';
        }).join('') + '</div>' +
        '<div class="form-row">' +
          '<input id="td-time" type="datetime-local" title="提醒时间（可留空）">' +
          '<button class="btn" id="td-add">+ 添加待办</button>' +
        '</div>' +
      '</section>' +
      '<div class="search-line"><input id="td-search" type="text" placeholder="搜索待办…"></div>' +
      '<section class="card"><h3>待做事项</h3>' + todoListHtml(laterList, '暂无待办', 'active') + '</section>' +
      '<section class="card"><h3>已完成（' + doneCount + '）</h3>' +
        (doneCount ? todoListHtml(doneList, '暂无', 'done') : '<p class="empty">还没有完成的待办</p>') + '</section>';

    var selPri = 0;
    var priEls = content.querySelectorAll('.pri-opt');
    priEls.forEach(function (el) {
      el.addEventListener('click', function () {
        selPri = parseInt(el.getAttribute('data-pri'), 10);
        priEls.forEach(function (e) { e.classList.toggle('sel', e === el); });
      });
    });
    $('#td-add').addEventListener('click', function () {
      var text = $('#td-text').value.trim();
      if (!text) { toast('先写点内容吧'); return; }
      var remindAt = null;
      var v = $('#td-time').value;
      if (v) { remindAt = new Date(v).toISOString(); }
      todos.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), text: text, pri: selPri, remindAt: remindAt, done: false, notified: false, createdAt: new Date().toISOString() });
      saveTodos(); render();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      toast('已添加待办');
    });
    var se = $('#td-search');
    if (se) se.addEventListener('input', function () {
      var q = se.value.trim().toLowerCase();
      content.querySelectorAll('.todo-row').forEach(function (r) {
        var tx = (r.querySelector('.txt') ? r.querySelector('.txt').textContent : '').toLowerCase();
        r.style.display = (!q || tx.indexOf(q) >= 0) ? '' : 'none';
      });
    });
  }

  function todoRowHtml(t, mode) {
    mode = mode || 'active';
    var p = PRI[t.pri] || PRI[3];
    var dot = '<span class="dot" style="background:' + p.color + '"></span>';
    if (mode === 'done') {
      var doneTxt = t.doneAt ? fmtDate(new Date(t.doneAt)) + ' ' + fmtTime(new Date(t.doneAt)) : '';
      return '<div class="todo-row done">' +
        dot +
        '<span class="txt">' + esc(t.text) + '</span>' +
        '<span class="time">已完成 ' + doneTxt + '</span>' +
        '<button class="icon-btn" data-act="td-restore" data-id="' + t.id + '">恢复</button>' +
        '<button class="icon-btn" data-act="td-del" data-id="' + t.id + '">删除</button>' +
        '</div>';
    }
    var timeTxt = t.remindAt ? fmtDate(new Date(t.remindAt)) + ' ' + fmtTime(new Date(t.remindAt)) : '未设时间';
    var overdue = t.remindAt && new Date(t.remindAt).getTime() < Date.now() && !t.done;
    return '<div class="todo-row' + (overdue ? ' overdue' : '') + '">' +
      dot +
      '<span class="txt">' + esc(t.text) + '</span>' +
      '<span class="time">' + timeTxt + (overdue ? ' · 逾期' : '') + '</span>' +
      '<button class="icon-btn" data-act="td-done" data-id="' + t.id + '">完成</button>' +
      '<button class="icon-btn" data-act="td-del" data-id="' + t.id + '">删除</button>' +
      '</div>';
  }
  function todoListHtml(list, empty, mode) {
    if (!list.length) return '<p class="empty">' + empty + '</p>';
    return list.map(function (t) { return todoRowHtml(t, mode); }).join('');
  }
  function statRingHtml(rate, total, doneCount, overdueCount) {
    var r = 26, c = 2 * Math.PI * r, off = c * (1 - rate / 100);
    return '<div class="stat-row">' +
      '<div class="stat-ring"><svg viewBox="0 0 70 70" width="72" height="72">' +
        '<circle cx="35" cy="35" r="' + r + '" fill="none" stroke="#e5e5e7" stroke-width="8"/>' +
        '<circle cx="35" cy="35" r="' + r + '" fill="none" stroke="#E8A33D" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 35 35)"/>' +
        '<text x="35" y="35" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="600" fill="#1a1a1a">' + rate + '%</text>' +
      '</svg></div>' +
      '<div class="stat-meta">' +
        '<div class="stat-num">' + total + ' <span>总待办</span></div>' +
        '<div class="stat-num">' + doneCount + ' <span>已完成</span></div>' +
        '<div class="stat-num' + (overdueCount ? ' warn' : '') + '">' + overdueCount + ' <span>逾期</span></div>' +
      '</div></div>';
  }

  function renderKb() {
    var tab = currentKbTab;
    var cfg = KB_TABS.filter(function (x) { return x.k === tab; })[0] || KB_TABS[0];
    var list = kb[tab] || [];
    list.sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1; });
    content.innerHTML =
      '<h2>知识库</h2>' +
      '<p class="sub">我的第二大脑 · 五个小本本，刷新不丢</p>' +
      '<div class="tabbar">' + KB_TABS.map(function (t) {
        return '<button class="tab' + (t.k === tab ? ' active' : '') + '" data-kbtab="' + t.k + '">' + t.label + '</button>';
      }).join('') + '</div>' +
      '<section class="card"><h3>' + cfg.label + '</h3>' +
        '<div class="add-line"><textarea id="kb-text" placeholder="记点什么…"></textarea></div>' +
        (cfg.img ? '<div class="form-row"><input id="kb-img" type="file" accept="image/*">' : '<div class="form-row">') +
        '<button class="btn" id="kb-add">保存</button></div>' +
      '</section>' +
      '<section class="card">' + list.map(function (e) {
        return '<div class="kb-entry"><div class="t">' + esc(e.text) + '</div>' +
          (e.img ? '<img src="' + e.img + '" alt="">' : '') +
          '<div class="meta">' + (e.createdAt ? fmtDate(new Date(e.createdAt)) + ' ' + fmtTime(new Date(e.createdAt)) : '') +
          ' <button class="icon-btn" data-act="kb-del" data-kb="' + tab + '" data-id="' + e.id + '">删除</button></div></div>';
      }).join('') + '</section>';
    $('#kb-add').addEventListener('click', function () {
      var text = $('#kb-text').value.trim();
      var img = null;
      var f = $('#kb-img');
      if (f && f.files && f.files[0]) {
        var file = f.files[0];
        var reader = new FileReader();
        reader.onload = function (ev) {
          compressImg(ev.target.result, function (dataUrl) {
            pushKb(tab, text, dataUrl);
          });
        };
        reader.readAsDataURL(file);
        return;
      }
      pushKb(tab, text, null);
    });
  }
  function pushKb(tab, text, img) {
    if (!text && !img) { toast('写点内容再保存'); return; }
    var arr = kb[tab] = kb[tab] || [];
    var entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text: text, img: img, createdAt: new Date().toISOString()
    };
    arr.push(entry);
    var label = (KB_TABS.filter(function (x) { return x.k === tab; })[0] || {}).label;
    // 预估保存后的总占用（不含旧的 hg_kb）
    var predicted = lsUsageWithoutKb() + JSON.stringify(kb).length;
    if (predicted > LS_LIMIT * 0.95) {
      arr.pop(); // 回滚，避免直接撑爆本地存储导致图片丢失
      toast('保存失败：本地存储已接近上限（约 ' + Math.round(LS_LIMIT / 1024 / 1024) + 'MB），请先到「设置 / 数据」清空部分内容（尤其是带图条目）再保存');
      render();
      return;
    }
    saveKb();
    var pct = Math.round(predicted / LS_LIMIT * 100);
    if (predicted > LS_LIMIT * 0.8) {
      toast('已保存到「' + label + '」 · 提醒：本地存储已用约 ' + pct + '%，接近上限，建议定期清理带图内容');
    } else {
      toast('已保存到「' + label + '」');
    }
    render();
  }
  function compressImg(dataUrl, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        var maxW = 800;
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { cb(dataUrl); };
      img.src = dataUrl;
    } catch (e) { cb(dataUrl); }
  }

  /* ---------- 每日新闻 ---------- */
  function renderNews() {
    var tab = currentNewsTab;
    var cache = newsCache[tab] || LS.get('hg_news_' + tab, null);
    if (cache && !newsCache[tab]) newsCache[tab] = cache;
    var list = cache ? cache.data : [];
    var loading = !cache;
    var sel = selectedNews && selectedNews.src === tab ? selectedNews : null;

    content.innerHTML =
      '<div class="news-head"><h2>每日新闻</h2>' +
      '<button class="btn ghost sm" id="news-refresh">↻ 刷新</button></div>' +
      '<p class="sub">自动抓取热搜 · 点开任意一条生成文案与选题</p>' +
      '<div class="tabbar">' + NEWS_TABS.map(function (t) {
        return '<button class="tab' + (t.k === tab ? ' active' : '') + '" data-newstab="' + t.k + '">' + t.label + '</button>';
      }).join('') + '</div>' +
      '<div id="news-body">' + (loading ? '<p class="empty">正在抓取热搜…</p>' :
        sel ? newsDetailHtml(sel) : newsListHtml(list, tab)) + '</div>';

    $('#news-refresh').addEventListener('click', function () {
      selectedNews = null;
      fetchNews(tab, true);
    });
    fetchNews(tab, false);
    if (sel) genAIContent(sel.title, function (res) {
      if (!res) return;
      var box = $('#ai-copies'), sug = $('#ai-suggest');
      if (res.copies && box) box.innerHTML = res.copies.map(function (c, i) {
        return '<div class="copy-line"><div class="c">' + esc(c) + '</div>' +
          '<div class="row"><span class="dim" style="font-size:12px">文案 ' + (i + 1) + '</span>' +
          '<button class="btn ghost sm" data-act="copy" data-txt="' + esc(c).replace(/"/g, '&quot;') + '">复制</button></div></div>';
      }).join('');
      if (res.suggestion && sug) sug.textContent = res.suggestion;
    });
  }
  function newsListHtml(list, tab) {
    if (!list.length) return '<p class="empty">暂无数据，点右上角刷新试试</p>';
    return '<div>' + list.slice(0, 30).map(function (n, i) {
      return '<div class="news-item" data-news="' + esc(JSON.stringify({ title: n.title, hot: n.hot, url: n.url || '', src: tab }).replace(/"/g, '&quot;')) + '">' +
        '<span class="idx' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
        '<span class="t">' + esc(n.title) + '</span>' +
        (n.hot ? '<span class="hot">' + esc(n.hot) + '</span>' : '') +
        '</div>';
    }).join('') + '</div>';
  }
  function newsDetailHtml(n) {
    var copies = genCopies(n.title);
    return '<button class="btn ghost sm" id="news-back" style="margin-bottom:12px">← 返回榜单</button>' +
      '<div class="card"><h3>' + esc(n.title) + '</h3>' +
      (n.hot ? '<p class="dim">热度：' + esc(n.hot) + '</p>' : '') +
      (n.url ? '<p class="dim"><a href="' + esc(n.url) + '" target="_blank" rel="noopener" style="text-decoration:underline">查看原文 ↗</a></p>' : '') +
      '</div>' +
      '<section class="card"><h3>二创文案（3 条，可直接复制）</h3>' +
      '<div id="ai-copies">' + copies.map(function (c, i) {
        return '<div class="copy-line"><div class="c">' + esc(c) + '</div>' +
          '<div class="row"><span class="dim" style="font-size:12px">文案 ' + (i + 1) + '</span>' +
          '<button class="btn ghost sm" data-act="copy" data-txt="' + esc(c).replace(/"/g, '&quot;') + '">复制</button></div></div>';
      }).join('') + '</div></section>' +
      '<section class="card"><h3>选题建议</h3><div class="tip" id="ai-suggest">' + esc(genSuggestion(n.title)) + '</div></section>';
  }
  function genCopies(title) {
    var t = title.length > 16 ? title.slice(0, 16) + '…' : title;
    return [
      '《' + t + '》——值得花 3 分钟了解的话题，已记进今日观察。',
      '刚刷到「' + title + '」，第一反应：这个热点背后，普通人能做点什么？',
      t + ' | 今天值得关注的 1 件事。我的想法：先收进素材库，再想怎么用。'
    ];
  }
  function genSuggestion(title) {
    return '把「' + title + '」收进知识库「案例库」：第一步记下它为什么火（情绪/冲突/时效）；第二步想它和你的领域怎么结合；第三步设一个 3 天后复盘的提醒，检验判断。';
  }
  function genAIContent(title, cb) {
    var cfg = LS.get('hg_ai_cfg', null);
    if (!cfg || !cfg.endpoint || !cfg.key) { cb(null); return; }
    var prompt = '你是一名中文新媒体运营，擅长把热点改写成可直接发布的短文案。' +
      '针对热点「' + title + '」，请输出：\n' +
      '【文案】3 条，每条一句，口语化、有钩子，适合朋友圈/短视频，不要标题党。\n' +
      '【选题】1 段，说明这个热点和「付费媒体/SEM/AI 工具/亲子教育」任一角度怎么结合做内容。\n' +
      '严格按以下格式返回，不要多余解释：\n' +
      '文案1：…\n文案2：…\n文案3：…\n选题：…';
    safeFetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.8 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      try {
        var content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!content) { cb(null); return; }
        cb(parseAIContent(content));
      } catch (e) { cb(null); }
    }).catch(function () { cb(null); });
  }
  function parseAIContent(text) {
    var lines = text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var copies = [], suggestion = '';
    lines.forEach(function (l) {
      if (/^文案[123一二三]?[:：]/.test(l)) copies.push(l.replace(/^文案[123一二三]?[:：]/, ''));
      else if (/^选题[:：]/.test(l)) suggestion = l.replace(/^选题[:：]/, '');
      else if (copies.length < 3 && !suggestion) copies.push(l);
    });
    if (!copies.length) copies = null;
    return { copies: copies, suggestion: suggestion || null };
  }
  function fetchNews(tab, force) {
    var cache = newsCache[tab];
    var stale = !cache || !cache.at || (Date.now() - cache.at > 10 * 60 * 1000);
    if (cache && !force && !stale) return;
    if (!cache) newsCache[tab] = { data: [], loading: true };
    safeFetch('https://api.vvhan.com/api/hotlist/' + tab)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = [];
        if (j && j.success && Array.isArray(j.data)) {
          list = j.data.map(function (d) {
            return { title: d.title || '', hot: d.hot || d.num || '', url: d.url || '' };
          }).filter(function (d) { return d.title; });
        }
        if (!list.length) list = NEWS_FALLBACK[tab] || [];
        var payload = { data: list, at: Date.now() };
        newsCache[tab] = payload;
        LS.set('hg_news_' + tab, payload);
        render();
      })
      .catch(function () {
        if (!newsCache[tab] || !newsCache[tab].data || !newsCache[tab].data.length) {
          newsCache[tab] = { data: NEWS_FALLBACK[tab] || [], at: Date.now() };
          render();
        }
      });
  }

  /* ---------- 火哥的项目（封面卡片 + 时间线，可持续添加） ---------- */
  function renderProjects() {
    var projects = [
      {
        url: '/ai-trainer/',
        name: '人工智能训练师三级 · 备考复习',
        desc: '上机代码复习 + 单选/多选/判断专项 + 综合题库合集，在线刷题、自动判分。',
        tag: '备考资料',
        coverChar: 'AI',
        cover: '/assets/covers/ai-trainer.jpg',
        milestones: [
          { date: '2026-06-27', text: '题库整理起步：单选 / 多选 / 判断题集完成' },
          { date: '2026-07-15', text: '题库合集页上线，三题型在线刷题' },
          { date: '2026-07-31', text: '上机代码复习 v5 完成，并入「火哥的个人站」' }
        ]
      },
      {
        url: '/thailand-road-trip/',
        name: '泰国 14 天自驾亲子游',
        desc: '2026.9.22–10.5 曼谷→邦盛→芭提雅→罗勇→沙美岛→尖竹汶→狗骨岛，纯东线无回头，专为 5 岁娃设计。',
        tag: '旅行攻略',
        coverChar: '泰',
        cover: '/assets/covers/thailand-road-trip.jpg',
        milestones: [
          { date: '2026-07-14', text: '攻略 V1 上线：14 天东线大框架与每日行程' },
          { date: '2026-07-30', text: '攻略 V2 细化：13 晚住宿全部落定，机票/租车/预算闭合' },
          { date: '2026-07-31', text: '并入「火哥的个人站」，线上可访问' }
        ]
      },
      {
        url: '/literacy-game/',
        name: '字精灵 · 识字游戏',
        desc: '面向 5 岁儿童的识字游戏：认字 → 描红 → 结算 → 节奏 → 存档，艾宾浩斯复习调度，纯前端零依赖。',
        tag: '亲子教育',
        coverChar: '字',
        cover: '/assets/covers/literacy-game.jpg',
        milestones: [
          { date: '2026-08-01', text: '识字游戏 Web 原型完成，并入「火哥的个人站」' }
        ]
      },
      {
        url: '/chihuoliaoyuan/',
        name: '《赤火燎原》长篇小说连载',
        desc: '元史博士穿越成蒙古旧族幼童，指灶火改姓"火"，从百曲灶台烧起，燎尽元末江南。',
        tag: '小说连载',
        coverChar: '赤',
        cover: '/assets/covers/chihuoliaoyuan.jpg',
        milestones: [
          { date: '2026-08-02', text: '小说站上线：卷一《灶火》第 01 章《灶膛里的火》开放阅读' }
        ]
      },
      {
        url: '/month-menu/',
        name: '一个月菜单总览 · 含食材调料',
        desc: '一整月午餐 / 晚餐规划，每天配好食材与调料清单，做饭不用再想。',
        tag: '家庭生活',
        coverChar: '餐',
        cover: '/assets/covers/month-menu.jpg',
        milestones: [
          { date: '2026-08-06', text: '月菜单总览页上线，并入「火哥的个人站」' }
        ]
      },
      {
        url: '/chiangmai/',
        name: '2027 清迈旅居 · 亲子一个月',
        desc: '2027 春节前后清迈旅居一个月，两大一小。工作日送幼儿园、周末近郊游，攻略与实况持续更新。',
        tag: '旅行攻略',
        coverChar: '清',
        cover: '/assets/covers/chiangmai-2027.jpg',
        milestones: [
          { date: '2026-08-07', text: '清迈旅居规划启动：亲子行程与近郊游方案完成' }
        ]
      },
      {
        url: '/english-wonderland/',
        name: '👋 儿童英语学习乐园',
        desc: '上海幼小衔接英语启蒙：800+单词 · 23 类生活主题，卡片跟读 + 闯关游戏 + 打卡看板。',
        tag: '亲子教育',
        coverChar: '英',
        cover: '/assets/covers/english-wonderland.jpg',
        milestones: [
          { date: '2026-08-09', text: '英语学习乐园立项：单词卡片配图完成，页面开发启动' },
          { date: '2026-08-09', text: '项目卡片更新：800+单词 / 23 类主题 + 卡片 / 游戏 / 看板三大模块说明' }
        ]
      },
      {
        url: '/poetry-garden/',
        name: '古诗学习乐园 · 幼小衔接20首',
        desc: '精选最基础的20首古诗，图文结合、诗意场景可视化，帮助幼小衔接阶段孩子轻松启蒙国学。',
        tag: '亲子教育',
        coverChar: '诗',
        cover: '/assets/covers/poetry-garden.jpg',
        milestones: [
          { date: '2026-08-09', text: '古诗学习乐园立项：封面配图完成，20首古诗内容整理启动' }
        ]
      },
      {
        url: '/kids-math/',
        name: '🧮 幼儿口算 · 陪玩练习',
        desc: '面向 3–8 岁幼儿的口算练习：11 类题型（加减乘除 + 凑十法 / 破十法 + 三个数 10·20·30 内 + 20 以内细分），选择 / 填空双模式，闯关得分 + 错题分析看板，纯前端零依赖。',
        tag: '亲子教育',
        coverChar: '算',
        cover: '/assets/covers/kids-math-20260810101908.jpg',
        milestones: [
          { date: '2026-08-10', text: '幼儿口算 Web 完成：11 类题型 + 选择/填空 + 闯关 + 错题分析 + 关于页' }
        ]
      }
      // —— 以后新增项目：复制一个对象，填 url / name / desc / tag / coverChar / milestones ——
    ];
    var tl = [];
    projects.forEach(function (p) {
      (p.milestones || []).forEach(function (m) {
        tl.push({ date: m.date, text: m.text, proj: p.name });
      });
    });
    tl.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    content.innerHTML =
      '<h2>火哥的项目</h2>' +
      '<p class="sub">我做过的项目都放在这里 · 持续更新中</p>' +
      '<div class="proj-grid">' + projects.map(function (p) {
        var ch = esc(p.coverChar || p.name.charAt(0));
        var coverHtml = p.cover
          ? '<div class="proj-cover hasimg"><img class="cover-img" src="' + esc(p.cover) + '" alt="' + esc(p.name) + '"></div>'
          : '<div class="proj-cover"><span class="cv">' + ch + '</span></div>';
        return '<a class="proj-card" href="' + p.url + '">' +
          coverHtml +
          '<div class="proj-body">' +
            '<div class="tag">' + esc(p.tag) + '</div>' +
            '<div class="name">' + esc(p.name) + '</div>' +
            '<div class="desc">' + esc(p.desc) + '</div>' +
            '<div class="go">进入 →</div>' +
          '</div>' +
        '</a>';
      }).join('') + '</div>' +
      '<h3 class="tl-title">项目时间线</h3>' +
      '<div class="timeline">' + tl.map(function (m, i) {
        return '<div class="tl-node' + (i === 0 ? ' latest' : '') + '">' +
          '<div class="tl-dot"></div>' +
          '<div class="tl-date">' + esc(m.date) + '</div>' +
          '<div class="tl-text">' + esc(m.text) + '</div>' +
          '<div class="tl-proj">' + esc(m.proj) + '</div>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ---------- 设置 / 数据 ---------- */
  function renderSettings() {
    content.innerHTML =
      '<h2>设置 / 数据</h2>' +
      '<p class="sub">数据全部保存在本机浏览器（localStorage），刷新不丢；建议定期导出备份。</p>' +
      '<section class="card"><h3>备份与迁移</h3>' +
        '<div class="set-row">' +
          '<button class="btn" id="exp-json">导出全部数据(.json)</button>' +
          '<button class="btn ghost" id="exp-md">导出知识库(.md)</button>' +
        '</div>' +
        '<div class="set-row"><label class="btn ghost" style="display:inline-block">导入数据<input id="imp-file" type="file" accept=".json" style="display:none"></label></div>' +
        '<p class="dim">导出 .json 可完整备份待办与知识库；导入后刷新即生效。</p>' +
      '</section>' +
      '<section class="card"><h3>AI 文案（可选，仅存本机）</h3>' +
        '<p class="dim">填了接口和 Key 后，点开新闻会用真实模型生成文案；留空则用内置模板。Key 只存你本地浏览器，不会上传。</p>' +
        '<div class="add-line"><input id="ai-endpoint" type="text" placeholder="接口地址，如 https://…/v1/chat/completions"></div>' +
        '<div class="add-line"><input id="ai-key" type="password" placeholder="API Key（留空则不调用）"></div>' +
        '<div class="form-row"><input id="ai-model" type="text" placeholder="模型名，如 gpt-4o-mini"><button class="btn" id="ai-save">保存</button></div>' +
      '</section>' +
      '<section class="card"><h3>危险区</h3>' +
        '<button class="btn" id="clear-data" style="background:#e5484d;border-color:#e5484d">清空全部数据</button>' +
      '</section>' +
      '<section class="card"><h3>说明</h3>' +
        '<p class="dim">· 提醒弹窗需本页面保持打开才生效（纯前端限制）。</p>' +
        '<p class="dim">· 每日新闻来自公开热搜接口，偶发失效会自动回退到内置榜单。</p>' +
        '<p class="dim">· 新闻 AI 文案：在上方填写接口与 Key 即用真实模型生成，留空用内置模板（Key 仅存本机）。</p>' +
      '</section>';

    $('#exp-json').addEventListener('click', function () {
      var data = { exportedAt: new Date().toISOString(), todos: todos, kb: kb };
      download('火哥的个人站_数据_' + todayStr() + '.json', JSON.stringify(data, null, 2));
      toast('已导出 JSON');
    });
    $('#exp-md').addEventListener('click', function () {
      var md = '# 知识库导出\n\n';
      KB_TABS.forEach(function (t) {
        md += '## ' + t.label + '\n\n';
        (kb[t.k] || []).forEach(function (e) {
          md += '- ' + (e.text || '(图片)') + '\n';
        });
        md += '\n';
      });
      download('知识库_' + todayStr() + '.md', md);
      toast('已导出 Markdown');
    });
    $('#imp-file').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var j = JSON.parse(reader.result);
          if (!j || typeof j !== 'object') throw new Error('bad');
          if (Array.isArray(j.todos)) { todos = j.todos; saveTodos(); }
          if (j.kb && typeof j.kb === 'object') { kb = j.kb; saveKb(); }
          toast('导入成功，刷新生效');
          setTimeout(function () { location.reload(); }, 800);
        } catch (e) { toast('导入失败：文件格式不对'); }
      };
      reader.readAsText(f);
    });
    var aiCfg0 = LS.get('hg_ai_cfg', {});
    if (aiCfg0.endpoint) $('#ai-endpoint').value = aiCfg0.endpoint;
    if (aiCfg0.model) $('#ai-model').value = aiCfg0.model;
    $('#ai-save').addEventListener('click', function () {
      var ep = $('#ai-endpoint').value.trim();
      var key = $('#ai-key').value.trim();
      var model = $('#ai-model').value.trim();
      if (!ep) { toast('接口地址不能为空'); return; }
      if (!key && aiCfg0.key) key = aiCfg0.key;
      LS.set('hg_ai_cfg', { endpoint: ep, key: key, model: model });
      toast(key ? '已保存，新闻将用 AI 生成文案' : '已保存（未填 Key，仍用模板）');
    });
    $('#clear-data').addEventListener('click', function () {
      if (!confirm('确定清空全部数据？此操作不可恢复，请先导出备份。')) return;
      LS.del('hg_todos'); LS.del('hg_kb');
      ['weibo', 'baidu', 'zhihu', 'bilibili'].forEach(function (k) { LS.del('hg_news_' + k); });
      location.reload();
    });
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- 事件委托 ---------- */
  content.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act],[data-kbtab],[data-newstab],[data-news],[data-pri],[data-id]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'td-done') {
      var t1 = todos.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (t1) { t1.done = true; t1.doneAt = new Date().toISOString(); saveTodos(); render(); }
    } else if (act === 'td-restore') {
      var t2 = todos.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (t2) { t2.done = false; t2.doneAt = null; saveTodos(); render(); }
    } else if (act === 'td-del') {
      todos = todos.filter(function (x) { return x.id !== el.getAttribute('data-id'); });
      saveTodos(); render();
    } else if (act === 'kb-del') {
      var tab = el.getAttribute('data-kb');
      kb[tab] = (kb[tab] || []).filter(function (x) { return x.id !== el.getAttribute('data-id'); });
      saveKb(); render();
    } else if (act === 'copy') {
      copyText(el.getAttribute('data-txt'));
    } else if (act === 'news-back') {
      selectedNews = null; render();
    } else if (el.hasAttribute('data-kbtab')) {
      currentKbTab = el.getAttribute('data-kbtab'); render();
    } else if (el.hasAttribute('data-newstab')) {
      currentNewsTab = el.getAttribute('data-newstab');
      selectedNews = null;
      var c2 = newsCache[currentNewsTab];
      if (!c2) fetchNews(currentNewsTab, false);
      render();
    } else if (el.hasAttribute('data-news')) {
      try {
        selectedNews = JSON.parse(el.getAttribute('data-news'));
        selectedNews.src = selectedNews.src || currentNewsTab;
      } catch (e) {}
      render();
    }
  });
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('已复制'); }, function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请手动复制'); }
    ta.remove();
  }

  /* ---------- 菜单 ---------- */
  function bindMenu() {
    var items = document.querySelectorAll('.menu-item');
    items.forEach(function (it) {
      it.addEventListener('click', function () {
        currentView = it.getAttribute('data-view');
        if (location.hash !== '#' + currentView) {
          try { history.replaceState(null, '', '#' + currentView); } catch (e) { location.hash = currentView; }
        }
        menuActivate();
        window.scrollTo(0, 0);
        render();
      });
    });
  }

  /* ---------- 启动 ---------- */
  if (!localStorage.getItem('hg_todos') && !localStorage.getItem('hg_kb')) seedDemo();
  bindMenu();
  render();
  setInterval(tickReminders, 15000);
  tickReminders();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
})();
