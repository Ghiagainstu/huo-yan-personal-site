const fs = require('fs');
const INDEX = 'D:/Fire/火哥的个人站/english-wonderland/index.html';
const TXT = 'D:/WorkBuddy/Obsidian/上海小学英语词汇/牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt';
let raw = fs.readFileSync(INDEX, 'utf8');

// 1) 用 indexOf 精确定位 OXFORD_STD 块（不用正则，避免跨块误吞）
const START = 'const OXFORD_STD = new Set([';
const i0 = raw.indexOf(START);
if (i0 < 0) throw new Error('OXFORD_STD start not found');
const iClose = raw.indexOf('\n]);', i0);
if (iClose < 0) throw new Error('OXFORD_STD closing not found');
const block = raw.slice(i0, iClose + '\n]);'.length);
const OLD = new Set([...block.matchAll(/"([^"]+)"/g)].map(m => m[1]));
console.log('旧 OXFORD_STD keys:', OLD.size, '块行数:', block.split('\n').length);

// 2) 归一化（与 normKey 一致，含去全角括号）
function normKey(s) {
  s = (s || '').toLowerCase().trim();
  s = s.replace(/^the\s+/, '').replace(/^a\s+/, '').replace(/^an\s+/, '');
  s = s.replace(/[\u2019\u2018]/g, "'");
  s = s.replace(/'s/g, '-s').replace(/'/g, '');
  s = s.replace(/[（【][^）】]*[）】]/g, '');
  s = s.replace(/[.,!?;:()\/\u2013\u2014&]/g, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s;
}
// 3) keysFor（页面口径：基础词 + 紧凑 + 单数 + 短语取中心词 + 中心词单数）
const PLURAL_ONLY = new Set(['glasses','jeans','trousers','scissors','shorts','clothes','pants','tights','pyjamas']);
function singular(w) {
  if (PLURAL_ONLY.has(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (/s(es|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}
function stripParen(s) { return s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim(); }
function baseEn(s) {
  s = stripParen(s.toLowerCase().trim());
  s = s.replace(/^(an?)\s+/, '');
  s = s.replace(/^a pair of\s+/, '').replace(/^pair of\s+/, '');
  let mm = s.match(/^an?\s+([a-z]+)\s+of\b/);
  if (mm) s = mm[1];
  return s.trim();
}
function keysFor(s) {
  const out = new Set();
  const b = baseEn(s);
  out.add(b); out.add(b.replace(/\s+/g, ''));
  const sg = singular(b);
  if (sg !== b) { out.add(sg); out.add(sg.replace(/\s+/g, '')); }
  const toks = b.split(/\s+/).filter(Boolean);
  if (toks.length > 1) { const last = toks[toks.length - 1]; out.add(last); out.add(singular(last)); }
  return out;
}
// 4) 并集（旧 key 也过 normKey，自动清理全角括号死键并去重）
const NEW = new Set();
for (const k of OLD) NEW.add(normKey(k));
for (const line of fs.readFileSync(TXT, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const p = line.split('\t');
  if (p.length < 2) continue;
  const en = p[0].trim();
  if (!en) continue;
  for (const k of keysFor(en)) NEW.add(normKey(k));
}
// 5) 生成新块
const keys = [...NEW].sort();
const lines = [];
for (let i = 0; i < keys.length; i += 8) {
  lines.push('  ' + keys.slice(i, i + 8).map(k => '"' + k + '"').join(',') + (i + 8 < keys.length ? ',' : ''));
}
const newBlock = START + '\n' + lines.join('\n') + '\n]);';
// 6) 精确替换
raw = raw.slice(0, i0) + newBlock + raw.slice(iClose + '\n]);'.length);
fs.writeFileSync(INDEX, raw, 'utf8');
console.log('OXFORD_STD 再生完成:', OLD.size, '→', NEW.size, 'keys');
