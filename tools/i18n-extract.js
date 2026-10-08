#!/usr/bin/env node
// The website's texts to translate (0.30.1): node tools/i18n-extract.js -> assets/i18n/en.json (the English source).
// Opens every page (signed out) in a browser, with the help panel open, and collects what assets/i18n.js translates:
// each block of text (a paragraph, heading, list item, button, label...) as its HTML with inline tags kept, and the
// placeholder, aria-label, title and alt texts. Legal pages (terms, privacy) stay English and are skipped. The strings
// that only scripts show (store, account, community, the helper) are added from their I18N_EXTRA lists.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), { chromium } = require(process.env.LK_PLAYWRIGHT || path.join(__dirname, '..', '..', 'lantern-keeper', 'node_modules', 'playwright'));
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'assets', 'i18n');
const PAGES = ['index.html', 'downloads.html', 'news.html', 'community.html', 'store.html', 'support.html', 'account.html', '404.html', 'store-return.html']; // (the press kit stays English: it is for journalists)
(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith(path.sep)) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(), page = await b.newPage(), all = new Map();
  await page.addInitScript(() => { window.LK_I18N_COLLECT = true; });
  for (const p of PAGES) {
    await page.goto(BASE + p); await page.waitForTimeout(1200);
    if (await page.$('.lkb-btn')) { await page.click('.lkb-btn'); await page.waitForTimeout(300); }
    const got = await page.evaluate(() => window.LKI18N ? window.LKI18N.collect() : []);
    for (const s of got) if (!all.has(s)) all.set(s, p);
  }
  await b.close(); srv.close();
  // from the scripts: t('...') calls, and the fixed text between tags in their templates (whole texts only, no ${...})
  const extra = [], norm = x => x.replace(/\s+/g, ' ').trim();
  for (const f of ['assets/hub.js', 'assets/bot.js', 'assets/i18n.js']) { const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) extra.push(m[1].replace(/\\'/g, "'"));
    if (f === 'assets/hub.js') for (const m of src.matchAll(/>([^<>{}$`\\]{3,})</g)) { const x = norm(m[1]); if (/[A-Za-z]{3,}/.test(x) && !/^[\s.,:;·()|-]+$/.test(x)) extra.push(x); } }
  for (const s of extra) if (!all.has(s)) all.set(s, 'script');
  // an icon with a label (a menu link, a channel): assets/i18n.js translates the label on its own, so only the label is kept
  for (const k of [...all.keys()]) { const bare = k.replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<span class="(lkc-ico|sr-only)">[^<]*<\/span>/g, m => /sr-only/.test(m) ? m.replace(/<[^>]+>/g, '') : '').replace(/^<span>([^<]*)<\/span>$/, '$1').trim();
    if (bare !== k && !/</.test(bare)) { all.delete(k); if (bare && !all.has(bare)) all.set(bare, 'label'); } }
  // not texts: checksums, sizes, numbers, bits of script, and lines with live values (versions, status times)
  const JUNK = [/^[0-9a-f]{12}/, /^[\d.,]+ ?(MB|KB|GB)$/, /^[\d,.+]+ Lumens$/, /'\);|= '|const |=>/, /^&nbsp;$/, /data-version/, /\(\d+ ms\)/, /^<b>\d+\.\d+\.\d+<\/b>/, /^[\d.]+$/, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/, /^<span>[^<]+<\/span> (· \d+|<b>\d+<\/b>)$/];
  const out = {}; for (const k of [...all.keys()].sort()) if (!JUNK.some(r => r.test(k))) out[k] = k;
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'en.json'), JSON.stringify(out, null, 1) + '\n');
  const words = Object.keys(out).join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  console.log(`${Object.keys(out).length} texts (${words} words) -> assets/i18n/en.json`);
})().catch(e => { console.error(e); process.exit(1); });
