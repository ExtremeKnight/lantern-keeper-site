// Lists every text the pitch presentation shows or speaks (assets/pitch.js and the data in pitch.html) that a language
// file doesn't translate yet:  node tools/pitch-strings.js [lang]   (default: every language; prints the missing ones)
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const norm = s => String(s).replace(/\s+/g, ' ').trim();
function strings() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'pitch.js'), 'utf8'), S = new Set();
  const un = s => s.replace(/\\'/g, "'");
  for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) S.add(un(m[1]));
  for (const m of src.matchAll(/(?:say|ch): '((?:[^'\\]|\\.)*)'/g)) S.add(un(m[1]));
  for (const m of src.matchAll(/\[((?:'(?:[^'\\]|\\.)*',?\s*)+)\]\.map\(\((?:c|g), i\)/g)) for (const x of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) S.add(un(x[1]));
  for (const x of ['Pause', 'Play']) S.add(x);
  const h = fs.readFileSync(path.join(ROOT, 'pitch.html'), 'utf8'), D = JSON.parse(/id="pitch-data">([\s\S]*?)<\/script>/.exec(h)[1]);
  for (const x of [...D.loop.flatMap(l => [l.h, l.p]), ...D.stats.map(s => s.label), ...D.shots.map(s => s.alt), ...D.fair.flatMap(f => [f.h, f.p]), ...D.platforms.flatMap(p => [p.h, p.p]), ...D.access.map(a => a.h), ...D.timeline.map(t => t.t), ...D.latest.highlights]) S.add(x);
  return [...S].map(norm).filter(Boolean);
}
module.exports = { strings };
if (require.main === module) {
  const all = strings(), langs = process.argv[2] ? [process.argv[2]] : fs.readdirSync(path.join(ROOT, 'assets', 'i18n')).map(f => f.replace('.json', '')).filter(l => l !== 'en');
  let missing = 0;
  for (const l of langs) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'i18n', l + '.json'), 'utf8')), has = new Set(Object.keys(d).map(norm));
    const m = all.filter(s => !has.has(s)); missing += m.length; console.log(`${l}: ${m.length} of ${all.length} missing`); if (process.argv[2]) console.log(m.join('\n')); }
  process.exitCode = missing ? 1 : 0;
}
