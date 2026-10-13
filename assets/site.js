/* Lantern Keeper website. Small and dependency-free; every page also works without it. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const icon = (n, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  /* ---------- header (0.30.1): More and the language/currency panel open below their buttons; below 1080px wide (a
     tablet, a phone, or a zoomed-in window) everything is in the side menu. Escape or a click outside closes them. ---------- */
  const head = $('.site-head'), btn = $('.menu-btn'), drawer = $('#drawer');
  const pops = $$('[aria-controls="more-menu"], [aria-controls="lc-pop"]');
  const shut = (except) => pops.forEach(b => { if (b !== except && b.getAttribute('aria-expanded') === 'true') { b.setAttribute('aria-expanded', 'false'); $('#' + b.getAttribute('aria-controls')).hidden = true; } });
  pops.forEach(b => b.addEventListener('click', () => { const p = $('#' + b.getAttribute('aria-controls')), open = p.hidden; shut(b); p.hidden = !open; b.setAttribute('aria-expanded', String(open));
    if (open) { const first = p.querySelector('a, button'); if (first && b.matches('[aria-controls="more-menu"]')) first.focus({ preventScroll: true }); } }));
  document.addEventListener('click', e => { if (!e.target.closest('.more, .lc')) shut(); });
  if (btn && drawer) {
    const set = open => { drawer.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.documentElement.style.overflow = open ? 'hidden' : '';
      if (open) $('.dr-close', drawer).focus(); else btn.focus({ preventScroll: true }); };
    btn.addEventListener('click', () => set(true));
    drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('.dr-close') || e.target.closest('a')) set(false); });
    drawer.addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = $$('a, button', drawer).filter(x => x.offsetParent), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } });
    addEventListener('resize', () => { if (!drawer.hidden && getComputedStyle(btn).display === 'none') set(false); });
    document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!drawer.hidden) set(false); else { const o = pops.find(b => b.getAttribute('aria-expanded') === 'true'); if (o) { shut(); o.focus(); } } });
  }
  // the links fold into the side menu when they don't fit beside the brand and the buttons
  const hin = $('.head-in'), navEl = $('#site-nav');
  if (hin && navEl) { const root = document.documentElement; let busy = false;
    const fit = () => { if (busy) return; busy = true; root.classList.remove('head-fold');
      if (getComputedStyle(navEl).display !== 'none') { const tools = $('.head-tools', hin), over = hin.scrollWidth > hin.clientWidth + 1 || navEl.getBoundingClientRect().right > tools.getBoundingClientRect().left - 8; root.classList.toggle('head-fold', over); if (over) shut(); }
      busy = false; };
    fit(); addEventListener('resize', fit); if (document.fonts) document.fonts.ready.then(fit);
    new MutationObserver(fit).observe(navEl, { subtree: true, characterData: true, childList: true }); }
  const onScroll = () => head && head.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- sections fade in as they arrive (skipped when motion is reduced) ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('in'));
  window.LKSITE = 1; // (the page's safety net: without this, 3 seconds after loading every section is shown, so a script that failed never leaves the page blank)

  /* ---------- which device is this? (for the download buttons) ---------- */
  function device() {
    const ua = navigator.userAgent || '', plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Mac/.test(plat) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/CrOS/.test(ua)) return 'chromeos';
    if (/Win/i.test(plat) || /Windows/.test(ua)) return /ARM|aarch64/i.test(ua) ? 'windows-arm' : 'windows';
    if (/Mac/i.test(plat)) return 'mac';
    if (/Linux/i.test(plat) || /Linux/.test(ua)) return 'linux';
    return 'other';
  }
  const DEV = device();
  // a system the apps can't run on (shown before anyone downloads an installer that won't open; old Macs can't be told
  // apart: browsers report every Mac as 10.15)
  const OLD = (() => { const ua = navigator.userAgent || '';
    if (/Windows NT (5\.|6\.[0-3])/.test(ua)) return 'Windows 7, 8 or 8.1';
    if (/Windows NT 10/.test(ua) && !/Win64|WOW64|x64|amd64|ARM/i.test(ua)) return '32-bit Windows';
    const a = ua.match(/Android (\d+)/); if (a && +a[1] < 7) return 'Android ' + a[1];
    const i = ua.match(/OS (\d+)_\d+[^)]*like Mac OS X/); if (i && +i[1] < 15) return 'iOS ' + i[1];
    return ''; })();
  const LABEL = { windows: 'Download for Windows', 'windows-arm': 'Download for Windows', mac: 'Download for Mac', linux: 'Download for Linux', android: 'Download for Android', ios: 'Get it on iPhone' };
  const ANCHOR = { windows: 'windows', 'windows-arm': 'windows', mac: 'macos', linux: 'linux', android: 'android', ios: 'iphone-and-ipad' };
  $$('[data-download-cta]').forEach(a => { if (LABEL[DEV]) { a.querySelector('span').textContent = LABEL[DEV]; a.href = 'downloads.html#' + ANCHOR[DEV]; } });

  const getJSON = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

  /* ---------- news (news.json, written by the release script) ---------- */
  const newsBox = $('[data-news]');
  if (newsBox) getJSON('news.json').then(d => {
    const n = +newsBox.dataset.news || d.items.length, items = d.items.slice(0, n);
    $$('[data-version]').forEach(el => { el.textContent = d.latest; });
    newsBox.innerHTML = items.map(it => `<article class="news-item reveal in" id="v${esc(it.version.replace(/\./g, '-'))}">
      <div class="ver">${esc(it.version)}${it.date ? `<small>${esc(new Date(it.date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))}</small>` : ''}</div>
      <div><h3>${esc(it.title)}</h3><p>${esc(it.summary)}</p>${(it.notes || []).length ? `<details class="notes"><summary>Patch notes</summary>${it.notes.map(s => `<h4>${esc(s.h)}</h4><ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</details>` : ''}</div></article>`).join('');
  }).catch(() => {});
  else getJSON('news.json').then(d => $$('[data-version]').forEach(el => { el.textContent = d.latest; })).catch(() => {});

  /* ---------- compatibility (compat.json): the status labels, by file and by platform ---------- */
  const compatP = getJSON('compat.json').catch(() => null);
  const badge = (c, st) => c && c.levels[st] ? `<span class="status st-${esc(st)}" title="${esc(c.levels[st][1])}">${esc(c.levels[st][0])}</span>` : '';
  const rowOf = (c, name) => c && c.rows.find(r => (r.files || []).includes(name));
  const compatBox = $('[data-compat]');
  if (compatBox) compatP.then(c => {
    if (!c) return;
    compatBox.innerHTML = `<div class="table compat"><table><thead><tr><th>Platform</th><th>How</th><th>Status</th><th>Controls</th><th>Notes</th></tr></thead><tbody>${c.rows.map(r => `<tr id="c-${esc(r.id)}"><td data-label="Platform"><b>${esc(r.name)}</b></td><td data-label="How">${esc(r.how)}</td><td data-label="Status">${badge(c, r.status)}</td><td data-label="Controls">${esc(r.input || '—')}</td><td data-label="Notes">${esc(r.notes || '')}</td></tr>`).join('')}</tbody></table></div>
      <dl class="legend">${Object.entries(c.levels).map(([k, [n, d]]) => `<div><dt>${badge(c, k)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl><p class="muted small">Last checked ${esc(c.updated)}.</p>`;
  });

  /* ---------- downloads (downloads.json, written by the release script) ---------- */
  const dlBox = $('[data-downloads]');
  // the processor and package, for lists written before the release script added them (0.29)
  const kindOf = n => ({ arch: /ARM64|Apple-silicon/.test(n) ? (/Apple/.test(n) ? 'Apple silicon (arm64)' : 'ARM64') : /Intel|x64|x86_64|amd64/.test(n) ? 'x64' : /\.apk$/.test(n) ? 'Any (no native code)' : /\.ipa$/.test(n) ? 'arm64' : '',
    type: { exe: 'Installer (.exe)', dmg: 'Disk image (.dmg)', AppImage: 'AppImage', deb: 'Debian package (.deb)', rpm: 'RPM package (.rpm)', apk: 'Android package (.apk)', ipa: 'iOS app package (.ipa)' }[n.split('.').pop()] || '' });
  if (dlBox) Promise.all([getJSON('downloads.json'), compatP]).then(([d, c]) => {
    const by = {}; d.files.forEach(f => (by[f.platform] = by[f.platform] || []).push(f));
    const GROUPS = [
      ['windows', 'Windows', 'windows', 'Windows may say it protected your PC, because the installers aren\'t code-signed yet: choose <b>More info</b>, then <b>Run anyway</b>. The app updates by installing the new version over it; your progress stays.'],
      ['macos', 'macOS', 'apple', 'Not notarized by Apple yet. After the first try to open it, go to <b>System Settings &gt; Privacy &amp; Security</b> and choose <b>Open Anyway</b>.'],
      ['linux', 'Linux', 'linux', 'For the AppImage: make it executable (<code>chmod +x</code>) and run it. The .deb and .rpm install with your package manager. On a Steam Deck, use the AppImage in desktop mode, then add it to Steam.'],
      ['android', 'Android', 'android', 'Android 7 or newer. When Android asks, allow your browser or file manager to install apps (<b>Install unknown apps</b>). New versions install over the old one and keep your progress. Play Protect may say the app isn\'t from the Play Store: that\'s normal for a game downloaded from its own site. Choose <b>Install anyway</b> (the SHA-256 below lets you check the file).'],
      ['iphone-and-ipad', 'iPhone and iPad', 'phone', 'The easiest way: open <a href="play/">the web version</a> in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. It plays full screen and offline. The app file below is for sideloading: AltStore, SideStore or Sideloadly sign it with your own Apple ID (free Apple IDs need to refresh it every 7 days). It is not on the App Store yet.']
    ];
    const pick = { windows: 'Lantern-Keeper-Windows-x64.exe', 'windows-arm': 'Lantern-Keeper-Windows-ARM64.exe', mac: 'Lantern-Keeper-macOS-Apple-silicon.dmg', linux: 'Lantern-Keeper-Linux-x86_64.AppImage', android: 'Lantern-Keeper-Android.apk' }[DEV];
    const rec = d.files.find(f => f.name === pick), size = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
    const day = t => t ? new Date(t + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const recBox = $('[data-recommended]'), all = `<a class="btn btn-ghost" href="downloads.html#all-downloads">${icon('download')}View all downloads</a>`;
    if (recBox) {
      if (OLD) recBox.innerHTML = `<div class="rec">${icon('globe', 'big')}<div><h2>On ${esc(OLD)}, play the web version</h2><p>The apps need a newer system, but the web version is the same game, keeps your progress with a free account, and installs like an app from your browser.</p><p><a class="btn btn-primary" href="play/">${icon('play')}Play now</a> <a class="btn btn-ghost" href="downloads.html#older-systems">How to install it</a></p></div></div>`;
      else       if (rec) { const r = rowOf(c, rec.name); recBox.innerHTML = `<div class="rec">${icon(rec.icon || 'download', 'big')}<div><h2>${esc(rec.label)}</h2><p>Lantern Keeper ${esc(d.version)} for ${esc(rec.platformName)} · ${size(rec.size)}${DEV === 'mac' ? ' · on an Intel Mac, choose the Intel download below' : ''} ${r ? badge(c, r.status) : ''}</p></div><div class="rec-act"><a class="btn btn-primary" href="${esc(rec.url)}">${icon('download')}Download</a>${all}</div></div>`; }
      else if (DEV === 'ios') recBox.innerHTML = `<div class="rec">${icon('phone', 'big')}<div><h2>On iPhone and iPad, play in Safari</h2><p>Open the web version, tap Share, then Add to Home Screen. It plays full screen and offline, with the same account and save.</p></div><div class="rec-act"><a class="btn btn-primary" href="play/">${icon('play')}Play now</a>${all}</div></div>`;
      else recBox.innerHTML = `<div class="rec">${icon('globe', 'big')}<div><h2>Play in your browser</h2><p>Nothing to install. Add it to your home screen or desktop from the browser's menu to play offline.</p></div><div class="rec-act"><a class="btn btn-primary" href="play/">${icon('play')}Play now</a>${all}</div></div>`;
    }
    $$('[data-version]').forEach(el => { el.textContent = d.version; });
    dlBox.innerHTML = GROUPS.map(([id, name, ic, help]) => { const fs = by[id] || []; if (!fs.length && id !== 'iphone-and-ipad') return '';
      return `<section class="dl-group" id="${id}" aria-labelledby="h-${id}"><h2 id="h-${id}">${icon(ic)}${name}</h2><p>${help}</p><div class="dl-list">${fs.map(f => { const k = Object.assign(kindOf(f.name), f.arch ? { arch: f.arch } : {}, f.type ? { type: f.type } : {}), r = rowOf(c, f.name); return `
        <div class="dl"><div class="dl-main"><b>${esc(f.label)}</b> ${r ? badge(c, r.status) : ''}
          <dl class="dl-facts"><div><dt>Version</dt><dd>${esc(d.version)}</dd></div><div><dt>Released</dt><dd>${esc(day(d.date))}</dd></div>${k.arch ? `<div><dt>Processor</dt><dd>${esc(k.arch)}</dd></div>` : ''}${k.type ? `<div><dt>Package</dt><dd>${esc(k.type)}</dd></div>` : ''}<div><dt>Size</dt><dd>${size(f.size)}</dd></div>${f.sha256 ? `<div><dt>SHA-256</dt><dd><button type="button" class="hash" data-copy="${esc(f.sha256)}" title="${esc(f.sha256)}" aria-label="Copy the SHA-256 checksum of ${esc(f.name)}">${esc(f.sha256.slice(0, 12))}… copy</button></dd></div>` : ''}</dl>
          ${r && r.notes ? `<p class="dl-note">${esc(r.notes)}</p>` : ''}<div class="meta">${esc(f.name)}</div></div>
        <a class="btn btn-ghost btn-sm" href="${esc(f.url)}" aria-label="Download ${esc(f.label)}, ${size(f.size)}">${icon('download')}Download</a></div>`; }).join('')}</div></section>`; }).join('');
    const prevBox = $('[data-previous]');
    if (prevBox) prevBox.innerHTML = (d.previous || []).length
      ? `<ul class="prev-list">${d.previous.map(p => `<li><b>${esc(p.version)}</b> <span class="muted">${esc(day(p.date))}</span> <a href="${esc(p.release)}">Files and notes on GitHub</a> · <a href="news.html#v${esc(String(p.version).replace(/\.0$/, '').replace(/\./g, '-'))}">What changed</a></li>`).join('')}</ul>`
      : `<p class="muted">${esc(d.version)} is the first version published here. Earlier versions will be listed once there are more.</p>`;
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(() => { dlBox.innerHTML = '<p class="note">The list of downloads could not be loaded. Every file is also on <a href="https://github.com/ExtremeKnight/lantern-keeper-site/releases/latest">GitHub</a>.</p>'; });

  /* ---------- service status (support page): checked live from your browser ---------- */
  const stBox = $('[data-status]');
  if (stBox) {
    const line = (name, state, text) => `<li class="svc svc-${state}"><span class="dot" aria-hidden="true"></span><b>${esc(name)}</b><span>${esc(text)}</span></li>`;
    const timed = (url, ms = 6000) => { const ctl = 'AbortController' in window ? new AbortController() : null; const t = setTimeout(() => ctl && ctl.abort(), ms); const t0 = performance.now(); return fetch(url, { cache: 'no-store', signal: ctl && ctl.signal }).then(r => { clearTimeout(t); return { ok: r.ok, ms: Math.round(performance.now() - t0), r }; }); };
    const render = rows => { stBox.innerHTML = `<ul class="svc-list">${rows.join('')}</ul><p class="muted small">Checked from your browser just now · <button type="button" class="linkish" data-recheck>Check again</button></p>`; };
    const check = () => {
      stBox.innerHTML = '<p class="muted">Checking…</p>';
      const web = timed('downloads.json').then(x => line('Website and downloads', x.ok ? 'up' : 'down', x.ok ? `Working (${x.ms} ms)` : 'Not answering'), () => line('Website and downloads', 'down', 'Not answering'));
      const coop = getJSON('service.json').then(sv => {
        if (!sv.coop) return line('Co-op server', 'off', 'Not running yet. Online co-op rooms run through the online service instead; local and phone-to-phone co-op need no server.');
        return timed(sv.coop.replace(/^ws(s?):/, 'http$1:').replace(/\/$/, '') + '/health', 20000).then(x => line('Co-op server', x.ok ? 'up' : 'down', x.ok ? `Working (${x.ms} ms; the free server may take up to a minute to wake)` : 'Not answering'), () => line('Co-op server', 'down', 'Not answering (the free server may be waking up: check again in a minute)'));
      }, () => line('Co-op server', 'unknown', 'Could not read the service list'));
      Promise.all([web, coop]).then(rows => render(rows.concat([line('Accounts, chat and cloud saves', 'info', 'Checked by the game itself: Settings > Account shows whether it can reach them.')])));
    };
    stBox.addEventListener('click', e => { if (e.target.closest('[data-recheck]')) check(); });
    check();
  }

  /* ---------- back to top ---------- */
  const topBtn = document.createElement('a');
  topBtn.className = 'to-top'; topBtn.href = '#top'; topBtn.innerHTML = icon('up') + '<span class="sr-only">Back to top</span>'; topBtn.setAttribute('aria-label', 'Back to top'); topBtn.hidden = true;
  document.body.append(topBtn);
  topBtn.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); const s = $('.site-head .brand'); if (s) s.focus({ preventScroll: true }); });
  const topCheck = () => { topBtn.hidden = scrollY < Math.max(600, innerHeight * 1.2); };
  addEventListener('scroll', topCheck, { passive: true }); topCheck();

  /* ---------- the hero video: plays only when motion is welcome and data isn't being saved; a button pauses it ---------- */
  const vid = $('#heroVideo'), vbtn = $('.vid-toggle');
  if (vid && vbtn) {
    const still = matchMedia('(prefers-reduced-motion: reduce)'), saving = navigator.connection && navigator.connection.saveData;
    const set = playing => { vbtn.setAttribute('aria-pressed', String(!playing)); vbtn.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play'); vbtn.querySelector('span').textContent = playing ? 'Pause the video' : 'Play the video'; };
    const play = () => { vid.preload = 'auto'; const p = vid.play(); if (p && p.catch) p.catch(() => set(false)); };
    vid.addEventListener('play', () => set(true)); vid.addEventListener('pause', () => set(false));
    vbtn.addEventListener('click', () => (vid.paused ? play() : vid.pause()));
    vbtn.hidden = false; set(false);
    if (!still.matches && !saving) play();
    still.addEventListener && still.addEventListener('change', e => { if (e.matches) vid.pause(); });
  }

  /* ---------- press kit: its size and version (downloads.json once released with the kit, else the preview's kit.json) ---------- */
  const pressMeta = $('[data-press-meta]');
  if (pressMeta) getJSON('downloads.json').then(d => d.press ? { size: d.press.size, version: d.version, url: d.press.url } : getJSON('assets/press/kit.json')).then(k => {
    pressMeta.textContent = `Version ${k.version} · ${(k.size / 1048576).toFixed(1)} MB.`;
    if (k.url) $('[data-press-link]').href = k.url;
  }).catch(() => {});

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const done = () => { const t = b.textContent; b.textContent = 'copied'; setTimeout(() => { b.textContent = t; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => prompt('SHA-256', b.dataset.copy)); else prompt('SHA-256', b.dataset.copy);
  });

  /* ---------- gallery lightbox: keyboard, buttons and swipes ---------- */
  const gal = $('[data-gallery]'), dlg = $('.lightbox');
  if (gal && dlg && typeof dlg.showModal === 'function') {
    const items = $$('button', gal), img = $('img', dlg), cap = $('.lb-cap', dlg); let i = 0, opener = null;
    const show = k => { i = (k + items.length) % items.length; const s = items[i].querySelector('img'); img.src = s.currentSrc || s.src; img.alt = s.alt; cap.textContent = s.alt + ` (${i + 1} of ${items.length})`; };
    items.forEach((b, k) => { b.setAttribute('aria-label', 'Show full size: ' + b.querySelector('img').alt); b.addEventListener('click', () => { opener = b; show(k); dlg.showModal(); }); });
    $('.lb-close', dlg).addEventListener('click', () => dlg.close());
    $('.lb-prev', dlg).addEventListener('click', () => show(i - 1));
    $('.lb-next', dlg).addEventListener('click', () => show(i + 1));
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1); });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.classList.contains('lb-in')) dlg.close(); });
    dlg.addEventListener('close', () => { if (opener) opener.focus(); });
    let x0 = null; dlg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
  }
})();
