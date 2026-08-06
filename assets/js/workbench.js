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
    var todayList = [], laterList = [];
    todos.forEach(function (t) {
      var ds = t.remindAt ? fmtDate(new Date(t.remindAt)) : null;
      if (t.done) return;
      if (ds && ds <= today) todayList.push(t);
      else laterList.push(t);
    });
    todayList.sort(function (a, b) { return (a.remindAt || '') < (b.remindAt || '') ? -1 : 1; });
    laterList.sort(function (a, b) { return (a.remindAt || '') < (b.remindAt || '') ? -1 : 1; });

    content.innerHTML =
      '<h2>计划安排</h2>' +
      '<p class="sub">今日待办自动归位 · 到点弹窗 + 响铃</p>' +
      '<section class="card"><h3>今日安排</h3>' + todoListHtml(todayList, '今天还没有到点的待办，去下面添加并设定提醒时间吧') + '</section>' +
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
      '<section class="card"><h3>待做事项</h3>' + todoListHtml(laterList, '暂无待办') + '</section>';

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
  }

  function todoRowHtml(t) {
    var p = PRI[t.pri] || PRI[3];
    var timeTxt = t.remindAt ? fmtDate(new Date(t.remindAt)) + ' ' + fmtTime(new Date(t.remindAt)) : '未设时间';
    var overdue = t.remindAt && new Date(t.remindAt).getTime() < Date.now() && !t.done;
    return '<div class="todo-row">' +
      '<span class="dot" style="background:' + p.color + '"></span>' +
      '<span class="txt">' + esc(t.text) + '</span>' +
      '<span class="time">' + timeTxt + (overdue ? ' · 已逾期' : '') + '</span>' +
      '<button class="icon-btn" data-act="td-done" data-id="' + t.id + '">完成</button>' +
      '<button class="icon-btn" data-act="td-del" data-id="' + t.id + '">删除</button>' +
      '</div>';
  }
  function todoListHtml(list, empty) {
    if (!list.length) return '<p class="empty">' + empty + '</p>';
    return list.map(todoRowHtml).join('');
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
    (kb[tab] = kb[tab] || []).push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text: text, img: img, createdAt: new Date().toISOString()
    });
    saveKb(); render();
    toast('已保存到「' + (KB_TABS.filter(function (x) { return x.k === tab; })[0] || {}).label + '」');
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
    var cache = newsCache[tab];
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
    if (loading) fetchNews(tab, false);
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
      copies.map(function (c, i) {
        return '<div class="copy-line"><div class="c">' + esc(c) + '</div>' +
          '<div class="row"><span class="dim" style="font-size:12px">文案 ' + (i + 1) + '</span>' +
          '<button class="btn ghost sm" data-act="copy" data-txt="' + esc(c).replace(/"/g, '&quot;') + '">复制</button></div></div>';
      }).join('') + '</section>' +
      '<section class="card"><h3>选题建议</h3><div class="tip">' + esc(genSuggestion(n.title)) + '</div></section>';
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
  function fetchNews(tab, force) {
    var cache = newsCache[tab];
    if (cache && !force) return;
    newsCache[tab] = { data: [], loading: true };
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
        newsCache[tab] = { data: list, at: Date.now() };
        render();
      })
      .catch(function () {
        newsCache[tab] = { data: NEWS_FALLBACK[tab] || [], at: Date.now() };
        render();
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
      '<section class="card"><h3>危险区</h3>' +
        '<button class="btn" id="clear-data" style="background:#e5484d;border-color:#e5484d">清空全部数据</button>' +
      '</section>' +
      '<section class="card"><h3>说明</h3>' +
        '<p class="dim">· 提醒弹窗需本页面保持打开才生效（纯前端限制）。</p>' +
        '<p class="dim">· 每日新闻来自公开热搜接口，偶发失效会自动回退到内置榜单。</p>' +
        '<p class="dim">· AI 文案当前为内置模板生成，后续可在本页接入真实模型（API 只存你本地浏览器）。</p>' +
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
    $('#clear-data').addEventListener('click', function () {
      if (!confirm('确定清空全部数据？此操作不可恢复，请先导出备份。')) return;
      LS.del('hg_todos'); LS.del('hg_kb'); LS.del('hg_news_cache');
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
      if (t1) { t1.done = true; saveTodos(); render(); }
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
  bindMenu();
  render();
  setInterval(tickReminders, 15000);
  tickReminders();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
})();
