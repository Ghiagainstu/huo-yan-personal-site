const fs = require('fs');
const html = fs.readFileSync('poetry-garden/index.html', 'utf8');
function extractArray(name) {
  const marker = 'const ' + name + ' = [';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('not found: ' + name);
  let i = html.indexOf('[', start);
  let depth = 0, end = -1;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = j; break; } }
  }
  return eval(html.slice(i, end + 1));
}
const POEMS = extractArray('POEMS');
const SCENES = extractArray('POEM_SCENES');
const out = POEMS.map((p, idx) => {
  const sc = SCENES[idx] || '';
  const m = /poem-([\w-]+)\.webp/.exec(sc);
  const slug = m ? m[1] : null;
  const lineText = arr => Array.isArray(arr) ? arr.map(l => Array.isArray(l) ? l[0] : l).join('') : '';
  const text = p.title + '。' + p.author + '。' + lineText(p.lines);
  const lines = (p.lines || []).map(l => Array.isArray(l) ? l[0] : l);
  return { slug, title: p.title, author: p.author, dynasty: p.dynasty, note: p.note || '', text, lines };
});
fs.writeFileSync('_poems.json', JSON.stringify(out));
console.log('extracted', out.length, 'poems; slugs with null:', out.filter(o => !o.slug).length);
