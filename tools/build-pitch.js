// The pitch presentation (pitch.html, 0.30.1): an interactive deck with narration in every site language. It is built
// from what the rest of the site already says, so it changes with every release by itself:
//   - the home page (tools/pages/index.html): the game loop, the numbers, the screenshots, the promise, the platforms
//   - news.json: the version, its date, how many updates there have been, what the latest one brought
//   - the devlog stories (../lantern-keeper/docs/devlog-stories.json, when the game repo is next to this one): milestones
//   - the roadmap (../lantern-keeper/docs/ROADMAP.md): what comes next
// Run by tools/build-site.js (and so by tools/publish-release.js --push-site). The narration's words live in
// assets/pitch.js and are translated like the rest of the site (assets/i18n/<lang>.json, the dashboard's translations).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), GAME = path.join(ROOT, '..', 'lantern-keeper');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = s => String(s || '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

module.exports = function buildPitch() {
  const home = fs.readFileSync(path.join(ROOT, 'tools', 'pages', 'index.html'), 'utf8');
  const sec = id => { const m = new RegExp(`<section[^>]*aria-label(?:ledby)?="${id}"[\\s\\S]*?</section>`).exec(home); if (!m) throw new Error('pitch: the home page has no section ' + id); return m[0]; };
  const all = (re, s) => [...s.matchAll(re)];
  const loop = all(/<li[^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g, sec('loop-title')).map(m => ({ h: text(m[1]), p: text(m[2]) }));
  const stats = all(/<li[^>]*><b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g, sec('The game in numbers')).map(m => ({ n: text(m[1]), label: text(m[2]) }));
  const shots = all(/<img src="([^"]+)" width="(\d+)" height="(\d+)" alt="([^"]*)"/g, sec('gallery-title')).map(m => ({ src: m[1], w: +m[2], h: +m[3], alt: text(m[4]) }));
  const fair = all(/<li>(?:<svg[\s\S]*?<\/svg>)?<div><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/div><\/li>/g, sec('fair-title')).map(m => ({ h: text(m[1]), p: text(m[2]) }));
  const platforms = all(/<a class="platform[^"]*" href="([^"]+)">(?:<svg[\s\S]*?<\/svg>)?<b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/a>/g, sec('platforms-title')).map(m => ({ href: m[1], h: text(m[2]), p: text(m[3]) }));
  const access = all(/<h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>/g, sec('access-title')).map(m => ({ h: text(m[1]), p: text(m[2]) }));
  if (process.env.PITCH_DEBUG) console.log({ loop: loop.length, stats: stats.length, shots: shots.length, fair: fair.length, platforms: platforms.length, access: access.length });
  if (loop.length < 3 || stats.length < 3 || shots.length < 3 || fair.length < 2 || platforms.length < 3) throw new Error('pitch: the home page changed shape; update tools/build-pitch.js');
  const statOf = re => (stats.find(s => re.test(s.label)) || {}).n || '';

  const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'news.json'), 'utf8')), items = news.items || [];
  const today = new Date().toISOString().slice(0, 10), out = items.filter(i => !i.date || i.date <= today);
  const latest = items.find(i => i.version === news.latest) || out[0] || items[0];
  const first = items[items.length - 1];
  let stories = {}; try { stories = JSON.parse(fs.readFileSync(path.join(GAME, 'docs', 'devlog-stories.json'), 'utf8')); } catch (e) { /* the game repo is not next to this one */ }
  const MILESTONES = ['0.2', '0.8', '0.9', '0.13', '0.14', '0.15', '0.20.0', '0.26.0', '0.28.0', '0.30.0'];
  const timeline = MILESTONES.filter(v => stories[v]).map(v => ({ v: v.replace(/\.0$/, ''), t: stories[v][0] }));
  if (stories[latest.version] && !timeline.some(x => x.v === latest.version.replace(/\.0$/, ''))) timeline.push({ v: latest.version.replace(/\.0$/, ''), t: stories[latest.version][0] });
  let next = []; try { const md = fs.readFileSync(path.join(GAME, 'docs', 'ROADMAP.md'), 'utf8'), part = (/^## [^\n]*\n([\s\S]*?)(?=^## )/m.exec(md) || [])[1] || '';
    next = all(/^[-*] \*\*([^*]+)\*\*/gm, part).map(m => text(m[1])).concat(all(/^[-*] (?!\*\*)([^\n]+)/gm, part).map(m => text(m[1]).split(/[:.(]/)[0])).filter(x => x.length > 3 && x.length < 70).slice(0, 4); } catch (e) { /* no roadmap */ }

  const data = { version: latest.version.replace(/\.0$/, ''), date: latest.date || today, updates: Math.max(items.length, Object.keys(stories).length), since: first && first.date || '', built: today,
    latest: { title: latest.title, summary: latest.summary, highlights: (latest.notes || []).map(n => n.h).filter(Boolean).slice(0, 5) },
    regions: statOf(/region/), weapons: statOf(/weapon/), keepers: statOf(/keeper/), charms: statOf(/charm/), achievements: statOf(/achievement/),
    loop, stats, shots, fair, platforms, access, timeline, next };
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lantern Keeper: the presentation</title>
<meta name="description" content="Lantern Keeper in a few minutes: the idea, how it plays, its features, fair play, where it runs, the development so far and where it is going. Narrated, in eight languages.">
<meta name="theme-color" content="#0a0f24">
<link rel="icon" href="assets/img/icon-64.png">
<link rel="preload" href="assets/fonts/Jersey10.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/pitch.css">
<meta property="og:title" content="Lantern Keeper: the presentation">
<meta property="og:image" content="https://lk.exenova.is-local.host/assets/img/og.png">
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="pitch-body">
<a class="skip" href="#deck">Skip to the presentation</a>
<main id="main" class="pitch" data-noedit>
  <div class="deck" id="deck" tabindex="-1" aria-roledescription="presentation" aria-label="Lantern Keeper presentation"></div>
  <noscript><p class="wrap">The presentation needs JavaScript. Everything in it is also on the <a href="./">home page</a>.</p></noscript>
</main>
<script type="application/json" id="pitch-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script src="assets/site-edit.js" defer></script>
<script src="assets/i18n.js" defer></script>
<script src="assets/pitch.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'pitch.html'), html);
  return { path: 'pitch.html', title: 'Lantern Keeper: the presentation', data };
};
if (require.main === module) { const r = module.exports(); console.log(`pitch.html for ${r.data.version}: ${r.data.shots.length} screenshots, ${r.data.timeline.length} milestones, ${r.data.next.length} next`); }
