/* Lantern Keeper website. Small and dependency-free; every page also works without it. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const icon = (n, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  /* ---------- header: menu on small screens, a solid bar once scrolled ---------- */
  const head = $('.site-head'), btn = $('.menu-btn'), nav = $('#site-nav');
  if (btn && nav) {
    const set = open => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu'); };
    btn.addEventListener('click', () => set(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
  }
  const onScroll = () => head && head.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- sections fade in as they arrive (skipped when motion is reduced) ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('in'));

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
      <div><h3>${esc(it.title)}</h3><p>${esc(it.summary)}</p></div></article>`).join('');
  }).catch(() => {});
  else getJSON('news.json').then(d => $$('[data-version]').forEach(el => { el.textContent = d.latest; })).catch(() => {});

  /* ---------- downloads (downloads.json, written by the release script) ---------- */
  const dlBox = $('[data-downloads]');
  if (dlBox) getJSON('downloads.json').then(d => {
    const by = {}; d.files.forEach(f => (by[f.platform] = by[f.platform] || []).push(f));
    const GROUPS = [
      ['windows', 'Windows', 'windows', 'Windows may say it protected your PC, because the installers aren\'t code-signed yet: choose <b>More info</b>, then <b>Run anyway</b>. The app updates by installing the new version over it; your progress stays.'],
      ['macos', 'macOS', 'apple', 'Not notarized by Apple yet. After the first try to open it, go to <b>System Settings &gt; Privacy &amp; Security</b> and choose <b>Open Anyway</b>.'],
      ['linux', 'Linux', 'linux', 'For the AppImage: make it executable (<code>chmod +x</code>) and run it. The .deb and .rpm install with your package manager. On a Steam Deck, use the AppImage in desktop mode, then add it to Steam.'],
      ['android', 'Android', 'android', 'Android 7 or newer. When Android asks, allow your browser or file manager to install apps (<b>Install unknown apps</b>). New versions install over the old one and keep your progress.'],
      ['iphone-and-ipad', 'iPhone and iPad', 'phone', 'The easiest way: open <a href="play/">the web version</a> in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. It plays full screen and offline. The app file below is for sideloading: AltStore, SideStore or Sideloadly sign it with your own Apple ID (free Apple IDs need to refresh it every 7 days). It is not on the App Store yet.'],
    ];
    const pick = { windows: 'Lantern-Keeper-Windows-x64.exe', 'windows-arm': 'Lantern-Keeper-Windows-ARM64.exe', mac: 'Lantern-Keeper-macOS-Apple-silicon.dmg', linux: 'Lantern-Keeper-Linux-x86_64.AppImage', android: 'Lantern-Keeper-Android.apk' }[DEV];
    const rec = d.files.find(f => f.name === pick), size = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
    const recBox = $('[data-recommended]');
    if (recBox) {
      if (rec) recBox.innerHTML = `<div class="rec">${icon(rec.icon || 'download', 'big')}<div><h2>${esc(rec.label)}</h2><p>Lantern Keeper ${esc(d.version)} for ${esc(rec.platformName)} · ${size(rec.size)}${DEV === 'mac' ? ' · on an Intel Mac, choose the Intel download below' : ''}</p></div><a class="btn btn-primary" href="${esc(rec.url)}">${icon('download')}Download</a></div>`;
      else if (DEV === 'ios') recBox.innerHTML = `<div class="rec">${icon('phone', 'big')}<div><h2>On iPhone and iPad, play in Safari</h2><p>Open the web version, tap Share, then Add to Home Screen. It plays full screen and offline, with the same account and save.</p></div><a class="btn btn-primary" href="play/">${icon('play')}Play now</a></div>`;
      else recBox.innerHTML = `<div class="rec">${icon('globe', 'big')}<div><h2>Play in your browser</h2><p>Nothing to install. Add it to your home screen or desktop from the browser's menu to play offline.</p></div><a class="btn btn-primary" href="play/">${icon('play')}Play now</a></div>`;
    }
    $$('[data-version]').forEach(el => { el.textContent = d.version; });
    dlBox.innerHTML = GROUPS.map(([id, name, ic, help]) => { const fs = by[id] || []; if (!fs.length && id !== 'iphone-and-ipad') return '';
      return `<section class="dl-group" id="${id}" aria-labelledby="h-${id}"><h2 id="h-${id}">${icon(ic)}${name}</h2><p>${help}</p><div class="dl-list">${fs.map(f => `
        <div class="dl"><div><b>${esc(f.label)}</b><div class="meta">${esc(f.name)} · ${size(f.size)}${f.sha256 ? ` · <span class="nw">SHA-256 <button type="button" data-copy="${esc(f.sha256)}" title="${esc(f.sha256)}" aria-label="Copy the SHA-256 checksum of ${esc(f.name)}">copy</button></span>` : ''}</div></div>
        <a class="btn btn-ghost btn-sm" href="${esc(f.url)}" aria-label="Download ${esc(f.label)}, ${size(f.size)}">${icon('download')}Download</a></div>`).join('')}</div></section>`; }).join('');
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(() => { dlBox.innerHTML = '<p class="note">The list of downloads could not be loaded. Every file is also on <a href="https://github.com/ExtremeKnight/lantern-keeper-site/releases/latest">GitHub</a>.</p>'; });
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
