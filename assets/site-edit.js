/* The website, editable from the dashboard (0.30.1). Every page stays a plain static page; what the team changes is kept in
   the site_edits table and put over the page here, before the translation step runs (assets/i18n.js), so an edit made
   for all languages is still translated when a translation for it exists. An edit for one language wins over it.
   What can be changed: any text block (headings, paragraphs, list items, labels), links and buttons (words and where they
   go), pictures, whole sections (hide, look, order, add new ones), and the site settings: where the Help and back-to-top
   buttons sit, an announcement bar, colours and extra menu links.
   Editing: the dashboard's Website section opens a page with ?edit; the page then checks the account's permissions
   (site.edit, site.settings) and shows the editor. The server checks them again on every save (row-level security), and
   every change is kept in a history that can be undone. Text is cleaned to a few inline tags, never scripts. */
(function () {
  'use strict';
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor' };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests)
  const PAGE = (location.pathname.split('/').pop() || 'index.html').replace(/^$/, 'index.html');
  const LANG = (() => { const L = ['en', 'fil', 'es', 'pt-BR', 'id', 'ja', 'ko', 'zh-CN']; let s = null; try { s = localStorage.getItem('lk-lang'); } catch (e) { /* private mode */ } // (the same choice as assets/i18n.js)
    if (s && L.includes(s)) return s;
    for (const n of navigator.languages || [navigator.language || 'en']) { const x = String(n).toLowerCase(); const hit = L.find(l => l.toLowerCase() === x) || L.find(l => l.split('-')[0] === x.split('-')[0]) || (/^(tl|fil)/.test(x) ? 'fil' : null); if (hit) return hit; }
    return 'en'; })();
  const main = document.getElementById('main');
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const safeUrl = u => { u = String(u || '').trim(); return /^(https?:|mailto:|#|\.?\/|[a-z0-9-]+\.html|[a-z0-9-]+\/)/i.test(u) && !/^\s*javascript:/i.test(u) ? u : ''; };
  const safeImg = u => { u = String(u || '').trim(); return /^(https:\/\/|assets\/|\.\/assets\/)/i.test(u) ? u : ''; };

  // only a few inline tags survive in edited text; links keep a safe href
  const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'SPAN', 'BR', 'A', 'CODE', 'MARK', 'SUP', 'SUB']);
  function clean(html) {
    const tpl = document.createElement('template'); tpl.innerHTML = String(html || '');
    for (const el of [...tpl.content.querySelectorAll('*')]) {
      if (!KEEP.has(el.tagName.toUpperCase())) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) { const n = a.name.toLowerCase();
        if (el.tagName === 'A' && n === 'href') { const u = safeUrl(a.value); if (u) el.setAttribute('href', u); else el.removeAttribute('href'); }
        else if (!(el.tagName === 'A' && (n === 'target' || n === 'rel')) && n !== 'class') el.removeAttribute(a.name); }
      if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
    }
    return tpl.innerHTML;
  }

  // ---------- 1. every block of text, link and picture gets a key (from where it is and what it said) ----------
  const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,summary,blockquote,th,td,a,img,.kicker,label,small';
  const INLINE = new Set(['A', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'SPAN', 'BR', 'CODE', 'KBD', 'SUP', 'SUB', 'ABBR', 'SVG', 'USE', 'TIME', 'MARK', 'S', 'U', 'IMG']);
  const leaf = el => [...el.children].every(c => INLINE.has(c.tagName.toUpperCase()) && (c.tagName === 'A' || leaf(c)));
  const SKIP = 'script, style, template, noscript, [data-noedit], .lc, .lc-pop, .lke, .lk-bar, form, select, textarea, input, .hub, [data-hub], .chips, .more-btn, .menu-btn, .dr-close';
  const blocks = new Map(), sections = [];
  const kindOf = el => el.tagName === 'IMG' ? 'image' : el.tagName === 'A' ? 'link' : 'text';
  function tag(container, region, global) {
    const seen = {};
    const visit = el => {
      for (const c of el.children) {
        if (c.matches(SKIP) || (c.tagName === 'IMG' && !c.getAttribute('src'))) continue; // (an empty picture is filled by a script: the gallery's full-size view)
        const isLink = c.tagName === 'A' && !c.closest('p,li,dd,td,small,label,figcaption,blockquote,h1,h2,h3,h4,h5,h6');
        if (c.tagName === 'IMG' || ((isLink || c.matches(BLOCK)) && c.tagName !== 'IMG' && leaf(c) && /[A-Za-z0-9]/.test(c.textContent))) {
          const k = kindOf(c), sig = k === 'image' ? (c.getAttribute('src') || '').split('?')[0] : k === 'link' ? norm(c.textContent) + '>' + (c.getAttribute('href') || '') : norm(c.innerHTML.replace(/<svg[\s\S]*?<\/svg>/g, ''));
          let key = `${region}:${c.tagName.toLowerCase()}:${hash(sig)}`; seen[key] = (seen[key] || 0) + 1; if (seen[key] > 1) key += '~' + seen[key];
          c.dataset.ek = key; if (!blocks.has(key)) blocks.set(key, { key, kind: k, page: global ? '*' : PAGE, els: [] });
          const b = blocks.get(key); b.els.push(c);
          if (!c.__lkeOrig) c.__lkeOrig = k === 'image' ? { src: c.getAttribute('src'), alt: c.getAttribute('alt') || '' } : k === 'link' ? { html: c.innerHTML, href: c.getAttribute('href') || '', newTab: c.target === '_blank' } : { html: c.innerHTML };
          continue;
        }
        visit(c);
      }
    };
    visit(container);
  }
  const head = document.querySelector('.site-head'), drawer = document.getElementById('drawer'), foot = document.querySelector('.site-foot');
  if (head) tag(head, 'head', true);
  if (drawer) tag(drawer, 'head', true); // (the menu on phones: the same keys as the header, so one edit changes both)
  if (foot) tag(foot, 'foot', true);
  if (main) for (const [i, s] of [...main.children].entries()) {
    if (s.matches('script, template')) continue;
    const h = s.querySelector('h1, h2'), key = s.id ? 'sec-' + s.id : 'sec-' + hash(norm(h ? h.textContent : s.getAttribute('aria-label') || String(i)));
    s.dataset.es = key; sections.push({ key, el: s, label: norm(h ? h.textContent : s.getAttribute('aria-label') || 'Section ' + (i + 1)).slice(0, 60) });
    tag(s, key.slice(4), false);
  }

  // ---------- 2. putting the edits on the page ----------
  let edits = [], settings = null, applied = new Map();
  const editing = () => document.documentElement.classList.contains('lke-on');
  const pickRows = rows => { // per key: this page before every page, this language before all languages
    const best = new Map();
    for (const r of rows) { if (r.lang && r.lang !== LANG) continue; const cur = best.get(r.key), score = (r.page === PAGE ? 2 : 0) + (r.lang ? 1 : 0);
      if (!cur || score > cur.score) best.set(r.key, Object.assign({ score }, r)); }
    return best;
  };
  function setText(el, html, own) { el.innerHTML = clean(html); if (own) el.setAttribute('translate', 'no'); else el.removeAttribute('translate'); }
  function setLink(el, v, own) {
    if (v.html != null) { const svg = [...el.querySelectorAll(':scope > svg')]; const span = el.querySelector(':scope > span:not(.sr-only)');
      if (span && svg.length) span.innerHTML = clean(v.html); else { el.innerHTML = clean(v.html); if (svg.length && !el.querySelector('svg')) el.prepend(...svg); } }
    const u = safeUrl(v.href); if (u) el.setAttribute('href', u);
    if (v.newTab) { el.target = '_blank'; el.rel = 'noopener'; } else if (v.newTab === false) { el.removeAttribute('target'); }
    if (own) el.setAttribute('translate', 'no'); else el.removeAttribute('translate');
  }
  function setImg(el, v) { const u = safeImg(v.src); if (u) { el.src = u; el.removeAttribute('srcset'); const pic = el.closest('picture'); if (pic) for (const s of pic.querySelectorAll('source')) s.remove(); } if (v.alt != null) el.alt = v.alt; }
  function restore(b) {
    for (const el of b.els) { const o = el.__lkeOrig; el.hidden = false; el.classList.remove('lke-hidden'); el.removeAttribute('translate');
      if (b.kind === 'image') { el.src = o.src; el.alt = o.alt; } else if (b.kind === 'link') { el.innerHTML = o.html; el.setAttribute('href', o.href); if (!o.newTab) el.removeAttribute('target'); } else el.innerHTML = o.html; }
  }
  const STYLES = { '': 'As designed', tight: 'Less space', spacious: 'More space', center: 'Centred', highlight: 'Highlighted', alt: 'Shaded', plain: 'Plain' };
  function custom(key, v) { // a section the team added
    const c = v.content || {}, btn = c.button && c.button.label && safeUrl(c.button.href) ? `<p class="btn-row"><a class="btn btn-primary" href="${esc(safeUrl(c.button.href))}">${esc(c.button.label)}</a></p>` : '';
    const img = c.image && safeImg(c.image) ? `<img src="${esc(safeImg(c.image))}" alt="${esc(c.alt || '')}" loading="lazy">` : '';
    let inner;
    if (v.template === 'image') inner = `<div class="lk-split${c.side === 'left' ? ' lk-left' : ''}"><div>${c.kicker ? `<span class="kicker">${esc(c.kicker)}</span>` : ''}<h2>${esc(c.title || '')}</h2><div class="lk-body">${clean(c.body)}</div>${btn}</div><figure>${img}</figure></div>`;
    else if (v.template === 'cards') inner = `<div class="section-head">${c.kicker ? `<span class="kicker">${esc(c.kicker)}</span>` : ''}<h2>${esc(c.title || '')}</h2>${c.body ? `<p>${clean(c.body)}</p>` : ''}</div><div class="lk-cards">${(c.cards || []).slice(0, 8).map(x => `<article class="card">${x.image && safeImg(x.image) ? `<img src="${esc(safeImg(x.image))}" alt="" loading="lazy">` : ''}<h3>${esc(x.title || '')}</h3><p>${clean(x.body)}</p></article>`).join('')}</div>${btn}`;
    else if (v.template === 'video') { const id = (String(c.video || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
      inner = `<div class="section-head"><h2>${esc(c.title || '')}</h2>${c.body ? `<p>${clean(c.body)}</p>` : ''}</div>${id ? `<div class="lk-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(c.title || 'Video')}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : ''}`; }
    else inner = `<div class="section-head">${c.kicker ? `<span class="kicker">${esc(c.kicker)}</span>` : ''}<h2>${esc(c.title || '')}</h2><div class="lk-body">${clean(c.body)}</div></div>${img ? `<figure class="lk-fig">${img}</figure>` : ''}${btn}`;
    const s = document.createElement('section'); s.className = 'lk-custom' + (v.template === 'cta' ? ' cta' : ''); s.dataset.es = key; s.dataset.noedit = ''; s.innerHTML = `<div class="wrap">${inner}</div>`; return s;
  }
  function apply(rows) {
    const best = pickRows(rows); edits = rows;
    // pictures, text and links
    for (const [key, b] of blocks) { const r = best.get(key), was = applied.get(key);
      if (!r) { if (was) { restore(b); applied.delete(key); } continue; }
      if (was && JSON.stringify(was) === JSON.stringify(r)) continue;
      restore(b); const v = r.value || {}, own = !!r.lang;
      for (const el of b.els) { if (r.kind === 'hide' || v.hidden) { if (editing()) el.classList.add('lke-hidden'); else el.hidden = true; continue; }
        if (b.kind === 'image') setImg(el, v); else if (b.kind === 'link') setLink(el, v, own); else if (v.html != null) setText(el, v.html, own); }
      applied.set(key, r); }
    // added sections, then each section's look, then their order
    if (main) {
      for (const el of main.querySelectorAll(':scope > .lk-custom')) el.remove();
      const all = new Map(sections.map(s => [s.key, s.el]));
      for (const [key, r] of best) if (r.kind === 'custom') { const el = custom(key, r.value || {}); all.set(key, el); const after = all.get((r.value || {}).after); if (after && after.parentNode === main) after.after(el); else main.prepend(el); }
      for (const [key, el] of all) { const r = best.get(key), v = r && r.kind !== 'order' ? r.value || {} : {};
        el.hidden = !!v.hidden && !editing();
        el.classList.toggle('lke-hidden', !!v.hidden);
        for (const s of Object.keys(STYLES)) if (s) el.classList.toggle('lk-s-' + s, v.style === s); }
      const ord = best.get('__order');
      if (ord && Array.isArray(ord.value.order)) { const list = ord.value.order.map(k => all.get(k)).filter(el => el && el.parentNode === main);
        const inDoc = [...list].sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1); // (the places these sections hold now, top to bottom)
        const marks = inDoc.map(el => { const m = document.createComment(''); el.before(m); return m; }); marks.forEach((m, i) => m.replaceWith(list[i])); }
    }
    // the settings (every page)
    const st = best.get('settings'); settings = Object.assign({ fab: { help: 'left', top: 'right' }, bar: {}, theme: {}, nav: [] }, st && st.value || {}); drawSettings();
  }
  const THEME = { gold: '--gold', gold2: '--gold2', bg: '--bg', bg2: '--bg2', surface: '--surface', text: '--text', muted: '--muted', line: '--line', sky: '--sky', ember: '--ember' };
  function drawSettings() {
    const s = settings, root = document.documentElement;
    root.dataset.fabHelp = s.fab && s.fab.help === 'right' ? 'right' : 'left';
    root.dataset.fabTop = s.fab && /^(left|right|off)$/.test(s.fab.top) ? s.fab.top : 'right';
    for (const [k, v] of Object.entries(THEME)) { const c = s.theme && s.theme[k]; if (c && /^#[0-9a-f]{6}$/i.test(c)) root.style.setProperty(v, c); else root.style.removeProperty(v); }
    // the announcement bar, above the header; closing it hides this message in this browser
    let bar = document.querySelector('.lk-bar'); const b = s.bar || {}, id = hash(JSON.stringify([b.text, b.link])), closed = (store.get('lk-bar-closed') || []).includes(id);
    const live = b.on && b.text && (!b.until || Date.parse(b.until) > Date.now()) && (!b.from || Date.parse(b.from) <= Date.now()) && (!closed || root.classList.contains('lke-on'));
    if (!live) { if (bar) bar.remove(); }
    else { if (!bar) { bar = document.createElement('div'); bar.className = 'lk-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Announcement'); document.body.prepend(bar); }
      bar.dataset.tone = /^(gold|sky|ember|rose|mint)$/.test(b.tone) ? b.tone : 'gold';
      bar.innerHTML = `<div class="wrap"><p>${clean(b.text)}${b.label && safeUrl(b.link) ? ` <a href="${esc(safeUrl(b.link))}">${esc(b.label)}</a>` : ''}</p><button type="button" class="lk-bar-x" aria-label="Close the announcement">×</button></div>`;
      bar.querySelector('.lk-bar-x').onclick = () => { store.set('lk-bar-closed', [...(store.get('lk-bar-closed') || []), id].slice(-20)); bar.remove(); }; }
    // extra links in the menu, the More menu and the footer
    for (const a of document.querySelectorAll('[data-lk-extra]')) a.remove();
    for (const l of (s.nav || []).slice(0, 12)) { const u = safeUrl(l.href); if (!u || !l.label) continue;
      const mk = cls => { const a = document.createElement('a'); a.href = u; a.textContent = l.label; a.dataset.lkExtra = ''; if (cls) a.className = cls; if (/^https?:/i.test(u)) { a.target = '_blank'; a.rel = 'noopener'; } return a; };
      if (l.where === 'footer') { const ul = document.querySelector('.foot-grid > div:last-child ul'); if (ul) { const li = document.createElement('li'); li.dataset.lkExtra = ''; li.append(mk()); ul.append(li); } }
      else if (l.where === 'more') { const pop = document.getElementById('more-menu'); if (pop) pop.append(mk()); const dn = drawer && drawer.querySelector('nav'); if (dn) dn.append(mk()); }
      else { const more = document.querySelector('#site-nav > .more'); if (more) more.before(mk()); const dn = drawer && drawer.querySelector('nav'); if (dn) dn.append(mk()); } }
  }

  // the last edits seen are kept in this browser, so a page shows them at once next time; then the fresh ones load
  const CACHE = 'lk-edits:' + PAGE, cached = store.get(CACHE);
  if (Array.isArray(cached)) apply(cached); else apply([]);
  const load = () => fetch(`${CFG.url}/rest/v1/site_edits?select=page,key,lang,kind,value&page=in.(%22*%22,%22${encodeURIComponent(PAGE)}%22)`, { headers: { apikey: CFG.key } })
    .then(r => r.ok ? r.json() : null).then(rows => { if (!Array.isArray(rows)) return; store.set(CACHE, rows); apply(rows); return rows; }).catch(() => null);
  const ready = load();

  window.LKSiteEdit = { PAGE, STYLES, THEME, clean, settings: () => settings, reload: () => load(), sections: () => sections, blocks: () => blocks };

  // ---------- 3. the editor, for accounts allowed to change the site ----------
  let wantEdit = /[?&]edit\b/.test(location.search); try { if (wantEdit) sessionStorage.setItem('lk-edit', '1'); else wantEdit = sessionStorage.getItem('lk-edit') === '1'; } catch (e) { /* private mode */ }
  if (!wantEdit || window.LK_I18N_COLLECT) return;
  const script = src => new Promise((ok, no) => { if (window.supabase) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  script('assets/vendor/supabase.js').then(async () => {
    const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, storageKey: 'lk-site-auth', detectSessionInUrl: false } }); // (the same sign-in as the rest of the site)
    const { data: u } = await sb.auth.getUser(); if (!u || !u.user) { notice('Sign in with a team account to edit the website.', 'account.html?next=' + encodeURIComponent(PAGE + '?edit')); return; }
    const perms = new Set((await sb.rpc('my_perms')).data || []);
    if (!perms.has('site.edit') && !perms.has('site.settings')) { notice('This account can not edit the website. An owner can allow it on the dashboard\'s Permissions page.'); return; }
    await ready; editor(sb, u.user, perms);
  }).catch(e => { console.error('site editor', e); notice('The editor could not load. Check the connection and reload the page.'); });
  function notice(msg, href) { const n = document.createElement('div'); n.className = 'lke-bar'; n.innerHTML = `<p>${esc(msg)}</p>${href ? `<a class="btn btn-primary btn-sm" href="${esc(href)}">Sign in</a>` : ''}<button class="btn btn-ghost btn-sm" data-x>Close the editor</button>`; document.body.append(n);
    n.querySelector('[data-x]').onclick = () => { try { sessionStorage.removeItem('lk-edit'); } catch (e) { /* none */ } location.href = location.pathname; }; }

  function editor(sb, me, perms) {
    const root = document.documentElement; root.classList.add('lke-on'); applied.clear(); apply(edits);
    const canEdit = perms.has('site.edit'), canSet = perms.has('site.settings');
    let scope = LANG && LANG !== 'en' ? LANG : '';
    const langName = c => { const l = window.LKI18N && LKI18N.LANGS.find(x => x[0] === c); return l ? l[1] : c; };
    const bar = document.createElement('div'); bar.className = 'lke-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Website editor');
    bar.innerHTML = `<b>Editing ${esc(PAGE)}</b>
      <label>Changes apply to <select data-scope><option value="">All languages</option>${LANG && LANG !== 'en' ? `<option value="${esc(LANG)}" ${scope ? 'selected' : ''}>${esc(langName(LANG))} only</option>` : ''}</select></label>
      ${canEdit ? '<button class="btn btn-ghost btn-sm" data-secs>Sections</button>' : ''}${canSet ? '<button class="btn btn-ghost btn-sm" data-set>Site settings</button>' : ''}
      <button class="btn btn-ghost btn-sm" data-hist>History</button><a class="btn btn-ghost btn-sm" href="admin.html#site">Dashboard</a><button class="btn btn-primary btn-sm" data-exit>Done</button>`;
    document.body.append(bar);
    bar.querySelector('[data-scope]').onchange = e => { scope = e.target.value; };
    bar.querySelector('[data-exit]').onclick = () => { try { sessionStorage.removeItem('lk-edit'); } catch (e) { /* none */ } location.href = location.pathname + location.hash; };
    if (canEdit) bar.querySelector('[data-secs]').onclick = sectionsPanel;
    if (canSet) bar.querySelector('[data-set]').onclick = () => panel('Site settings', box => settingsForm(box, sb));
    bar.querySelector('[data-hist]').onclick = historyPanel;
    const tip = document.createElement('p'); tip.className = 'lke-tip'; tip.textContent = canEdit ? 'Click any text, link, button or picture to change it.' : 'Your account can change the site settings only.'; bar.append(tip);

    async function save(page, key, kind, value) {
      const { error } = await sb.from('site_edits').upsert({ page, key, lang: kind === 'settings' || kind === 'order' ? '' : scope, kind, value });
      if (error) throw error; await load();
    }
    async function drop(page, key, lang) { const { error } = await sb.from('site_edits').delete().eq('page', page).eq('key', key).eq('lang', lang); if (error) throw error; await load(); }

    // a small window that floats next to what is being edited (or as a sheet on small screens)
    let pop = null;
    function close() { if (pop) { pop.__done && pop.__done(); pop.remove(); pop = null; } }
    function float(target, html, ready) {
      close(); pop = document.createElement('div'); pop.className = 'lke-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Edit'); pop.innerHTML = html + '<button class="lke-x" type="button" aria-label="Close">×</button>'; document.body.append(pop);
      const r = target.getBoundingClientRect(), w = Math.min(380, innerWidth - 24); pop.style.width = w + 'px';
      if (innerWidth > 640) { pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px'; const below = r.bottom + 8, h = pop.offsetHeight; pop.style.top = (below + h < innerHeight - 70 ? below : Math.max(12, r.top - h - 8)) + 'px'; }
      else pop.classList.add('lke-sheet');
      pop.querySelector('.lke-x').onclick = close; ready && ready(pop); const f = pop.querySelector('input, textarea, button'); if (f && !target.isContentEditable) f.focus();
    }
    const err = (box, e) => { let m = box.querySelector('.lke-err'); if (!m) { m = document.createElement('p'); m.className = 'lke-err'; m.setAttribute('role', 'alert'); box.append(m); } m.textContent = e && e.message || String(e); };
    const lineFor = b => `<p class="lke-small">${b.page === '*' ? 'On every page (header, menu or footer).' : 'On this page.'} ${scope ? `${esc(langName(scope))} only.` : 'All languages: other languages show their translation when there is one.'}</p>`;

    // clicking something editable opens its editor (links do not navigate while editing)
    document.addEventListener('click', e => {
      if (e.target.closest('.lke-bar, .lke-pop, .lke-panel, .lk-bar')) return;
      const cs = e.target.closest('.lk-custom'); if (cs && canEdit) { e.preventDefault(); e.stopPropagation(); const r = pickRows(edits).get(cs.dataset.es); if (r) sectionForm(r); return; }
      const el = e.target.closest('[data-ek]'); if (!el || !canEdit || el.isContentEditable) return; // (links that can't be edited still work)
      e.preventDefault(); e.stopPropagation(); const b = blocks.get(el.dataset.ek); if (b) edit(b, el);
    }, true);
    for (const b of blocks.values()) for (const el of b.els) { el.classList.add('lke-can'); if (!el.hasAttribute('tabindex') && b.kind !== 'link') el.tabIndex = 0; }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ek && e.target.tagName !== 'A' && !e.target.isContentEditable) { e.preventDefault(); edit(blocks.get(e.target.dataset.ek), e.target); } });

    function edit(b, el) {
      const r = pickRows(edits).get(b.key), has = r && (r.lang || '') === scope && (r.page === b.page);
      const off = el.classList.contains('lke-hidden');
      const tools = `<div class="lke-acts"><button class="btn btn-primary btn-sm" data-save>Save</button><button class="btn btn-ghost btn-sm" data-hide>${off ? 'Show' : 'Hide'}</button>${has ? '<button class="btn btn-ghost btn-sm" data-reset>Undo all changes here</button>' : ''}</div>`;
      if (b.kind === 'image') return float(el, `<h3>Picture</h3><img class="lke-prev" src="${esc(el.getAttribute('src'))}" alt=""><label>Picture address<input data-src value="${esc(el.getAttribute('src'))}" placeholder="https://... or assets/img/..."></label>
        <label class="lke-file">Or upload a picture <small>(PNG, JPG, WebP, GIF or SVG, up to 8 MB)</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" data-file></label>
        <label>Description for screen readers<input data-alt maxlength="300" value="${esc(el.alt)}"></label>${lineFor(b)}${tools}`, p => {
        p.querySelector('[data-file]').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 8388608) return err(p, 'That picture is larger than 8 MB.');
          const path = `${PAGE.replace('.html', '')}/${Date.now().toString(36)}-${f.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60)}`;
          const { error } = await sb.storage.from('site').upload(path, f, { contentType: f.type, upsert: false }); if (error) return err(p, error);
          const url = sb.storage.from('site').getPublicUrl(path).data.publicUrl; p.querySelector('[data-src]').value = url; p.querySelector('.lke-prev').src = url; };
        p.querySelector('[data-src]').oninput = e => { if (safeImg(e.target.value)) p.querySelector('.lke-prev').src = e.target.value; };
        wire(p, b, el, () => ({ src: safeImg(p.querySelector('[data-src]').value) || el.__lkeOrig.src, alt: p.querySelector('[data-alt]').value.trim() }));
      });
      if (b.kind === 'link') { const o = has ? r.value : { html: el.innerHTML, href: el.getAttribute('href'), newTab: el.target === '_blank' }, label = el.querySelector(':scope > span:not(.sr-only)') || el;
        return float(el, `<h3>${el.classList.contains('btn') ? 'Button' : 'Link'}</h3><label>Words<input data-label maxlength="120" value="${esc(norm(label.textContent))}"></label><label>Goes to<input data-href value="${esc(el.getAttribute('href') || '')}" placeholder="news.html, https://..., #section"></label>
          <label class="lke-check"><input type="checkbox" data-tab ${o.newTab ? 'checked' : ''}> Opens in a new tab</label><p class="lke-small"><a href="${esc(el.getAttribute('href') || '#')}" class="lke-pass">Follow this link</a></p>${lineFor(b)}${tools}`, p => {
          p.querySelector('.lke-pass').onclick = e => { e.stopPropagation(); };
          wire(p, b, el, () => { const href = safeUrl(p.querySelector('[data-href]').value); if (!href) throw new Error('Use a page of this site (news.html), a full address (https://...) or a part of the page (#features).');
            return { html: esc(p.querySelector('[data-label]').value.trim()), href, newTab: p.querySelector('[data-tab]').checked }; }); }); }
      // text: edited right on the page, with a few tools for bold, italic and links
      const before = el.innerHTML; el.contentEditable = 'true'; el.classList.add('lke-editing'); el.focus();
      float(el, `<h3>Text</h3><div class="lke-fmt"><button type="button" data-cmd="bold" aria-label="Bold"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button><button type="button" data-cmd="link" aria-label="Link">Link</button><button type="button" data-cmd="removeFormat" aria-label="Clear formatting">Clear</button></div><p class="lke-small">Type on the page. Enter adds a line break.</p>${lineFor(b)}${tools}`, p => {
        for (const x of p.querySelectorAll('[data-cmd]')) { x.onmousedown = e => e.preventDefault(); x.onclick = () => { if (x.dataset.cmd === 'link') { const u = safeUrl(prompt('Link address (https://..., news.html, #section)') || ''); if (u) document.execCommand('createLink', false, u); } else document.execCommand(x.dataset.cmd); el.focus(); }; }
        el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); } };
        p.__done = () => { el.contentEditable = 'false'; el.removeAttribute('contenteditable'); el.classList.remove('lke-editing'); el.onkeydown = null; if (!p.__saved) el.innerHTML = before; };
        wire(p, b, el, () => { const html = clean(el.innerHTML).trim(); if (!norm(html.replace(/<[^>]+>/g, ''))) throw new Error('Empty text: use Hide to take it off the page instead.'); return { html }; });
      });
    }
    function wire(p, b, el, value) {
      p.querySelector('[data-save]').onclick = async () => { try { const v = value(); p.__saved = true; await save(b.page, b.key, b.kind === 'image' ? 'image' : b.kind === 'link' ? 'link' : 'text', v); close(); toast('Saved.'); } catch (e) { p.__saved = false; err(p, e); } };
      p.querySelector('[data-hide]').onclick = async () => { const off = el.classList.contains('lke-hidden'); try { p.__saved = false; close(); if (off) await drop(b.page, b.key, scope); else await save(b.page, b.key, 'hide', { hidden: true }); toast(off ? 'Shown again.' : 'Hidden for visitors (faded while editing).'); } catch (e) { toast(e.message || String(e)); } };
      const rs = p.querySelector('[data-reset]'); if (rs) rs.onclick = async () => { try { p.__saved = true; await drop(b.page, b.key, scope); close(); toast('Back to how it was designed.'); } catch (e) { err(p, e); } };
    }
    function toast(msg) { const t = document.createElement('p'); t.className = 'lke-toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); }

    // a side panel (sections, settings, history)
    function panel(title, fill) {
      close(); let p = document.querySelector('.lke-panel'); if (p) p.remove();
      p = document.createElement('aside'); p.className = 'lke-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', title);
      p.innerHTML = `<div class="lke-ph"><h2>${esc(title)}</h2><button class="lke-x" type="button" aria-label="Close">×</button></div><div class="lke-pb"></div>`; document.body.append(p);
      p.querySelector('.lke-x').onclick = () => p.remove(); fill(p.querySelector('.lke-pb'), p); p.querySelector('.lke-x').focus(); return p;
    }

    // sections: order, hide, look, add, remove the added ones
    function sectionsPanel() {
      panel('Sections of this page', box => {
        const best = pickRows(edits), list = [...main.querySelectorAll(':scope > [data-es]')].map(el => ({ key: el.dataset.es, el, custom: el.classList.contains('lk-custom'), label: (sections.find(s => s.key === el.dataset.es) || {}).label || norm((el.querySelector('h1, h2') || {}).textContent || 'New section').slice(0, 60) }));
        box.innerHTML = `<p class="lke-small">Move sections up or down, hide them, change how they look, or add a new one. Hidden sections show faded while editing.</p><ol class="lke-secs">${list.map((s, i) => { const v = (best.get(s.key) || {}).value || {};
          return `<li data-k="${esc(s.key)}"><b>${esc(s.label)}</b>${s.custom ? ' <small>(added)</small>' : ''}<div class="lke-row"><button type="button" data-up ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" data-down ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button>
            <select data-style aria-label="Look">${Object.entries(STYLES).map(([k, n]) => `<option value="${k}" ${(v.style || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <button type="button" data-vis>${v.hidden ? 'Show' : 'Hide'}</button>${s.custom ? '<button type="button" data-edit>Edit</button><button type="button" data-del>Remove</button>' : ''}<button type="button" data-add>Add after</button></div></li>`; }).join('')}</ol>
          <button class="btn btn-primary btn-sm" data-addtop>Add a section at the top</button>`;
        const keyOf = b => b.closest('[data-k]').dataset.k, rowOf = k => best.get(k);
        const keepLook = async (k, patch) => { const r = rowOf(k), base = r && r.kind === 'custom' ? r : null;
          if (base) await sb.from('site_edits').upsert({ page: PAGE, key: k, lang: base.lang || '', kind: 'custom', value: Object.assign({}, base.value, patch) }).then(x => { if (x.error) throw x.error; });
          else { const v = Object.assign({}, r && r.kind === 'section' ? r.value : {}, patch); if (!v.hidden && !v.style) await sb.from('site_edits').delete().eq('page', PAGE).eq('key', k).eq('lang', '').then(x => { if (x.error) throw x.error; });
            else await sb.from('site_edits').upsert({ page: PAGE, key: k, lang: '', kind: 'section', value: v }).then(x => { if (x.error) throw x.error; }); }
          await load(); sectionsPanel(); };
        const move = async (k, d) => { const keys = list.map(s => s.key), i = keys.indexOf(k), j = i + d; if (j < 0 || j >= keys.length) return; [keys[i], keys[j]] = [keys[j], keys[i]];
          const { error } = await sb.from('site_edits').upsert({ page: PAGE, key: '__order', lang: '', kind: 'order', value: { order: keys } }); if (error) throw error; await load(); sectionsPanel(); };
        const go = fn => async e => { try { await fn(e); } catch (x) { err(box, x); } };
        for (const b of box.querySelectorAll('[data-up]')) b.onclick = go(() => move(keyOf(b), -1));
        for (const b of box.querySelectorAll('[data-down]')) b.onclick = go(() => move(keyOf(b), 1));
        for (const s of box.querySelectorAll('[data-style]')) s.onchange = go(() => keepLook(keyOf(s), { style: s.value || undefined }));
        for (const b of box.querySelectorAll('[data-vis]')) b.onclick = go(() => keepLook(keyOf(b), { hidden: b.textContent === 'Hide' || undefined }));
        for (const b of box.querySelectorAll('[data-del]')) b.onclick = go(async () => { if (!confirm('Remove this added section? You can bring it back from History.')) return; const r = rowOf(keyOf(b)); await drop(PAGE, keyOf(b), r.lang || ''); sectionsPanel(); });
        for (const b of box.querySelectorAll('[data-edit]')) b.onclick = () => sectionForm(rowOf(keyOf(b)));
        for (const b of box.querySelectorAll('[data-add]')) b.onclick = () => sectionForm(null, keyOf(b));
        box.querySelector('[data-addtop]').onclick = () => sectionForm(null, '');
      });
    }
    function sectionForm(r, after) {
      const v = r ? r.value : { template: 'text', after, content: {} }, c = v.content || {};
      panel(r ? 'Edit the section' : 'Add a section', box => {
        box.innerHTML = `<form class="lke-form"><label>Kind<select name="template">${[['text', 'Text (with an optional picture)'], ['image', 'Text beside a picture'], ['cards', 'Cards'], ['cta', 'Call to action'], ['video', 'YouTube video']].map(([k, n]) => `<option value="${k}" ${v.template === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Small title above <small>(optional)</small><input name="kicker" maxlength="60" value="${esc(c.kicker || '')}"></label><label>Title<input name="title" maxlength="140" required value="${esc(c.title || '')}"></label>
          <label>Text <small>(&lt;b&gt;, &lt;i&gt; and &lt;a href&gt; work)</small><textarea name="body" rows="5" maxlength="6000">${esc(c.body || '')}</textarea></label>
          <label>Picture address <small>(optional)</small><input name="image" value="${esc(c.image || '')}" placeholder="https://... or assets/img/..."></label><label class="lke-file">Or upload one<input type="file" accept="image/*" data-file></label>
          <label>Picture description<input name="alt" maxlength="300" value="${esc(c.alt || '')}"></label><label>Picture side<select name="side"><option value="right">Right</option><option value="left" ${c.side === 'left' ? 'selected' : ''}>Left</option></select></label>
          <label>YouTube address <small>(for a video)</small><input name="video" value="${esc(c.video || '')}"></label>
          <fieldset><legend>Cards <small>(one per block: title, a line with ---, then its text)</small></legend><textarea name="cards" rows="6">${esc((c.cards || []).map(x => x.title + '\n---\n' + (x.body || '')).join('\n\n'))}</textarea></fieldset>
          <div class="hub-row"><label>Button words<input name="blabel" maxlength="60" value="${esc(c.button && c.button.label || '')}"></label><label>Button goes to<input name="bhref" value="${esc(c.button && c.button.href || '')}"></label></div>
          ${lineFor({ page: PAGE })}<button class="btn btn-primary btn-sm" type="submit">${r ? 'Save' : 'Add the section'}</button></form>`;
        const f = box.querySelector('form');
        f.querySelector('[data-file]').onchange = async e => { const file = e.target.files[0]; if (!file) return; const path = `${PAGE.replace('.html', '')}/${Date.now().toString(36)}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60)}`;
          const { error } = await sb.storage.from('site').upload(path, file, { contentType: file.type }); if (error) return err(box, error); f.image.value = sb.storage.from('site').getPublicUrl(path).data.publicUrl; };
        f.onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f));
          const cards = String(d.cards || '').split(/\n\s*\n(?=[^\n]+\n---)/).map(x => { const [t, ...rest] = x.split(/\n---\n/); return { title: norm(t), body: rest.join('\n').trim() }; }).filter(x => x.title);
          const value = { template: d.template, after: r ? v.after : after, style: v.style, hidden: v.hidden, content: { kicker: d.kicker, title: d.title, body: clean(d.body), image: safeImg(d.image), alt: d.alt, side: d.side, video: d.video, cards, button: d.blabel ? { label: d.blabel, href: safeUrl(d.bhref) } : null } };
          try { const key = r ? r.key : 'custom-' + Date.now().toString(36); const { error } = await sb.from('site_edits').upsert({ page: PAGE, key, lang: r ? r.lang || '' : scope, kind: 'custom', value }); if (error) throw error;
            if (!r) { const o = pickRows(edits).get('__order'); if (o) { const keys = o.value.order.slice(), i = after ? keys.indexOf(after) : -1; keys.splice(i + 1, 0, key); await sb.from('site_edits').upsert({ page: PAGE, key: '__order', lang: '', kind: 'order', value: { order: keys } }); } }
            await load(); sectionsPanel(); toast('Saved.'); const el = main.querySelector(`[data-es="${key}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { err(box, x); } };
      });
    }

    // history: the last changes on this page and on every page, each one can be undone
    async function historyPanel() {
      panel('History', async box => {
        box.innerHTML = '<p class="lke-small">Loading...</p>';
        const { data, error } = await sb.from('site_edit_log').select('*').in('page', ['*', PAGE]).order('at', { ascending: false }).limit(40); if (error) return err(box, error);
        const what = x => { const v = x.after || x.before || {}; return x.kind === 'settings' ? 'Site settings' : x.kind === 'order' ? 'Order of the sections' : x.kind === 'custom' ? 'Added section: ' + ((v.content || {}).title || '') : x.kind === 'section' ? 'A section\'s look' : x.kind === 'hide' ? 'Hidden: ' + x.key : x.kind === 'image' ? 'Picture' : norm(String(v.html || '').replace(/<[^>]+>/g, '')).slice(0, 80) || x.key; };
        box.innerHTML = `<ol class="lke-hist">${(data || []).map(x => `<li><b>${esc(what(x))}</b><small>${x.after ? (x.before ? 'Changed' : 'Added') : 'Removed'}${x.lang ? ' · ' + esc(langName(x.lang)) : ''} · ${new Date(x.at).toLocaleString()}</small><button class="btn btn-ghost btn-sm" data-undo="${x.id}">Undo</button></li>`).join('') || '<li>No changes yet.</li>'}</ol>`;
        for (const b of box.querySelectorAll('[data-undo]')) b.onclick = async () => { const x = data.find(y => y.id === +b.dataset.undo);
          try { const q = x.before ? await sb.from('site_edits').upsert({ page: x.page, key: x.key, lang: x.lang, kind: x.kind, value: x.before }) : await sb.from('site_edits').delete().eq('page', x.page).eq('key', x.key).eq('lang', x.lang); if (q.error) throw q.error; await load(); toast('Undone.'); historyPanel(); } catch (e) { err(box, e); } };
      });
    }
  }

  // ---------- the settings form (also used by the dashboard) ----------
  function settingsForm(box, sb, done) {
    const s = JSON.parse(JSON.stringify(settings || {})), b = s.bar || {}, fab = s.fab || {}, th = s.theme || {};
    const css = getComputedStyle(document.documentElement), cur = k => (th[k] || css.getPropertyValue(THEME[k]).trim() || '#000000');
    const local = d => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
    box.innerHTML = `<form class="lke-form"><fieldset><legend>Floating buttons</legend><div class="hub-row"><label>Help button<select name="help"><option value="left">Bottom left</option><option value="right" ${fab.help === 'right' ? 'selected' : ''}>Bottom right</option></select></label>
        <label>Back to top<select name="top"><option value="right">Bottom right</option><option value="left" ${fab.top === 'left' ? 'selected' : ''}>Bottom left</option><option value="off" ${fab.top === 'off' ? 'selected' : ''}>Not shown</option></select></label></div><p class="lke-small">On the same side, back to top sits above Help.</p></fieldset>
      <fieldset><legend>Announcement bar</legend><label class="lke-check"><input type="checkbox" name="on" ${b.on ? 'checked' : ''}> Show it at the top of every page</label><label>Message<input name="text" maxlength="240" value="${esc(b.text || '')}"></label>
        <div class="hub-row"><label>Link words<input name="label" maxlength="40" value="${esc(b.label || '')}"></label><label>Link to<input name="link" value="${esc(b.link || '')}"></label></div>
        <div class="hub-row"><label>Colour<select name="tone">${['gold', 'sky', 'ember', 'rose', 'mint'].map(t => `<option ${b.tone === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>From <small>(optional)</small><input type="datetime-local" name="from" value="${esc(local(b.from))}"></label><label>Until <small>(optional)</small><input type="datetime-local" name="until" value="${esc(local(b.until))}"></label></div></fieldset>
      <fieldset><legend>Colours</legend><div class="lke-colors">${Object.keys(THEME).map(k => `<label><input type="color" name="c_${k}" value="${esc(cur(k))}" data-set="${th[k] ? 1 : 0}"> ${k}</label>`).join('')}</div><button type="button" class="btn btn-ghost btn-sm" data-reset-colors>Back to the designed colours</button></fieldset>
      <fieldset><legend>Extra links</legend><p class="lke-small">One per line: words | address | menu, more or footer</p><textarea name="nav" rows="4">${esc((s.nav || []).map(l => `${l.label} | ${l.href} | ${l.where || 'menu'}`).join('\n'))}</textarea></fieldset>
      <button class="btn btn-primary btn-sm" type="submit">Review and save</button></form>`;
    const f = box.querySelector('form');
    for (const i of f.querySelectorAll('input[type=color]')) i.oninput = () => { i.dataset.set = '1'; document.documentElement.style.setProperty(THEME[i.name.slice(2)], i.value); };
    f.querySelector('[data-reset-colors]').onclick = () => { for (const i of f.querySelectorAll('input[type=color]')) { i.dataset.set = '0'; document.documentElement.style.removeProperty(THEME[i.name.slice(2)]); } };
    f.onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)), theme = {};
      for (const i of f.querySelectorAll('input[type=color]')) if (i.dataset.set === '1') theme[i.name.slice(2)] = i.value;
      const nav = String(d.nav || '').split('\n').map(l => l.split('|').map(x => x.trim())).filter(x => x[0] && safeUrl(x[1])).map(([label, href, where]) => ({ label: label.slice(0, 40), href: safeUrl(href), where: /^(more|footer)$/.test(where) ? where : 'menu' }));
      const value = { fab: { help: d.help, top: d.top }, bar: { on: !!d.on, text: clean(d.text), label: d.label, link: safeUrl(d.link), tone: d.tone, from: d.from ? new Date(d.from).toISOString() : null, until: d.until ? new Date(d.until).toISOString() : null }, theme, nav };
      const changes = []; const was = settings || {};
      if (JSON.stringify(was.fab) !== JSON.stringify(value.fab)) changes.push(`Help button: ${value.fab.help}, back to top: ${value.fab.top}`);
      if (JSON.stringify(was.bar || {}) !== JSON.stringify(value.bar)) changes.push(value.bar.on ? 'Announcement bar: ' + norm(value.bar.text.replace(/<[^>]+>/g, '')) : 'Announcement bar: off');
      if (JSON.stringify(was.theme || {}) !== JSON.stringify(theme)) changes.push(Object.keys(theme).length ? 'Colours: ' + Object.entries(theme).map(([k, v]) => k + ' ' + v).join(', ') : 'Colours: as designed');
      if (JSON.stringify(was.nav || []) !== JSON.stringify(nav)) changes.push('Extra links: ' + (nav.map(n => n.label).join(', ') || 'none'));
      if (!changes.length) { err(box, 'Nothing changed.'); return; }
      if (!confirm('Save for every page and every visitor?\n\n' + changes.join('\n'))) return;
      const { error } = await sb.from('site_edits').upsert({ page: '*', key: 'settings', lang: '', kind: 'settings', value }); if (error) return err(box, error);
      await load(); if (done) done(); else { const t = document.createElement('p'); t.className = 'lke-toast'; t.textContent = 'Saved for every page.'; document.body.append(t); setTimeout(() => t.remove(), 2600); } };
  }
  window.LKSiteEdit.settingsForm = settingsForm;
})();
