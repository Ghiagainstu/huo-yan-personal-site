const fs = require('fs');
const TXT = 'D:/WorkBuddy/Obsidian/上海小学英语词汇/牛津上海版小学英语词汇表（2024版手动整理）含氢刻.txt';
const txt = fs.readFileSync(TXT,'utf8');

function stripParen(s){ return s.replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'').trim(); }
function baseEn(s){
  s = stripParen(s.toLowerCase().trim());
  s = s.replace(/^(an?)\s+/,'');
  s = s.replace(/^a pair of\s+/,'').replace(/^pair of\s+/,'');
  let m = s.match(/^an?\s+([a-z]+)\s+of\b/);
  if(m) s = m[1];
  return s.trim();
}
const PLURAL_ONLY = new Set(['glasses','jeans','trousers','scissors','shorts','clothes','pants','tights','pyjamas']);
function singular(w){
  if(PLURAL_ONLY.has(w)) return w;
  if(w.endsWith('ies') && w.length>4) return w.slice(0,-3)+'y';
  if(w.endsWith('ses')||w.endsWith('xes')||w.endsWith('zes')||w.endsWith('ches')||w.endsWith('shes')) return w.slice(0,-2);
  if(w.endsWith('s') && !w.endsWith('ss') && w.length>3) return w.slice(0,-1);
  return w;
}

let txtRaw=0; const dispMap=new Map(); const rawEn=new Set();
for(const line of txt.split('\n')){
  if(!line.trim()) continue;
  const parts=line.split('\t');
  if(parts.length<2) continue;
  const en=parts[0].trim(); if(!en) continue;
  txtRaw++;
  rawEn.add(en.toLowerCase());
  const b=baseEn(en);
  const disp=(b.includes(' ')&&singular(b)!==b)?singular(b):b;
  dispMap.set(disp,(dispMap.get(disp)||0)+1);
}
console.log('txtRaw(非空 EN\\tZH 行) =', txtRaw);
console.log('txtDistinctRawEn(小写去重英文) =', rawEn.size);
console.log('txtUniqueDisp(归一化去重展示形) =', dispMap.size);
// 展示重复最多的展示形
const dups=[...dispMap.entries()].filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]).slice(0,12);
console.log('重复展示形(>1):', JSON.stringify(dups));
