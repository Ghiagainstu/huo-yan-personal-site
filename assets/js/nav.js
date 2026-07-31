/* 注入到各内容页顶部：返回个人站首页的轻量导航条（自包含，不依赖其它样式） */
(function () {
  var css =
    '.mini-nav{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;' +
    'background:#1e293b;color:#e2e8f0;font-size:13px;padding:9px 16px;' +
    'display:flex;align-items:center;gap:10px;position:relative;z-index:9999}' +
    '.mini-nav a{color:#a5b4fc;font-weight:600}' +
    '.mini-nav a:hover{color:#fff}' +
    '.mini-nav .sep{opacity:.4}' +
    '.mini-nav .cur{color:#cbd5e1}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var bar = document.createElement('div');
  bar.className = 'mini-nav';
  bar.innerHTML =
    '<a href="/">← 火哥的个人站</a>' +
    '<span class="sep">/</span>' +
    '<span class="cur">人工智能训练师三级</span>';
  document.body.insertBefore(bar, document.body.firstChild);
})();
