#!/usr/bin/env node
// Checks the website the way visitors meet it:  node tools/check-site.js
// Needs Playwright (the game's repository has it): set LK_PLAYWRIGHT to its folder if it isn't found here.
// Optional: AXE=<path to axe.min.js> also runs an accessibility scan (axe-core) on every page.
// Every page at 360, 390, 768, 1280 and 1920 wide: no errors, no failed requests, no sideways scrolling, every image
// loads, one h1, alt text everywhere; links inside the site resolve; the menu, the gallery lightbox, the downloads
// recommendation for each kind of device (0.29: with status labels, file details, compatibility and previous versions), the news, the 404 page; and the legal pages' text against OLD_PRIVACY /
// OLD_TERMS (the published versions, to prove a redesign changed no word).
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const pw = require(process.env.LK_PLAYWRIGHT || path.join(__dirname, '..', '..', 'lantern-keeper', 'node_modules', 'playwright'));
const PORT = 8731 + Math.floor(Math.random() * 50), BASE = `http://localhost:${PORT}/lantern-keeper-site/`;
const PAGES = ['', 'downloads.html', 'news.html', 'support.html', 'privacy-policy.html', 'terms.html'];
const WIDTHS = [[360, 740], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
let pass = 0, fail = 0;
const report = (name, ok, info) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '\n        ' + JSON.stringify(info).slice(0, 1200)}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
const PLAT = { windows: 'Win32', android: 'Linux armv8l', iphone: 'iPhone', mac: 'MacIntel', linux: 'Linux x86_64' };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await fetch(BASE); break; } catch (e) { await sleep(150); } }
  const b = await pw.chromium.launch();
  try {
    const links = new Set();
    for (const pg of PAGES) for (const [w, h] of WIDTHS) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }), p = await ctx.newPage(), errs = [], bad = [];
      p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push(r.status() + ' ' + r.url()); }); p.on('requestfailed', r => { if (r.url().startsWith(BASE)) bad.push('failed ' + r.url()); });
      await p.goto(BASE + pg, { waitUntil: 'networkidle' });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
      await p.waitForLoadState('networkidle');
      // lazy images may still be decoding on a busy machine: wait for them to finish (a broken one still fails below)
      await p.waitForFunction(() => [...document.images].every(i => i.closest('dialog:not([open])') || i.complete), null, { timeout: 15000 }).catch(() => {});
      const r = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        wide: [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.sr-only,dialog'); }).slice(0, 3).map(e => e.tagName + '.' + e.className),
        brokenImgs: [...document.images].filter(i => !i.closest('dialog:not([open])') && (!i.complete || !i.naturalWidth)).map(i => i.src),
        noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.src),
        h1: document.querySelectorAll('h1').length, title: document.title,
        unnamed: [...document.querySelectorAll('a,button')].filter(e => e.offsetParent && !(e.textContent.trim() || e.getAttribute('aria-label') || e.querySelector('img[alt]:not([alt=""])'))).map(e => e.outerHTML.slice(0, 80)),
        links: [...document.querySelectorAll('a[href]')].map(a => a.href),
      }));
      r.links.forEach(l => links.add(l));
      report(`${pg || 'index.html'} at ${w}px: no errors, nothing wider than the screen, images load, one h1, named links and buttons`,
        !errs.length && !bad.length && r.overflow <= 0 && !r.wide.length && !r.brokenImgs.length && !r.noAlt.length && r.h1 === 1 && !r.unnamed.length, { errs, bad, overflow: r.overflow, wide: r.wide, broken: r.brokenImgs, noAlt: r.noAlt, h1: r.h1, unnamed: r.unnamed });
      if (process.env.AXE && w === 390 || process.env.AXE && w === 1280) {
        await p.addScriptTag({ path: process.env.AXE });
        const ax = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')));
        report(`${pg || 'index.html'} at ${w}px: no serious accessibility problems (axe-core)`, !ax.length, ax);
      }
      await ctx.close();
    }
    // links inside the site (and their #anchors)
    const internal = [...links].filter(l => l.startsWith(BASE)), dead = [];
    for (const l of internal) { const [u, hash] = l.split('#'); const res = await fetch(u); if (!res.ok) { dead.push(res.status + ' ' + l); continue; }
      if (hash && /\.html$|\/$/.test(u) && !/^(features|gallery|platforms|windows|macos|linux|android|iphone-and-ipad|main|top)$/.test(hash)) { const t = await res.text(); let ok = t.includes(`id="${hash}"`);
        if (!ok && /news\.html$/.test(u) && /^v\d/.test(hash)) { const nj = await (await fetch(u.replace(/news\.html$/, 'news.json'))).json(); ok = nj.items.some(it => 'v' + it.version.replace(/\./g, '-') === hash); } // (a version's entry is drawn from news.json)
        if (!ok) dead.push('no #' + hash + ' in ' + u); } }
    report(`every link inside the site works (${internal.length} links)`, !dead.length, dead);

    // the menu on a phone, and Escape closes it
    { const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p.goto(BASE);
      const closed0 = await p.isHidden('#site-nav'); await p.click('.menu-btn'); const open = await p.isVisible('#site-nav a[href="downloads.html"]');
      const exp = await p.getAttribute('.menu-btn', 'aria-expanded'); await p.keyboard.press('Escape'); const closed1 = await p.isHidden('#site-nav');
      const focus = await p.evaluate(() => document.activeElement.className);
      report('the phone menu opens, says so, and Escape closes it and returns focus to the button', closed0 && open && exp === 'true' && closed1 && /menu-btn/.test(focus), { closed0, open, exp, closed1, focus }); }

    // the gallery lightbox, by keyboard
    { const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); await p.goto(BASE);
      const first = p.locator('[data-gallery] button').first(); await first.focus(); await p.keyboard.press('Enter');
      const open = await p.isVisible('dialog.lightbox'), s1 = await p.getAttribute('dialog.lightbox img', 'src');
      await p.keyboard.press('ArrowRight'); const s2 = await p.getAttribute('dialog.lightbox img', 'src'); const cap = await p.textContent('.lb-cap');
      await p.keyboard.press('Escape'); const closed = !(await p.isVisible('dialog.lightbox'));
      const back = await p.evaluate(() => document.activeElement === document.querySelector('[data-gallery] button'));
      report('the gallery opens full size with Enter, the arrow keys move through it, Escape closes it and focus goes back', open && s1 && s2 && s1 !== s2 && /2 of \d+/.test(cap) && closed && back, { open, s1, s2, cap, closed, back }); }

    // the downloads page picks the right file for each kind of device
    const want = { windows: 'Windows-x64.exe', android: 'Android.apk', iphone: 'play/', mac: 'macOS-Apple-silicon.dmg', linux: 'Linux-x86_64.AppImage' };
    for (const [dev, ua] of Object.entries(UA)) {
      const ctx = await b.newContext(Object.assign({ userAgent: ua, viewport: { width: dev === 'iphone' || dev === 'android' ? 390 : 1280, height: 844 } }, dev === 'iphone' ? { isMobile: true, hasTouch: true } : {}));
      await ctx.addInitScript(pl => { Object.defineProperty(navigator, 'platform', { get: () => pl }); }, PLAT[dev]);
      const p = await ctx.newPage(); await p.goto(BASE + 'downloads.html'); await p.waitForSelector('.rec');
      const r = await p.evaluate(() => ({ rec: document.querySelector('.rec a').getAttribute('href'), title: document.querySelector('.rec h2').textContent, groups: [...document.querySelectorAll('.dl-group[id]')].map(g => g.id).join(), compat: document.querySelectorAll('.compat tbody tr').length, badges: document.querySelectorAll('.dl .status').length, facts: document.querySelectorAll('.dl .dl-facts').length, all: !!document.querySelector('.rec a[href$="#all-downloads"]'), prev: !!document.querySelector('[data-previous] p, [data-previous] li'), files: document.querySelectorAll('.dl').length, sums: document.querySelectorAll('[data-copy]').length }));
      const home = await (async () => { await p.goto(BASE); return p.evaluate(() => { const a = document.querySelector('[data-download-cta]'); return a.textContent.trim() + ' -> ' + a.getAttribute('href'); }); })();
      report(`downloads for ${dev}: recommends ${want[dev]}, lists every platform with checksums, and the home page's button says so (${home})`,
        r.rec.endsWith(want[dev]) && r.groups === 'windows,macos,linux,android,iphone-and-ipad,compatibility,previous-versions' && r.compat >= 10 && r.badges === 9 && r.facts === 9 && r.all && r.prev && r.files === 9 && r.sums === 9 && /downloads\.html#/.test(home), Object.assign({ home }, r));
      await ctx.close();
    }
    // news, the 404 page
    { const p = await (await b.newContext()).newPage(); await p.goto(BASE + 'news.html'); await p.waitForSelector('.news-item');
      const n = await p.locator('.news-item').count(); await p.goto(BASE); await p.waitForSelector('.news-item'); const h = await p.locator('.news-item').count();
      report(`News lists every update (${n}) and the home page the latest three`, n >= 10 && h === 3, { n, h });
      const res = await p.goto(BASE + 'no/such/page'); const nf = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, css: getComputedStyle(document.body).backgroundColor, logo: document.querySelector('.brand img').naturalWidth }));
      report('a missing page shows the styled 404 page (even deep in the site)', res.status() === 404 && /Lost in the fog/.test(nf.h1) && nf.css === 'rgb(10, 15, 36)' && nf.logo > 0, Object.assign({ status: res.status() }, nf)); }
    // the legal pages: the same words as before
    for (const [file, env] of [['privacy-policy.html', 'OLD_PRIVACY'], ['terms.html', 'OLD_TERMS']]) {
      if (!process.env[env]) continue;
      const p = await (await b.newContext()).newPage();
      const norm = s => s.replace(/\s+/g, ' ').trim();
      await p.goto('file:///' + process.env[env].replace(/\\/g, '/')); const old = norm(await p.evaluate(() => { const m = document.querySelector('main'); m.querySelector('h1').remove(); m.querySelector('p.muted').remove(); return m.innerText; }));
      await p.goto(BASE + file); const now = norm(await p.evaluate(() => { const m = document.querySelector('.prose'); m.querySelector('.toc').remove(); return m.innerText; }));
      const head = await p.evaluate(() => document.querySelector('.page-head').innerText);
      let at = 0; while (at < old.length && old[at] === now[at]) at++;
      report(`${file}: the text is word for word what was published (${old.length} characters), and the version line is kept`, old === now && /Version \d/.test(head), { firstDifference: at, was: old.slice(at - 40, at + 60), now: now.slice(at - 40, at + 60) });
    }
  } finally { await b.close(); srv.kill(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
