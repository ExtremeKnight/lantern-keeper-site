#!/usr/bin/env node
// node tools/import-legal.js [path to the game's repo]   (default: ../lantern-keeper)
// The Privacy Policy and Terms are written once, in the game's docs/ (the game links to them and the store listings
// quote them). This writes the site's copies, tools/pages/privacy-policy.html and tools/pages/terms.html, from them:
// the site's page head (version line), a table of contents, ids on the section headings, and table cells labelled
// with their column (so the tables read as cards on a phone). Then run node tools/build-site.js as usual.
'use strict';
const fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '..'), GAME = path.resolve(process.argv[2] || path.join(SITE, '..', 'lantern-keeper'));
const slug = t => t.toLowerCase().replace(/&amp;/g, '').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function convert(src, current) {
  const meta = current.split('\n')[0]; // the page's settings for build-site.js (title, description, path) stay as they are
  const main = src.slice(src.indexOf('<main>') + 6, src.indexOf('</main>'));
  const ver = /<p class="muted">(Version [^<]*)<\/p>/.exec(main);
  if (!ver) throw new Error('no version line in the game\'s copy');
  let body = main.slice(main.indexOf(ver[0]) + ver[0].length);
  // section headings: ids, and the contents list
  const toc = [];
  body = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, t) => { const id = slug(t); toc.push(`<li><a href="#${id}">${t}</a></li>`); return `<h2 id="${id}">${t}</h2>`; });
  // tables: each cell labelled with its column's heading
  body = body.replace(/<table>([\s\S]*?)<\/table>/g, (m, inner) => {
    const heads = [...(/<tr>((?:\s*<th>[\s\S]*?<\/th>)+)\s*<\/tr>/.exec(inner) || [, ''])[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map(x => x[1].replace(/<[^>]+>/g, ''));
    return '<table>' + inner.replace(/<tr>([\s\S]*?)<\/tr>/g, (r, cells) => { let i = 0; return '<tr>' + cells.replace(/<td>/g, () => `<td data-label="${heads[i++] || ''}">`) + '</tr>'; }) + '</table>';
  });
  body = body.replace(/<div class="table">/g, '<div class="table-wrap">'); // (the site's name for it)
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(main)[1].replace(/^Lantern Keeper /, '');
  return `${meta}
<div class="page-head">
  <div class="wrap">
    <span class="kicker">Legal</span>
    <h1>${h1}</h1>
    <p>${ver[1]}</p>
  </div>
</div>
<div class="page">
  <div class="wrap prose">
    <ul class="toc" aria-label="Sections">${toc.join('')}</ul>
  ${body.replace(/\s+$/, '')}
  </div>
</div>
`;
}
if (require.main === module) {
  for (const name of ['privacy-policy.html', 'terms.html']) {
    const src = path.join(GAME, 'docs', name), out = path.join(SITE, 'tools', 'pages', name);
    if (!fs.existsSync(src)) { console.log(`skipped ${name}: not in ${path.dirname(src)}`); continue; }
    const html = convert(fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n'));
    fs.writeFileSync(out, html); console.log(`${name}: ${/<p>(Version [^<]*)<\/p>/.exec(html)[1].split(' · ').slice(0, 2).join(', ')}`);
  }
}
module.exports = { convert };
