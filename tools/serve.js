#!/usr/bin/env node
// Preview the website as GitHub Pages serves it:  node tools/serve.js   then open http://localhost:8730/
// (the same path prefix as the real site, so links, the 404 page and the game in play/ behave the same).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = '/', PORT = +process.env.PORT || 8730;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/lantern-keeper-site' || u.startsWith('/lantern-keeper-site/')) { r.writeHead(301, { location: u.replace('/lantern-keeper-site', '') || '/' }); return r.end(); } // (the old path, as GitHub redirects it)
  if (!u.startsWith(BASE)) u = BASE + '404.html';
  let f = path.join(ROOT, u.slice(BASE.length));
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  const found = fs.existsSync(f);
  if (!found) f = path.join(ROOT, '404.html');
  r.writeHead(found ? 200 : 404, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(f).pipe(r);
}).listen(PORT, () => console.log(`Website preview: http://localhost:${PORT}${BASE}`));
