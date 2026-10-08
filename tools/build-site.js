#!/usr/bin/env node
// Builds the website's pages: each file in tools/pages/ is a page body; this wraps it in the shared layout (head,
// header, footer, icons) and writes it to the site's root. Run after editing a page:  node tools/build-site.js
// A page starts with a comment holding its settings as JSON:
//   <!--{"title": "...", "description": "...", "nav": "home", "path": "index.html", "image": "assets/img/og.png"}-->
// Nothing here is needed at run time: GitHub Pages serves the generated .html files as they are.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PAGES = path.join(__dirname, 'pages');
const SITE = 'https://lk.exenova.is-local.host/'; // (0.30: the site's own address; extremeknight.github.io/lantern-keeper-site/ redirects here)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Icons: one inline sprite per page (works without scripts); use as <svg><use href="#i-name"/></svg>
const ICONS = {
  check: '<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<g fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1"/></g>',
  download: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6.5 10l5.5 5.5 5.5-5.5M4 20h16"/></g>',
  menu: '<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></g>',
  close: '<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></g>',
  left: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  right: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  windows: '<path d="M3 5.3l7.3-1v7.2H3zM11.3 4.1L21 2.8v8.7h-9.7zM3 12.5h7.3v7.2L3 18.7zM11.3 12.5H21v8.7l-9.7-1.3z" fill="currentColor"/>',
  apple: '<path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C6.9 7.3 5.4 8.2 4.6 9.7c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 2.9 2.4s1.6-.8 3-.8 1.8.8 3 .7c1.3 0 2.1-1.2 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.4-.9-2.4-4zM14.2 5.6c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z" fill="currentColor"/>',
  linux: '<g fill="currentColor"><path d="M12 2.5c-2.3 0-3.6 1.9-3.6 4.4 0 1.4-.6 2.4-1.5 3.8C5.8 12.4 5 14.3 5 16.4c0 .9.2 1.7.6 2.4l-1.3.9c-.4.3-.3.9.1 1.1l2.5 1c.6.2 1.2-.1 1.4-.6h7.4c.2.5.8.8 1.4.6l2.5-1c.4-.2.5-.8.1-1.1l-1.3-.9c.4-.7.6-1.5.6-2.4 0-2.1-.8-4-1.9-5.7-.9-1.4-1.5-2.4-1.5-3.8 0-2.5-1.3-4.4-3.6-4.4z" opacity=".95"/></g><g fill="#0a0f24"><ellipse cx="10.4" cy="7" rx="1" ry="1.3"/><ellipse cx="13.6" cy="7" rx="1" ry="1.3"/><path d="M12 13c-1.9 0-3.2 1.5-3.2 3.3S10 19.4 12 19.4s3.2-1.3 3.2-3.1S13.9 13 12 13z" opacity=".35"/></g>',
  android: '<g fill="currentColor"><path d="M6 9.5h12V18a1.5 1.5 0 0 1-1.5 1.5H15V22a1.3 1.3 0 0 1-2.6 0v-2.5h-.8V22A1.3 1.3 0 0 1 9 22v-2.5H7.5A1.5 1.5 0 0 1 6 18zM3.8 9.5a1.3 1.3 0 0 1 1.3 1.3v5a1.3 1.3 0 0 1-2.6 0v-5a1.3 1.3 0 0 1 1.3-1.3zM20.2 9.5a1.3 1.3 0 0 1 1.3 1.3v5a1.3 1.3 0 0 1-2.6 0v-5a1.3 1.3 0 0 1 1.3-1.3zM6.1 8.6C6.4 6.5 7.8 4.9 9.6 4.1L8.5 2.4a.4.4 0 0 1 .7-.4l1.2 1.8a7 7 0 0 1 3.2 0l1.2-1.8a.4.4 0 0 1 .7.4l-1.1 1.7c1.8.8 3.2 2.4 3.5 4.5z"/></g><g fill="#0a0f24"><circle cx="9.6" cy="6.6" r=".8"/><circle cx="14.4" cy="6.6" r=".8"/></g>',
  phone: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3" stroke-linecap="round"/></g>',
  globe: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.8 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.8-3.8-9S9.4 5.6 12 3z"/></g>',
  pad: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7.5 7h9a5 5 0 0 1 4.9 4.1l.9 5a2.6 2.6 0 0 1-4.6 2.1L15.9 16H8.1l-1.8 2.2a2.6 2.6 0 0 1-4.6-2.1l.9-5A5 5 0 0 1 7.5 7z"/><path d="M8 10.5v3M6.5 12h3"/></g><g fill="currentColor"><circle cx="15.5" cy="11" r="1"/><circle cx="17.5" cy="13" r="1"/></g>',
  users: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.4c2 .8 3.5 2.8 3.5 5.6"/></g>',
  swords: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l-2 2 2 2M8 21l-1.5-1.5"/></g>',
  map: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></g>',
  spark: '<path d="M12 2.5l1.9 6.1 6.1 1.9-6.1 1.9L12 18.5l-1.9-6.1L4 10.5l6.1-1.9zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor"/>',
  shield: '<path d="M12 2.8l7.5 3v6c0 4.6-3.2 8.3-7.5 9.6-4.3-1.3-7.5-5-7.5-9.6v-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  heart: '<path d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.8a4.8 4.8 0 0 1 8.5 2.7c0 6-8.5 11-8.5 11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  access: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4.5" r="1.8" fill="currentColor"/><path d="M4.5 8.5c2.4.7 4.9 1 7.5 1s5.1-.3 7.5-1M12 9.5v5M12 14.5l-3 6.5M12 14.5l3 6.5"/></g>',
  tower: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M9 21l1.2-11h3.6L15 21zM9.5 10V7h5v3M12 3.5L9.5 7h5z"/><path d="M4 7.5l5.5 1M20 7.5l-5.5 1" stroke-linecap="round"/><path d="M7 21h10" stroke-linecap="round"/></g>',
  wave: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.2-2 4.5-2S18.8 9 21 9M3 15c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.2-2 4.5-2 2.3 2 4.5 2"/></g>',
  up: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M6 11l6-6 6 6"/><path d="M5 20h14"/></g>',
  coin: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7l3 5-3 5-3-5z" fill="currentColor" stroke="none"/></g>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  bag: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4.5 8h15l-1.2 12.5H5.7z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" stroke-linecap="round"/></g>',
  book: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z"/></g>',
  mail: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></g>',
  lock: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></g>',
  offline: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.6 15.4a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></g>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  steam: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6.5" width="18" height="11" rx="3"/><circle cx="8" cy="12" r="1.6" fill="currentColor"/><circle cx="16" cy="12" r="1.6" fill="currentColor"/></g>',
  tv: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="12.5" rx="2"/><path d="M8 21h8" stroke-linecap="round"/></g>',
  news: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4" stroke-linecap="round"/></g>',
  help: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></g>',
  user: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></g>',
  chev: '<path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  image: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5-5 4 4 3-3 5 5"/></g>',
  box: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/></g>',
  chat: '<path d="M4 5.5h16v10.5H10l-5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  home: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></g>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  hash: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15M4 15h15"/></g>',
  megaphone: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l7 4.5v-13L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6M7.5 14l1 5h2.5l-1-4.5"/></g>',
  list: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><circle cx="4.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="17.5" r=".9" fill="currentColor"/></g>',
  bell: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></g>',
  bookmark: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  flag: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/></g>',
  reply: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6L4 11.5 9.5 17"/><path d="M4.5 11.5H14a6 6 0 0 1 6 6v1"/></g>',
  trash: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></g>',
  ban: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></g>',
  edit: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z"/><path d="M13 7l4 4"/></g>',
  share: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/></g>',
  camera: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h4l1.5-2.5h6L16.5 8h4v11.5h-17z"/><circle cx="12" cy="13.5" r="3.5"/></g>',
};
const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;

// 0.30.1 (approved 8 October): four links always shown, the rest under More; on tablets and phones a side menu, in groups
const NAV = [['community.html', 'Community', 'community', 'chat'], ['news.html', 'News', 'news', 'news'], ['store.html', 'Store', 'store', 'bag'], ['downloads.html', 'Downloads', 'downloads', 'download']];
const MORE = [['index.html#features', 'Features', 'features', 'spark'], ['index.html#gallery', 'Gallery', 'gallery', 'image'], ['support.html', 'Support &amp; FAQ', 'support', 'help'], ['press.html', 'Press kit', 'press', 'box']];
const DRAWER = [['Play', [['play/', 'Play free', 'play', 'play'], ['downloads.html', 'Downloads', 'downloads', 'download']]],
  ['Keepers', [NAV[0], NAV[1], NAV[2], ['account.html', 'Account', 'account', 'user']]], ['About the game', MORE]];

function layout(meta, body) {
  const url = SITE + (meta.path === 'index.html' ? '' : meta.path), img = SITE + (meta.image || 'assets/img/og.png');
  const title = meta.path === 'index.html' ? meta.title : `${meta.title} · Lantern Keeper`;
  const cur = id => meta.nav === id ? ' aria-current="page"' : '', ic = n => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const nav = NAV.map(([href, label, id]) => `<a href="${href}"${cur(id)}>${label}</a>`).join('');
  const more = MORE.map(([href, label, id, i]) => `<a href="${href}"${cur(id)}>${ic(i)}<span>${label}</span></a>`).join(''), moreOn = MORE.some(m => m[2] === meta.nav);
  const drawer = DRAWER.map(([h, items]) => `<p class="dr-h">${h}</p>${items.map(([href, label, id, i]) => `<a href="${href}"${cur(id)}>${ic(i)}<span>${label}</span></a>`).join('')}`).join('');
  const ld = meta.path === 'index.html' ? `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Lantern Keeper', url: SITE, image: SITE + 'assets/img/og.png', description: meta.description, genre: ['Roguelite', 'Tower defense', 'Idle'], gamePlatform: ['Web browser', 'Windows', 'macOS', 'Linux', 'Android', 'iOS'], applicationCategory: 'Game', operatingSystem: 'Windows, macOS, Linux, Android, iOS, Web', playMode: ['SinglePlayer', 'CoOp', 'MultiPlayer'], author: { '@type': 'Organization', name: 'Exenova', email: 'l4nternkeeper@gmail.com' }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } })}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">${meta.base ? `
<base href="${meta.base}">` : ""}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>${meta.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0a0f24">
<link rel="icon" type="image/png" sizes="64x64" href="assets/img/icon-64.png">${meta.manifest ? `
<link rel="manifest" href="${meta.manifest}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="LK Dashboard">` : ''}
<link rel="apple-touch-icon" href="assets/img/icon-192.png">
<link rel="preload" href="assets/fonts/Jersey10.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
<link rel="alternate" type="application/rss+xml" title="Lantern Keeper news (RSS)" href="feed.xml">
<link rel="alternate" type="application/atom+xml" title="Lantern Keeper news (Atom)" href="atom.xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lantern Keeper">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">${ld}
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
${sprite()}
<a class="skip" href="#main">Skip to content</a>
<header class="site-head" id="top">
  <div class="wrap head-in">
    <a class="brand" href="./" aria-label="Lantern Keeper, home"><img src="assets/img/icon-64.png" alt="" width="36" height="36"><span>Lantern Keeper</span></a>
    <nav class="nav" id="site-nav" aria-label="Main">${nav}<div class="more"><button class="more-btn" type="button" aria-expanded="false" aria-controls="more-menu"${moreOn ? ' data-on' : ''}><span>More</span>${ic('chev')}</button><div class="pop more-pop" id="more-menu" hidden>${more}</div></div></nav>
    <div class="head-tools">
      <div class="lc"><button class="lc-btn" type="button" aria-expanded="false" aria-controls="lc-pop" aria-label="Language and currency" translate="no">${ic('globe')}<b data-lc-lang>EN</b><i aria-hidden="true">·</i><b data-lc-cur>$</b></button><div class="pop lc-pop" id="lc-pop" hidden></div></div>
      <a class="icon-btn head-acct" href="account.html" aria-label="Account"${cur('account')}>${ic('user')}</a>
      <a class="btn btn-primary btn-sm head-play" href="play/">${ic('play')}<span>Play free</span></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="drawer">${ic('menu')}<span class="sr-only">Menu</span></button>
    </div>
  </div>
</header>
<div class="drawer" id="drawer" hidden><div class="dr-panel" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="dr-top"><a class="brand" href="./"><img src="assets/img/icon-64.png" alt="" width="32" height="32"><span>Lantern Keeper</span></a><button class="icon-btn dr-close" type="button">${ic('close')}<span class="sr-only">Close</span></button></div>
  <nav aria-label="Menu">${drawer}</nav>
  <p class="dr-h">Language</p><div class="chips" data-lc-langs translate="no"></div>
  <p class="dr-h">Currency</p><div class="chips" data-lc-curs translate="no"></div>
</div></div>
<main id="main">
${body.trim()}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="./"><img src="assets/img/icon-64.png" alt="" width="36" height="36">Lantern Keeper</a>
        <p>An idle roguelite lighthouse defense game by Exenova. Free to play, no ads, nothing that changes how you play is ever sold.</p>
      </div>
      <div><h2>Play</h2><ul><li><a href="play/">In your browser</a></li><li><a href="downloads.html">Downloads</a></li><li><a href="index.html#platforms">Platforms</a></li></ul></div>
      <div><h2>Game</h2><ul><li><a href="index.html#features">Features</a></li><li><a href="index.html#gallery">Gallery</a></li><li><a href="news.html">News</a></li><li><a href="community.html">Community</a></li><li><a href="press.html">Press kit</a></li><li><a href="pitch.html">Presentation</a></li></ul></div>
      <div><h2>Help</h2><ul><li><a href="support.html">Support &amp; FAQ</a></li><li><a href="support.html#status">Service status</a></li><li><a href="privacy-policy.html">Privacy Policy</a></li><li><a href="terms.html">Terms of Service</a></li><li><a href="mailto:l4nternkeeper@gmail.com">l4nternkeeper@gmail.com</a></li></ul></div>
    </div>
    <div class="foot-bottom"><span>© 2026 Exenova. Lantern Keeper.</span><span>No cookies, trackers or ads on this site. Signing in keeps your sign-in in this browser; the sign-in form loads hCaptcha's human check.</span></div>
  </div>
</footer>
<script src="assets/site-edit.js" defer></script>
<script src="assets/i18n.js" defer></script>
<script src="assets/site.js" defer></script>
<script src="assets/bot.js" defer></script>
</body>
</html>
`;
}

const built = [];
for (const f of fs.readdirSync(PAGES).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(PAGES, f), 'utf8'), m = /^<!--(\{[\s\S]*?\})-->\s*/.exec(src);
  if (!m) throw new Error(f + ': no settings comment at the top');
  const meta = Object.assign({ path: f }, JSON.parse(m[1]));
  fs.writeFileSync(path.join(ROOT, meta.path), layout(meta, src.slice(m[0].length)));
  built.push(meta);
}
// 0.30.1: the pitch presentation, rebuilt from the home page and the news at every build (tools/build-pitch.js)
built.push({ path: require('./build-pitch')().path });
// the sitemap (every page except the 404)
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${built.filter(b => b.path !== '404.html' && !b.noindex).map(b => `  <url><loc>${SITE}${b.path === 'index.html' ? '' : b.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n  <url><loc>${SITE}play/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`);
// 0.29: news feeds (RSS 2.0 and Atom) from news.json, for feed readers
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'news.json'), 'utf8')).items.slice(0, 30);
const link = it => `${SITE}news.html#v${it.version.replace(/\./g, '-')}`, when = it => new Date((it.date || today) + 'T12:00:00Z');
fs.writeFileSync(path.join(ROOT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Lantern Keeper news</title><link>${SITE}news.html</link><description>Every Lantern Keeper update, newest first.</description><language>en</language>
<atom:link href="${SITE}feed.xml" rel="self" type="application/rss+xml"/>
${news.map(it => `<item><title>${xml(it.version + ': ' + it.title)}</title><link>${link(it)}</link><guid isPermaLink="true">${link(it)}</guid><pubDate>${when(it).toUTCString()}</pubDate><description>${xml(it.summary)}</description></item>`).join('\n')}
</channel></rss>
`);
fs.writeFileSync(path.join(ROOT, 'atom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Lantern Keeper news</title><id>${SITE}news.html</id><link href="${SITE}news.html"/><link rel="self" href="${SITE}atom.xml"/>
<updated>${news.length ? when(news[0]).toISOString() : new Date().toISOString()}</updated><author><name>Exenova</name></author>
${news.map(it => `<entry><title>${xml(it.version + ': ' + it.title)}</title><id>${link(it)}</id><link href="${link(it)}"/><updated>${when(it).toISOString()}</updated><summary>${xml(it.summary)}</summary></entry>`).join('\n')}
</feed>
`);
// the email design, for the dashboard's previews (0.30.1): copied from the game repo next to this one, when it is there
{ const SHARED = path.join(ROOT, '..', 'lantern-keeper', 'supabase', 'functions', '_shared'), OUTE = path.join(ROOT, 'assets', 'email', 'js');
  if (fs.existsSync(SHARED)) { fs.mkdirSync(OUTE, { recursive: true }); for (const f of ['email-layout.js', 'email-render.js', 'email-templates.js']) fs.copyFileSync(path.join(SHARED, f), path.join(OUTE, f)); } }
// 0.30.1: every stylesheet and script is loaded with a fingerprint of its content (?v=...), so a phone or browser that
// kept an old copy takes the new one at once after a release; the language files follow the same fingerprint
{ const crypto = require('crypto'), fp = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10); } catch (e) { return ''; } };
  const langDir = path.join(ROOT, 'assets', 'i18n'), langFp = fs.existsSync(langDir) ? crypto.createHash('sha256').update(fs.readdirSync(langDir).sort().map(f => fs.readFileSync(path.join(langDir, f), 'utf8')).join('')).digest('hex').slice(0, 10) : '';
  for (const b of built) { const f = path.join(ROOT, b.path); let h = fs.readFileSync(f, 'utf8');
    h = h.replace(/(src|href)="(assets\/[^"?#]+\.(?:js|css))"/g, (m, a, u) => { const v = u === 'assets/i18n.js' ? fp(u) + langFp : fp(u); return v ? `${a}="${u}?v=${v}"` : m; });
    fs.writeFileSync(f, h); } }
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log('built ' + built.map(b => b.path).join(', ') + ', sitemap.xml, robots.txt, feed.xml, atom.xml');
