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

// ---------- 评价数据（用户逐词写的核对意见，供以后重分标签/重出图 prompt）----------
// 文件不存在时为空对象；build 时把评价嵌入 HTML，用户编辑后导出/导入同一 JSON 即可持久化。
const COMMENTS_PATH = 'D:/Fire/火哥的个人站/english-wonderland/_vocab_comments.json';
let COMMENTS = {};
try { COMMENTS = JSON.parse(fs.readFileSync(COMMENTS_PATH, 'utf8')); if(!COMMENTS || typeof COMMENTS!=='object') COMMENTS = {}; }
catch(e){ COMMENTS = {}; }

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
  // 上海小学 = 牛津2024命中 或 功能词(img:fw-*)。功能词本就是小学内容，与 app 口径统一：功能词一律归上海小学(core)。
  const sh = isShanghai(info) || info.functional;
  const hasImg = !!(info.img && HAVE_IMG.has(info.img));
  const wm = WORD_META[info.en];
  // 难度：用 WORD_META.diff（1简单/2中等/3难，全量覆盖），与 app 排序逻辑一致；缺失兜底为 3(难)
  const diff = (wm && (wm.diff===1||wm.diff===2||wm.diff===3)) ? wm.diff : 3;
  const diffLabel = diff===1?'简单':diff===2?'中等':'难';
  let tier, reason;
  if(sh){ tier='core'; reason = info.functional ? '上海小学 · 功能词（归入小学）' : '上海小学 · 牛津2024内容词'; }
  else { tier='ext'; reason='拓展 · 难度「'+diffLabel+'」'; }
  DATA.push({ w:info.en, zh:info.zh, tier, reason, img: hasImg?info.img:'', cat: info.catName, functional: info.functional, diff, comment: COMMENTS[info.en] || '' });
}
// 排序：① 上海小学(牛津,含功能词)→拓展 ② 难度 diff 1简单→3难 ③ A-Z（与 app 一致；标准缺口恒在最后）
const TIER_ORDER = { core:0, ext:1, gap:2 };
DATA.sort((a,b)=> (TIER_ORDER[a.tier]-TIER_ORDER[b.tier]) || (a.diff-b.diff) || a.w.localeCompare(b.w));

// ---------- GAPS: Oxford standard words with NO deployed card ----------
function dkOf(d){ const s=new Set(); for(const x of [d.en.toLowerCase(), d.img?d.img.toLowerCase():'']){ s.add(x); s.add(x.replace(/[\s_-]+/g,'')); s.add(singular(x)); s.add(singular(x.replace(/[\s_-]+/g,''))); } return s; }
// 归一化查重：标准词若线上已有对应图片（HAVE_IMG），则不算缺口（避免带 the/弯引号/大小写写法导致的误判）
function normKey(s){
  s=(s||'').toLowerCase().trim();
  s=s.replace(/^the\s+/,'').replace(/^a\s+/,'').replace(/^an\s+/,'');
  s=s.replace(/[\u2019\u2018]/g,"'");
  s=s.replace(/'s/g,'-s').replace(/'/g,'');
  s=s.replace(/[.,!?;:()\/\u2013\u2014&]/g,'');
  s=s.replace(/\s+/g,'-');
  s=s.replace(/-+/g,'-').replace(/^-|-$/g,'');
  return s;
}
const HAVE_N = new Set([...HAVE_IMG].map(normKey));
const GAPS = [];
const GAP_SKIPPED = [];   // 因 HAVE_IMG 命中而剔除的假缺口（带 the/符号/大小写）
for(const [disp, info] of standardMap){
  const dispKeys = keysFor(disp);
  let found=false;
  for(const d of deployed.values()){ if(!isShanghai(d)) continue; const dk=dkOf(d); let hit=false; for(const k of dispKeys) if(dk.has(k)){hit=true;break;} if(hit){found=true;break;} }
  // 线上 HAVE_IMG 已有对应图片 → 视为已覆盖，剔除（记录原始词形）
  let haveHit=false;
  if(!found){ for(const k of dispKeys){ if(HAVE_N.has(normKey(k))){ haveHit=true; break; } } }
  if(found || haveHit){
    if(haveHit && !found) GAP_SKIPPED.push({w:disp, zh:info.zh, orig:[...info.originals].join(' / ')});
    continue;
  }
  GAPS.push({ w:disp, zh:info.zh, tier:'gap', reason:'牛津2024标准词 · app 无词卡（缺口）', orig:[...info.originals].join(' / '), img:'', cat:'', comment: COMMENTS[disp] || '' });
}
GAPS.sort((a,b)=> a.w.localeCompare(b.w));

// ---------- stats ----------
const totalN = DATA.length;
const shN = DATA.filter(d=>d.tier==='core').length;        // 上海小学 = 牛津2024内容词 + 功能词（与 app 统一口径）
const funcN = DATA.filter(d=>d.functional).length;         // 功能词数（上海小学子集，供筛选/说明）
const extN = DATA.filter(d=>d.tier==='ext').length;        // 拓展
const imgN = DATA.filter(d=>d.img).length;
const noimgN = totalN - imgN;
const gapN = GAPS.length;
// 难度分布（按 WORD_META.diff，仅已部署词）
const simpleN = DATA.filter(d=>d.diff===1).length;
const midN = DATA.filter(d=>d.diff===2).length;
const hardN = DATA.filter(d=>d.diff===3).length;
console.log('deployed(unique)', totalN, '上海小学(牛津)', shN, 'func', funcN, 'ext', extN, 'img', imgN, 'noimg', noimgN, 'gaps(清洗后)', gapN, 'gap假缺口剔除(HAVE_IMG命中)', GAP_SKIPPED.length);
console.log('剔除明细:', GAP_SKIPPED.map(s=>s.w+'('+s.orig+')').join(' | '));

// ---------- HTML ----------
const ALL = DATA.concat(GAPS);
const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>英语学园 · 线上词图逐词核对（牛津上海版 2024 标准）</title>
<style>
:root{--gold:#C8A04B;--ink:#1d1d1f;--gray:#86868b;--line:#e5e5ea;--green:#34C759;--red:#FF3B30;--blue:#FF9F0A;--purple:#AF52DE;--orange:#FF9500;--bg:#fafafa;}
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
.chip.core b{color:var(--green);}.chip.ext b{color:var(--red);}.chip.gap b{color:var(--blue);}.chip.total b{color:var(--gold);}.chip.diff b{color:var(--purple);}.chip.func b{color:var(--orange);}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.filters button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 13px;border-radius:999px;font-size:13px;cursor:pointer;transition:.15s;}
.filters button.active{background:var(--gold);color:#fff;border-color:var(--gold);}
.filters button b{font-weight:700;color:var(--gold);margin-left:4px;}
.filters button.active b{color:#fff;}
.search{width:100%;max-width:340px;padding:9px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;margin-bottom:14px;outline:none;}
.search:focus{border-color:var(--gold);}
.legend{font-size:12px;color:var(--gray);margin-bottom:16px;line-height:1.9;}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 4px 0 10px;vertical-align:middle;}
.i-core{background:var(--green);}.i-gap{background:var(--blue);}.i-ext{background:var(--red);}.i-ok{background:var(--green);}.i-miss{background:var(--red);}.i-diff{background:var(--purple);}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px;}
.card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;transition:.15s;}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);transform:translateY(-2px);}
.card .thumb{width:100%;aspect-ratio:1/1;background:#1c1c1e;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.card .thumb img{width:100%;height:100%;object-fit:contain;display:block;background:#1c1c1e;}
.card .thumb .noimg{color:#9a9a9a;font-size:12px;text-align:center;padding:8px;}
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
.badge.diff{background:rgba(175,82,222,.12);color:var(--purple);}
.card .reason{font-size:11px;color:#666;line-height:1.45;margin-top:6px;}
.card .orig{font-size:11px;color:#999;margin-top:5px;line-height:1.4;}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:8px;}
.toolbar button{border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 13px;border-radius:10px;font-size:13px;cursor:pointer;transition:.15s;}
.toolbar button:hover{border-color:var(--gold);}
.toolbar .tip{font-size:12px;color:var(--green);}
.card .cmtbtn{display:block;width:100%;font-size:11px;margin-top:8px;padding:5px 0;border:1px dashed var(--line);background:#fafafa;color:var(--gray);border-radius:8px;cursor:pointer;transition:.15s;}
.card .cmtbtn:hover{border-color:var(--gold);color:var(--gold);}
.card .cmtbtn.has{border-style:solid;border-color:var(--gold);color:var(--gold);background:#fffdf6;}
.card .card-cmt{margin-top:8px;}
.card .cmt{width:100%;font-size:11px;padding:6px 7px;border:1px solid var(--line);border-radius:8px;resize:vertical;min-height:42px;font-family:inherit;color:#333;line-height:1.4;}
.card .cmt:focus{border-color:var(--gold);outline:none;}
.card .cmt.has{border-left:3px solid var(--gold);background:#fffdf6;}
.card .cmt-actions{margin-top:5px;text-align:right;}
.card .cmt-done{border:1px solid var(--line);background:#fff;color:var(--gray);font-size:11px;padding:3px 10px;border-radius:8px;cursor:pointer;}
.card .cmt-done:hover{border-color:var(--gold);color:var(--gold);}
.card .cmtview{font-size:11px;color:#333;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin-bottom:5px;}
footer{margin-top:50px;color:var(--gray);font-size:12px;text-align:center;}
</style></head>
<body><div class="container">
<header>
  <h1>英语学园 · 线上词图逐词核对（牛津上海版 2024 标准）</h1>
  <p>逐词核对：线上（github → Cloudflare Pages）每个已部署单词 ↔ 它真实服务的图片，并标注是否「上海小学词汇」。<b>判定依据已更新为「牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt」（Oxford Shanghai Edition 全学段）</b>——github 词只是本仓库收集的一批词（"大哥"），不再作为课标标准，仅按牛津标准重新打标。</p>
</header>

<div class="note">
  <b>上海小学词汇 = 命中牛津2024标准（启发式匹配）</b><br>
  规则：把牛津 txt 词条归一化（去冠词 a/an、去 a pair of / a X of 量词、去括号、简单复数转单数、短语取中心词）后，与线上已部署词的<b>英文</b>或<b>图片 slug</b>匹配；命中即判为「上海小学（＝牛津上海版 2024 标准词）」。<b>功能词（fw-）属小学语法词，归入上海小学（与 app 统一口径：功能词即 core/小学）</b>。匹配为启发式，短语/量词类可能存在少量偏差，请以下方卡片逐词核对。<br>
  <b>逐词核对方法</b>：点「上海小学(牛津)」看全部上海小学(牛津)标准词（含功能词）；点「功能词」单独筛选小学语法词；点「标准缺口」看牛津要求但 app 还没有词卡的词（共 <b>${gapN}</b> 个，重点补卡对象）；点「仅看图缺失」发现词图不对应。每张卡绿/红点表示图片状态（灰=无词卡缺口）。<br>
  <b>单词顺序 & 难度（已与 app 同步）</b><br>
  列表顺序：上海小学(牛津,含功能词)全部在前 → 拓展词 → 各自内部按<b>难度 diff</b>（1 简单 → 2 中等 → 3 难）→ A-Z 兜底；标准缺口恒在最后。难度标签来自 <code>WORD_META.diff</code>（全量覆盖 1167/1167，缺失兜底为「难」），<b>已弃用学段 age 标签</b>。点上方「难度·简单 / 中等 / 难」可分别核对各档词的分类与配图。<br>
  <b>统计</b>：线上已部署词 <b>${totalN}</b> ｜ 上海小学(牛津) <b>${shN}</b>（含功能词 <b>${funcN}</b>）｜ 拓展 <b>${extN}</b> ｜ 带图 <b>${imgN}</b> ｜ 图缺失 <b>${noimgN}</b> ｜ 标准缺口 <b>${gapN}</b>。<br>
  <b>⚠️ 标准缺口去重说明</b>：缺口判定已加入「线上 HAVE_IMG 查重」——牛津标准词若线上已有对应图片（如带 <b>the</b> 的 the Spring Festival / the Mid-autumn Festival、带弯引号的 New Year's Eve / jack-o'-lantern、大小写差异的 high / left 等），按归一化（去 the/a/an + 弯引号→直引号 + 's→-s + 去符号）命中后不再计为缺口，已剔除 <b>${GAP_SKIPPED.length}</b> 条假缺口。这类词线上其实已有图，仅需按标准词形补词卡即可，无需重出图。<br>
  <b>逐词评价</b>：点每张卡下方的「✎ 写评价」按钮，该卡<b>就地展开一个文本框</b>（不再弹窗），可写「图要重出 / 标签要改 / 归错类」等意见，<b>自动存浏览器本地（刷新不丢）</b>；上方「⬇️ 导出评价」下载 JSON 发我，或存为 <code>_vocab_comments.json</code> 让我重生成时嵌入；「⬆️ 导入评价」重新载入。列表一次性渲染全部卡片（图片均 <code>loading="lazy"</code> 懒加载，仅滚动到视口才解码，不占内存），可直接浏览 / 搜索全部词图。
</div>

<div class="stats">
  <div class="chip total"><b>${totalN}</b><span>线上已部署词</span></div>
  <div class="chip core"><b>${shN}</b><span>上海小学(牛津)</span></div>
  <div class="chip ext"><b>${extN}</b><span>拓展</span></div>
  <div class="chip diff"><b>${simpleN}</b><span>难度·简单</span></div>
  <div class="chip diff"><b>${midN}</b><span>难度·中等</span></div>
  <div class="chip diff"><b>${hardN}</b><span>难度·难</span></div>
  <div class="chip"><b>${imgN}</b><span>带图</span></div>
  <div class="chip"><b style="color:var(--red)">${noimgN}</b><span>图缺失</span></div>
  <div class="chip gap"><b>${gapN}</b><span>标准缺口</span></div>
</div>

<div class="filters">
  <button data-f="all" class="active">全部 <b>${ALL.length}</b></button>
  <button data-f="core">上海小学(牛津) <b>${shN}</b></button>
  <button data-f="func">功能词 <b>${funcN}</b></button>
  <button data-f="ext">拓展 <b>${extN}</b></button>
  <button data-f="d1">难度·简单 <b>${simpleN}</b></button>
  <button data-f="d2">难度·中等 <b>${midN}</b></button>
  <button data-f="d3">难度·难 <b>${hardN}</b></button>
  <button data-f="noimg">仅看图缺失 <b>${noimgN}</b></button>
  <button data-f="gap">标准缺口 <b>${gapN}</b></button>
</div>
<div class="toolbar">
  <button id="btnExport" type="button">⬇️ 导出评价(JSON)</button>
  <button id="btnImport" type="button">⬆️ 导入评价</button>
  <span class="tip" id="saveTip"></span>
</div>
<input type="file" id="fileInput" accept="application/json,.json" style="display:none">
<input class="search" id="q" placeholder="搜索英文 / 中文…" />

<div class="legend">
  <i class="i-core"></i>上海小学(牛津2024)
  <i class="i-gap"></i>标准缺口(牛津有·app无)
  <i class="i-ext"></i>拓展(非小学)
  <i class="i-diff"></i>难度(紫·简单/中等/难)
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
var currentList = [];
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
var STORE_PRE = 'vc_cmt_';
function loadLocal(w){ try{ return localStorage.getItem(STORE_PRE+w)||''; }catch(e){ return ''; } }
function saveLocal(w,v){ try{ localStorage.setItem(STORE_PRE+w,v); }catch(e){} }
var localComments = {};
ALL.forEach(function(d){ var lv = loadLocal(d.w); localComments[d.w] = (lv!=='' ? lv : (d.comment||'')); });
function imgFail(img){ var box = img.parentNode; if(box){ box.innerHTML = '<div class="noimg">图缺失(文件未找到)</div>'; } }
// ---- 评价：就地内联文本框（openSet 记录被展开的词，避免一次性 1620 个 textarea）----
var openSet = {};
function cmtInner(w){
  var v = localComments[w] || '';
  var has = v.trim();
  if(openSet[w]){
    return '<textarea class="cmt' + (has?' has':'') + '" data-w="' + w + '" placeholder="写评价…（图要重出/标签要改/归错类…）">' + esc(v) + '</textarea>'
      + '<div class="cmt-actions"><button class="cmt-done" data-w="' + w + '">收起</button></div>';
  }
  if(has){
    return '<div class="cmtview">' + esc(v) + '</div><button class="cmtbtn" data-w="' + w + '">✎ 改评价</button>';
  }
  return '<button class="cmtbtn" data-w="' + w + '">✎ 写评价</button>';
}
function replaceCmt(w){
  var el = grid.querySelector('.card-cmt[data-w="' + w + '"]');
  if(el) el.innerHTML = cmtInner(w);
}
function matches(d){
  if(filter === 'all') return true;
  if(filter === 'core') return d.tier === 'core';
  if(filter === 'func') return !!d.functional;
  if(filter === 'ext') return d.tier === 'ext';
  if(filter === 'd1') return d.tier !== 'gap' && d.diff === 1;
  if(filter === 'd2') return d.tier !== 'gap' && d.diff === 2;
  if(filter === 'd3') return d.tier !== 'gap' && d.diff === 3;
  if(filter === 'noimg') return d.tier !== 'gap' && !d.img;
  if(filter === 'gap') return d.tier === 'gap';
  return true;
}
function makeCard(d){
  var div = document.createElement('div');
  div.className = 'card';
  var thumb = d.tier === 'gap'
    ? '<div class="thumb"><div class="noimg">无词卡<br>(标准缺口)</div></div>'
    : (d.img
      ? '<div class="thumb"><img src="images/' + d.img + '.webp" loading="lazy" onerror="imgFail(this)"></div>'
      : '<div class="thumb"><div class="noimg">暂无图<br>(HAVE_IMG 无此 slug)</div></div>');
  var dot = d.img ? '<span class="dot ok" title="图片存在"></span>' : (d.tier === 'gap' ? '' : '<span class="dot miss" title="图片缺失"></span>');
  var tierBadge = d.tier === 'core' ? '<span class="badge core">📘 上海小学</span>' : d.tier === 'ext' ? '<span class="badge ext">📙 拓展</span>' : '<span class="badge gap">⚠️ 标准缺口</span>';
  var funcBadge = d.functional ? '<span class="badge func">🔤 功能词</span>' : '';
  var diffBadge = d.tier === 'gap' ? '' : '<span class="badge diff">难度·' + (d.diff===1?'简单':d.diff===2?'中等':'难') + '</span>';
  var cmt = '<div class="card-cmt" data-w="' + d.w + '">' + cmtInner(d.w) + '</div>';
  var origLine = d.orig ? '<div class="orig">原始词形: ' + esc(d.orig) + '</div>' : '';
  div.innerHTML = thumb
    + '<div class="body"><div class="en">' + esc(d.w) + ' ' + dot + '</div>'
    + '<div class="zh">' + esc(d.zh||'') + '</div>'
    + tierBadge + funcBadge + diffBadge
    + '<div class="reason">' + esc(d.reason) + '</div>'
    + origLine + cmt + '</div>';
  return div;
}
function computeList(){
  var kw = q.value.trim().toLowerCase();
  currentList = ALL.filter(function(d){
    if(!matches(d)) return false;
    if(kw && d.w.toLowerCase().indexOf(kw) < 0 && (d.zh||'').indexOf(kw) < 0) return false;
    return true;
  });
  grid.innerHTML = '';
  if(currentList.length === 0){ grid.innerHTML = '<div style="color:#999;padding:30px;">无匹配</div>'; return; }
  var frag = document.createDocumentFragment();
  for(var i=0;i<currentList.length;i++){ frag.appendChild(makeCard(currentList[i])); }
  grid.appendChild(frag);
}
document.querySelectorAll('.filters button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active');
    filter = b.getAttribute('data-f');
    computeList();
  });
});
q.addEventListener('input', computeList);
grid.addEventListener('click', function(e){
  var t = e.target;
  if(t && t.classList && t.classList.contains('cmtbtn')){
    var w = t.getAttribute('data-w');
    openSet[w] = true;
    replaceCmt(w);
    var ta = grid.querySelector('textarea.cmt[data-w="' + w + '"]');
    if(ta){ ta.focus(); var v = ta.value; ta.setSelectionRange(v.length, v.length); }
  } else if(t && t.classList && t.classList.contains('cmt-done')){
    var w2 = t.getAttribute('data-w');
    delete openSet[w2];
    replaceCmt(w2);
  }
});
grid.addEventListener('input', function(e){
  var t = e.target;
  if(t && t.classList && t.classList.contains('cmt')){
    var w = t.getAttribute('data-w');
    localComments[w] = t.value;
    saveLocal(w, t.value);
    if(t.value.trim()) t.classList.add('has'); else t.classList.remove('has');
    tip('已保存「' + w + '」的评价（本地）');
  }
});
function tip(msg){ var el=document.getElementById('saveTip'); if(el) el.textContent = msg; }
document.getElementById('btnExport').addEventListener('click', function(){
  var data = {};
  ALL.forEach(function(d){ var v=(localComments[d.w]||'').trim(); if(v) data[d.w]=v; });
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vocab_comments.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  tip('已导出 ' + Object.keys(data).length + ' 条评价（vocab_comments.json）');
});
var fileInput = document.getElementById('fileInput');
document.getElementById('btnImport').addEventListener('click', function(){ fileInput.click(); });
fileInput.addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(){
    try{
      var data = JSON.parse(r.result);
      var n = 0;
      ALL.forEach(function(d){ if(Object.prototype.hasOwnProperty.call(data, d.w)){ localComments[d.w]=data[d.w]; saveLocal(d.w, data[d.w]); n++; } });
      grid.querySelectorAll('.card-cmt').forEach(function(box){ replaceCmt(box.getAttribute('data-w')); });
      tip('已导入 ' + n + ' 条评价');
    }catch(err){ alert('JSON 解析失败：' + err.message); }
  };
  r.readAsText(f);
  e.target.value = '';
});
computeList();
</script>
</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('WROTE', OUT, 'bytes=', html.length);
