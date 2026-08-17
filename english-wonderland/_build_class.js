const fs = require('fs');
const SRC = 'D:/Fire/火哥的个人站/english-wonderland/index.html';
const TXT = 'D:/WorkBuddy/Obsidian/上海小学英语词汇/牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt';
const OUT = 'D:/Fire/火哥的个人站/english-wonderland/vocab-classification.html';
const raw = fs.readFileSync(SRC, 'utf8');
const txt = fs.readFileSync(TXT, 'utf8');

// ---------- balanced extractor (skips quoted strings) ----------
function extractBalanced(startMarker){
  const start = raw.indexOf(startMarker);
  if(start < 0) throw new Error('missing ' + startMarker);
  let p = start + startMarker.length;
  while(p < raw.length && raw[p] !== '{' && raw[p] !== '[') p++;
  const open = raw[p], close = open === '{' ? '}' : ']';
  let depth = 0, i = p;
  while(i < raw.length){
    const c = raw[i];
    if(c === "'" || c === '"'){
      const q = c; i++;
      while(i < raw.length){
        if(raw[i] === '\\'){ i += 2; continue; }
        if(raw[i] === q){ i++; break; }
        i++;
      }
      continue;
    }
    if(c === open) depth++;
    else if(c === close){ depth--; if(depth === 0){ i++; break; } }
    i++;
  }
  return raw.slice(p, i);
}
const WORD_META = new Function('return (' + extractBalanced('const WORD_META = ') + ')')();
const CATS = new Function('return ' + extractBalanced('const CATS = ') + '')();
const EXTRA_WORDS = new Function('return ' + extractBalanced('const EXTRA_WORDS = ') + '')();
const HAVE_IMG = new Function('return new Set(' + extractBalanced('const HAVE_IMG = new Set(') + ')')();

// ---------- normalizers (mirror _build_std.js) ----------
const PLURAL_ONLY = new Set(['glasses','jeans','trousers','scissors','shorts','clothes','pants','tights','pyjamas']);
function singular(w){
  if(PLURAL_ONLY.has(w)) return w;
  if(w.endsWith('ies') && w.length>4) return w.slice(0,-3)+'y';
  if(w.endsWith('ses')||w.endsWith('xes')||w.endsWith('zes')||w.endsWith('ches')||w.endsWith('shes')) return w.slice(0,-2);
  if(w.endsWith('s') && !w.endsWith('ss') && w.length>3) return w.slice(0,-1);
  return w;
}
function stripParen(s){ return s.replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'').trim(); }
function baseEn(s){
  s = stripParen(s.toLowerCase().trim());
  s = s.replace(/^(an?)\s+/,'');
  s = s.replace(/^a pair of\s+/,'').replace(/^pair of\s+/,'');
  let m = s.match(/^an?\s+([a-z]+)\s+of\b/);
  if(m) s = m[1];
  return s.trim();
}
function keysFor(s){
  const out = new Set();
  const b = baseEn(s);
  out.add(b); out.add(b.replace(/\s+/g,''));
  const sg = singular(b);
  if(sg!==b){ out.add(sg); out.add(sg.replace(/\s+/g,'')); }
  const toks = b.split(/\s+/).filter(Boolean);
  if(toks.length>1){
    const last = toks[toks.length-1];
    out.add(last); out.add(singular(last));
  }
  return out;
}

// ---------- build Oxford 2024 standard set ----------
const standardKeys = new Set();
const standardMap = new Map(); // disp -> {zh, originals:Set}
let txtRaw = 0;
for(const line of txt.split('\n')){
  if(!line.trim()) continue;
  const parts = line.split('\t');
  if(parts.length<2) continue;
  const en = parts[0].trim(), zh = parts[1].trim();
  if(!en) continue;
  txtRaw++;
  const b = baseEn(en);
  const disp = (b.includes(' ') && singular(b)!==b) ? singular(b) : b;
  for(const k of keysFor(en)) standardKeys.add(k);
  if(!standardMap.has(disp)) standardMap.set(disp, {zh, originals:new Set()});
  standardMap.get(disp).originals.add(en);
}

// ---------- deployed github words (unique by en) ----------
const deployed = new Map();
for(const cat of CATS){
  if(!cat.words) continue;
  for(const w of cat.words){
    if(!Array.isArray(w) || !w[0]) continue;
    const en = w[0], zh = w[1] || '', img = (typeof w[2]==='string' && w[2].indexOf('img:')===0) ? w[2].slice(4) : '';
    if(!deployed.has(en)) deployed.set(en, {en, zh, img, catName: cat.name, functional: !!(img && img.indexOf('fw-')===0)});
  }
}
for(const e of EXTRA_WORDS){
  if(!e || !e[0]) continue;
  const en = e[0], zh = e[1] || '', img = (typeof e[2]==='string' && e[2].indexOf('img:')===0) ? e[2].slice(4) : '';
  if(!deployed.has(en)) deployed.set(en, {en, zh, img, catName: e[3]||'', functional: false});
}

// ---------- match a github word to Oxford standard ----------
function isShanghai(d){
  const cands = new Set([d.en.toLowerCase()]);
  if(d.img) cands.add(d.img.toLowerCase());
  for(const c of cands){
    const c2 = c.replace(/[\s_-]+/g,'');
    const tests = [c, c2, singular(c), singular(c2)];
    for(const t of tests) if(standardKeys.has(t)) return true;
  }
  return false;
}

// ---------- DATA: online words ----------
const DATA = [];
for(const info of deployed.values()){
  // 上海小学 = 牛津2024命中 或 功能词(img:fw-*)。牛津 txt 不含基础功能词(a/above/after 等)，
  // 但功能词本就是小学内容，故功能词一律归上海小学。
  const sh = isShanghai(info) || info.functional;
  const hasImg = !!(info.img && HAVE_IMG.has(info.img));
  let reason;
  if(sh){
    reason = info.functional ? '上海小学 · 功能词（功能词归类）' : '上海小学 · 内容词（牛津2024命中）';
  } else {
    const m = WORD_META[info.en];
    const a = m && m.age;
    if(a==='12-18'||a==='15-18') reason='拓展 · 初高中';
    else if(a) reason='拓展 · 其他学段 '+a;
    else reason='拓展 · 无学段标签';
  }
  DATA.push({ w:info.en, zh:info.zh, tier: sh?'core':'ext', reason, img: hasImg?info.img:'', cat: info.catName, functional: info.functional });
}
DATA.sort((a,b)=> (a.tier===b.tier?0:(a.tier==='core'?-1:1)) || a.w.localeCompare(b.w));

// ---------- GAPS: Oxford standard words with NO deployed card ----------
function dkOf(d){ const s=new Set(); for(const x of [d.en.toLowerCase(), d.img?d.img.toLowerCase():'']){ s.add(x); s.add(x.replace(/[\s_-]+/g,'')); s.add(singular(x)); s.add(singular(x.replace(/[\s_-]+/g,''))); } return s; }
const GAPS = [];
for(const [disp, info] of standardMap){
  const dispKeys = keysFor(disp);
  let found=false;
  for(const d of deployed.values()){ if(!isShanghai(d)) continue; const dk=dkOf(d); let hit=false; for(const k of dispKeys) if(dk.has(k)){hit=true;break;} if(hit){found=true;break;} }
  if(!found) GAPS.push({ w:disp, zh:info.zh, tier:'gap', reason:'牛津2024标准词 · app 无词卡（缺口）', orig:[...info.originals].join(' / '), img:'', cat:'' });
}
GAPS.sort((a,b)=> a.w.localeCompare(b.w));

// ---------- stats ----------
const totalN = DATA.length;
const coreN = DATA.filter(d=>d.tier==='core').length;
const extN = totalN - coreN;
const funcN = DATA.filter(d=>d.functional).length;
const imgN = DATA.filter(d=>d.img).length;
const noimgN = totalN - imgN;
const gapN = GAPS.length;
console.log('deployed(unique)', totalN, 'core(牛津)', coreN, 'ext', extN, 'func', funcN, 'img', imgN, 'noimg', noimgN, 'gaps', gapN);

// ---------- HTML ----------
const ALL = DATA.concat(GAPS);
const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>英语学园 · 线上词图逐词核对（牛津上海版 2024 标准）</title>
<style>
:root{--gold:#C8A04B;--ink:#1d1d1f;--gray:#86868b;--line:#e5e5ea;--green:#34C759;--red:#FF3B30;--blue:#FF9F0A;--bg:#fafafa;}
*{box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg);margin:0;}
.container{max-width:1280px;margin:0 auto;padding:28px 20px 80px;}
header h1{font-size:23px;margin:0 0 6px;font-weight:600;}
header p{color:var(--gray);margin:0 0 14px;font-size:14px;line-height:1.7;}
.note{background:#fff;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:10px;padding:14px 18px;font-size:13px;line-height:1.85;margin-bottom:18px;color:#3a3a3c;}
.note b{color:var(--ink);}
.note code{background:#f2f2f4;padding:1px 6px;border-radius:5px;font-size:12px;}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;}
.chip{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 15px;min-width:108px;}
.chip b{display:block;font-size:21px;font-weight:700;}
.chip span{font-size:11px;color:var(--gray);}
.chip.core b{color:var(--green);}.chip.ext b{color:var(--red);}.chip.gap b{color:var(--blue);}.chip.total b{color:var(--gold);}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.filters button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 13px;border-radius:999px;font-size:13px;cursor:pointer;transition:.15s;}
.filters button.active{background:var(--gold);color:#fff;border-color:var(--gold);}
.search{width:100%;max-width:340px;padding:9px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;margin-bottom:14px;outline:none;}
.search:focus{border-color:var(--gold);}
.legend{font-size:12px;color:var(--gray);margin-bottom:16px;line-height:1.9;}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 4px 0 10px;vertical-align:middle;}
.i-core{background:var(--green);}.i-gap{background:var(--blue);}.i-ext{background:var(--red);}.i-ok{background:var(--green);}.i-miss{background:var(--red);}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px;}
.card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;transition:.15s;}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);transform:translateY(-2px);}
.card .thumb{width:100%;aspect-ratio:1/1;background:#f2f2f4;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.card .thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.card .thumb .noimg{color:#bbb;font-size:12px;text-align:center;padding:8px;}
.card .body{padding:9px 11px 11px;}
.card .en{font-size:15px;font-weight:600;line-height:1.2;display:flex;align-items:center;gap:5px;}
.card .zh{font-size:12px;color:var(--gray);margin:2px 0 7px;}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;}
.dot.ok{background:var(--green);}.dot.miss{background:var(--red);}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;margin-right:4px;}
.badge.core{background:rgba(52,199,89,.14);color:var(--green);}
.badge.ext{background:rgba(255,59,48,.12);color:var(--red);}
.badge.func{background:rgba(0,122,255,.12);color:#007AFF;}
.badge.gap{background:rgba(255,159,10,.16);color:var(--blue);}
.card .reason{font-size:11px;color:#666;line-height:1.45;margin-top:6px;}
.card .orig{font-size:11px;color:#999;margin-top:5px;line-height:1.4;}
footer{margin-top:50px;color:var(--gray);font-size:12px;text-align:center;}
</style></head>
<body><div class="container">
<header>
  <h1>英语学园 · 线上词图逐词核对（牛津上海版 2024 标准）</h1>
  <p>逐词核对：线上（github → Cloudflare Pages）每个已部署单词 ↔ 它真实服务的图片，并标注是否「上海小学词汇」。<b>判定依据已更新为「牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt」（Oxford Shanghai Edition 全学段）</b>——github 词只是本仓库收集的一批词（"大哥"），不再作为课标标准，仅按牛津标准重新打标。</p>
</header>

<div class="note">
  <b>上海小学词汇 = 命中牛津2024标准（启发式匹配）</b><br>
  规则：把 txt 词条归一化（去冠词 a/an、去 a pair of / a X of 量词、去括号、简单复数转单数、短语取中心词）后，与 github 已部署词的<b>英文</b>或<b>图片 slug</b>匹配；命中即判为「上海小学」。匹配为启发式，短语/量词类可能存在少量偏差，请以下方卡片逐词核对。<br>
  <b>逐词核对方法</b>：点「上海小学(牛津)」看全部小学词；点「标准缺口」看牛津要求但 app 还没有词卡的词（共 <b>${gapN}</b> 个，重点补卡对象）；点「仅看图缺失」发现词图不对应；功能词点「功能词」。每张卡绿/红点表示图片状态（灰=无词卡缺口）。<br>
  <b>统计</b>：线上已部署词 <b>${totalN}</b> ｜ 上海小学(牛津) <b>${coreN}</b> ｜ 拓展 <b>${extN}</b> ｜ 其中功能词 <b>${funcN}</b> ｜ 带图 <b>${imgN}</b> ｜ 图缺失 <b>${noimgN}</b> ｜ 标准缺口 <b>${gapN}</b>。
</div>

<div class="stats">
  <div class="chip total"><b>${totalN}</b><span>线上已部署词</span></div>
  <div class="chip core"><b>${coreN}</b><span>上海小学(牛津)</span></div>
  <div class="chip ext"><b>${extN}</b><span>拓展</span></div>
  <div class="chip"><b>${funcN}</b><span>功能词</span></div>
  <div class="chip"><b>${imgN}</b><span>带图</span></div>
  <div class="chip"><b style="color:var(--red)">${noimgN}</b><span>图缺失</span></div>
  <div class="chip gap"><b>${gapN}</b><span>标准缺口</span></div>
</div>

<div class="filters">
  <button data-f="all" class="active">全部</button>
  <button data-f="core">上海小学(牛津)</button>
  <button data-f="ext">拓展</button>
  <button data-f="func">功能词</button>
  <button data-f="noimg">仅看图缺失</button>
  <button data-f="gap">标准缺口</button>
</div>
<input class="search" id="q" placeholder="搜索英文 / 中文…" />

<div class="legend">
  <i class="i-core"></i>上海小学(牛津2024)
  <i class="i-gap"></i>标准缺口(牛津有·app无)
  <i class="i-ext"></i>拓展(非小学)
  <i class="i-ok"></i>图片存在
  <i class="i-miss"></i>图片缺失
</div>

<div class="grid" id="grid"></div>

<footer>数据快照来自 index.html（本地源）＋ 牛津上海版2024词表；生成于 _build_class.js</footer>
</div>

<script>
var ALL = ${JSON.stringify(ALL)};
var grid = document.getElementById('grid');
var q = document.getElementById('q');
var filter = 'all';
function imgFail(img){ var box = img.parentNode; if(box){ box.innerHTML = '<div class="noimg">图缺失(文件未找到)</div>'; } }
function matches(d){
  if(filter === 'all') return true;
  if(filter === 'core') return d.tier === 'core';
  if(filter === 'ext') return d.tier === 'ext';
  if(filter === 'func') return !!d.functional;
  if(filter === 'noimg') return d.tier !== 'gap' && !d.img;
  if(filter === 'gap') return d.tier === 'gap';
  return true;
}
function render(){
  var kw = q.value.trim().toLowerCase();
  grid.innerHTML = '';
  var n = 0;
  for(var i=0;i<ALL.length;i++){
    var d = ALL[i];
    if(!matches(d)) continue;
    if(kw && d.w.toLowerCase().indexOf(kw) < 0 && (d.zh||'').indexOf(kw) < 0) continue;
    n++;
    var div = document.createElement('div');
    div.className = 'card';
    var thumb = d.tier === 'gap'
      ? '<div class="thumb"><div class="noimg">无词卡<br>(标准缺口)</div></div>'
      : (d.img
        ? '<div class="thumb"><img src="images/' + d.img + '.webp" loading="lazy" onerror="imgFail(this)"></div>'
        : '<div class="thumb"><div class="noimg">暂无图<br>(HAVE_IMG 无此 slug)</div></div>');
    var dot = d.img ? '<span class="dot ok" title="图片存在"></span>' : (d.tier === 'gap' ? '' : '<span class="dot miss" title="图片缺失"></span>');
    var tierBadge = d.tier === 'core' ? '<span class="badge core">📘 上海小学</span>' : d.tier === 'ext' ? '<span class="badge ext">📙 拓展</span>' : '<span class="badge gap">⚠️ 标准缺口</span>';
    var funcBadge = d.functional ? '<span class="badge func">功能词</span>' : '';
    var origLine = d.orig ? '<div class="orig">原始词形: ' + d.orig + '</div>' : '';
    div.innerHTML = thumb
      + '<div class="body"><div class="en">' + d.w + ' ' + dot + '</div>'
      + '<div class="zh">' + (d.zh||'') + '</div>'
      + tierBadge + funcBadge
      + '<div class="reason">' + d.reason + '</div>'
      + origLine + '</div>';
    grid.appendChild(div);
  }
  if(n === 0){ grid.innerHTML = '<div style="color:#999;padding:30px;">无匹配</div>'; }
}
document.querySelectorAll('.filters button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active');
    filter = b.getAttribute('data-f');
    render();
  });
});
q.addEventListener('input', render);
render();
</script>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('WROTE', OUT, 'bytes=', html.length);
