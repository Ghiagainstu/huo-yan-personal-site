/* 一次性：把 PHON 里的 dictionaryapi 远程 URL 重写为本地 audio/ 路径。
   规则：
   - URL 本地文件存在 → audio/<basename>
   - URL 本地不存在 → 若 wiktionary_map 该词同 slot 有本地文件 → audio/<wtfile>
   - 仍无本地文件 → 保留原远程 URL（代理恢复后可用，或走 TTS 兜底）
   不置空任何条目。 */
const fs = require('fs');
const path = require('path');

const audioDir = __dirname;
const idxPath = path.resolve(audioDir, '..', 'index.html');

const all = fs.readdirSync(audioDir);
const dictFiles = new Set(all.filter(f => !f.startsWith('_') && !f.startsWith('wt-')));
const wtFiles = new Set(all.filter(f => f.startsWith('wt-')));
const wtMap = JSON.parse(fs.readFileSync(path.join(audioDir, '_wiktionary_map.json'), 'utf8'));

function existsLocal(name){ return dictFiles.has(name) || wtFiles.has(name); }

let html = fs.readFileSync(idxPath, 'utf8');

const start = html.indexOf('const PHON={');
if(start < 0) throw new Error('PHON not found');
const braceStart = html.indexOf('{', start);
let depth = 0, end = -1;
for(let i = braceStart; i < html.length; i++){
  if(html[i] === '{') depth++;
  else if(html[i] === '}'){ depth--; if(depth === 0){ end = i; break; } }
}
if(end < 0) throw new Error('PHON closing brace not found');

const phonLit = html.slice(braceStart, end + 1);
const PHON = eval('(' + phonLit + ')');

const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

let localized = 0, remoteKept = 0, stillEmpty = 0, totalSlots = 0;

for(const w of Object.keys(PHON)){
  const p = PHON[w];
  for(const slot of [2, 3]){
    totalSlots++;
    const m = wtMap[w];
    const wtFn = m ? (slot === 2 ? m.uk : m.us) : '';
    let url = p[slot];
    if(!url){
      if(wtFn && existsLocal(wtFn)){ p[slot] = 'audio/' + wtFn; localized++; }
      else { stillEmpty++; }
      continue;
    }
    const base = url.split('/').pop();
    if(existsLocal(base)){ p[slot] = 'audio/' + base; localized++; }
    else if(wtFn && existsLocal(wtFn)){ p[slot] = 'audio/' + wtFn; localized++; }
    else { remoteKept++; }
  }
}

const newInner = Object.keys(PHON).map(w=>{
  const p = PHON[w];
  return "  " + q(w) + ":[" + q(p[0]) + "," + q(p[1]) + "," + q(p[2] || '') + "," + q(p[3] || '') + "]";
}).join(",\n");
const newBlock = "const PHON={\n" + newInner + "\n}";
html = html.slice(0, start) + newBlock + html.slice(end + 1);
fs.writeFileSync(idxPath, html, 'utf8');

console.log(JSON.stringify({ totalSlots, localized, remoteKept, stillEmpty }, null, 2));
