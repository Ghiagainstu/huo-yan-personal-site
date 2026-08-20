const fs = require('fs');
const TXT = 'D:/WorkBuddy/Obsidian/上海小学英语词汇/牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt';
const OUT = 'D:/WorkBuddy/Obsidian/上海小学英语词汇/上海小学标准词表_牛津2024.md';

const PLURAL_ONLY = new Set(['glasses','jeans','trousers','scissors','shorts','clothes','pants','tights','pyjamas']);
function singular(w){
  if(PLURAL_ONLY.has(w)) return w;
  if(w.endsWith('ies') && w.length>4) return w.slice(0,-3)+'y';
  if(/s(es|xes|zes|ches|shes)$/.test(w)) return w.slice(0,-2);
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
/* 与 app OXFORD_STD 一致：仅短语转单数（单个复数词保留原形） */
function displayOf(en){
  const b = baseEn(en);
  return (b.includes(' ') && singular(b)!==b) ? singular(b) : b;
}

let rawCount = 0;
const map = new Map(); // disp -> { zh, originals:Set, order }
for(const line of fs.readFileSync(TXT,'utf8').split('\n')){
  if(!line.trim()) continue;
  const parts = line.split('\t');
  if(parts.length<2) continue;
  const en = parts[0].trim(), zh = parts[1].trim();
  if(!en) continue;
  rawCount++;
  const disp = displayOf(en);
  if(!map.has(disp)) map.set(disp, { zh, originals:new Set() });
  map.get(disp).originals.add(en);
}

const rows = [...map.entries()];
const lines = [];
lines.push('# 上海小学标准词表（牛津上海版 2024）');
lines.push('');
lines.push('> **标准来源**：`牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt`（Oxford Shanghai Edition 沪教版牛津版小学全学段词表）。');
lines.push('> **判定规则**：本表为牛津上海版 2024 标准词，按「去冠词 a/an、去 `a pair of`/`a X of` 量词、去括号、简单复数转单数（仅短语）、短语取中心词」归一化去重而得，**与 app `OXFORD_STD` 口径一致**。');
lines.push('');
lines.push('## 统计');
lines.push('- 牛津 txt 原始词条：' + rawCount + '（含单元重复）');
lines.push('- **标准词（归一化去重）：' + rows.length + '**');
lines.push('');
lines.push('## 一、上海小学标准词表（牛津上海版 2024，归一化去重）');
lines.push('');
lines.push('| 序号 | 英文(规范) | 中文 | 原始词形 |');
lines.push('| --- | --- | --- | --- |');
rows.forEach(([disp, info], i) => {
  const orig = [...info.originals].join(' / ');
  lines.push('| ' + (i+1) + ' | ' + disp + ' | ' + info.zh + ' | ' + orig + ' |');
});
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('rawCount:', rawCount, '| 标准词:', rows.length);
console.log('WROTE', OUT);
