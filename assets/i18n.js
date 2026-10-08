/* The website in your language (0.30.1). Texts are translated by their English original: assets/i18n/<lang>.json holds
   "English": "translation" for each block of text (a paragraph, heading, list item, button...; inline links and bold
   kept), and for placeholders, labels and titles. The team can change or add translations in the dashboard (the
   translations table), which win over the files. What players write (posts, chat, names) is never translated, and the
   legal pages stay in English (the English version is the one that counts). Pages drawn by scripts (the store, your
   account, the community, the helper) are translated as they appear. The choice is kept in this browser. */
(function () {
  'use strict';
  const LANGS = [['en', 'English'], ['fil', 'Filipino'], ['es', 'Español'], ['pt-BR', 'Português (Brasil)'], ['id', 'Bahasa Indonesia'], ['ja', '日本語'], ['ko', '한국어'], ['zh-CN', '简体中文']]; // (more languages are added by translating assets/i18n/en.json: tools/i18n-merge.js)
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor' };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests)
  const LEGAL = /(terms|privacy-policy)\.html$/.test(location.pathname), COLLECT = !!window.LK_I18N_COLLECT;
  const SKIP = '[translate="no"], script, style, code, pre, textarea, select option[data-raw], .lkc-text, .hub-body, .hub-post-link, .hub-full > h2, .lkc-quote, .lkc-mini b, .lkc-mini span, .lkc-row > span, .hub-who, .lkc-me b, .lkc-person, .lkc-note b, .hub-me h2, .lkb-m, .lkb-chip, .adm, .brand, .hub-qr, .lkc-top b';
  const INLINE = new Set(['A', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'SPAN', 'BR', 'CODE', 'KBD', 'SUP', 'SUB', 'ABBR', 'IMG', 'SVG', 'USE', 'TIME', 'MARK', 'S', 'U']);
  const BLOCKY = 'h1,h2,h3,h4,h5,p,li,dt,dd,th,td,summary,label,button,a,small,figcaption,legend,option,blockquote,span,b,strong,.kicker';
  const pick = () => { let s = null; try { s = localStorage.getItem('lk-lang'); } catch (e) { /* private mode */ }
    if (s && LANGS.some(l => l[0] === s)) return s;
    for (const n of navigator.languages || [navigator.language || 'en']) { const x = String(n); const hit = LANGS.find(l => l[0].toLowerCase() === x.toLowerCase()) || LANGS.find(l => l[0].split('-')[0] === x.split('-')[0].toLowerCase()) || (/^(tl|fil)/i.test(x) ? ['fil'] : null); if (hit) return hit[0]; }
    return 'en'; };
  const lang = COLLECT ? 'en' : pick();
  let dict = {}, ver = 1;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const hasWords = s => /[A-Za-zÀ-￿]{2,}/.test(s);
  const t = s => (s && dict[norm(s)]) || s;
  const collected = new Set();
  function clean(html) { // only the inline tags, no scripts or event attributes (translations from the dashboard pass here too)
    const tpl = document.createElement('template'); tpl.innerHTML = html;
    for (const el of [...tpl.content.querySelectorAll('*')]) {
      if (!INLINE.has(el.tagName.toUpperCase())) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    }
    return tpl.innerHTML;
  }
  const leaf = el => [...el.children].every(c => INLINE.has(c.tagName.toUpperCase()) && leaf(c));
  function attrs(el) {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (!v || !hasWords(v)) continue;
      const src = el['__lk_' + a] || (el['__lk_' + a] = v); if (COLLECT) collected.add(norm(src)); else if (dict[norm(src)]) el.setAttribute(a, dict[norm(src)]); }
  }
  function walk(root) {
    if (!root || root.nodeType !== 1 || LEGAL && !root.closest('.site-head, .site-foot, .lkb, .lkb-btn')) { if (root && root.nodeType === 1 && LEGAL) for (const x of root.querySelectorAll('.site-head, .site-foot, .lkb, .lkb-btn')) walk(x); return; }
    if (root.closest(SKIP)) return;
    attrs(root); for (const el of root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')) if (!el.closest(SKIP)) attrs(el);
    const visit = el => {
      if (el.nodeType !== 1 || el.matches(SKIP)) return;
      if (el.matches(BLOCKY) && leaf(el)) {
        const src = el.__lkSrc != null ? el.__lkSrc : el.innerHTML, key = norm(src);
        if (!hasWords(key.replace(/<[^>]+>/g, ''))) return;
        if (COLLECT) { collected.add(key); return; }
        if (el.__lkV === ver) return; el.__lkSrc = src; el.__lkV = ver;
        const tr = dict[key]; if (tr && tr !== key) el.innerHTML = clean(tr); else if (el.innerHTML !== src) el.innerHTML = src;
        return;
      }
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3) { const src = n.__lkSrc != null ? n.__lkSrc : n.nodeValue, key = norm(src); if (!hasWords(key) || el.matches('script,style')) continue;
          if (COLLECT) { collected.add(key); continue; } n.__lkSrc = src; const tr = dict[key]; if (tr) n.nodeValue = src.replace(key, tr); }
        else visit(n);
      }
    };
    visit(root);
  }
  // the picker, in the footer and the menu
  function picker() {
    const SHORT = { en: 'EN', fil: 'FIL', es: 'ES', 'pt-BR': 'PT', id: 'ID', ja: '日本', ko: '한국', 'zh-CN': '中文', fr: 'FR', de: 'DE', vi: 'VI', th: 'ไทย' };
    const make = short => { const s = document.createElement('select'); s.className = 'lang-pick'; s.setAttribute('aria-label', 'Language'); s.setAttribute('translate', 'no');
      s.innerHTML = LANGS.map(([c, n]) => `<option value="${c}" ${c === lang ? 'selected' : ''}${short ? ` title="${n}"` : ''}>${short ? SHORT[c] || c : n}</option>`).join('');
      s.onchange = () => { try { localStorage.setItem('lk-lang', s.value); } catch (e) { /* this visit */ } location.reload(); }; return s; };
    const foot = document.querySelector('.site-foot .foot-bottom') || document.querySelector('.site-foot'); if (foot) { const w = document.createElement('label'); w.className = 'lang-wrap'; w.setAttribute('translate', 'no'); w.innerHTML = '<span aria-hidden="true">🌐</span>'; w.append(make()); foot.append(w); }
    const nav = document.querySelector('.site-head .nav'); if (nav) { const w = document.createElement('div'); w.className = 'lang-wrap lang-head'; w.setAttribute('translate', 'no'); w.append(make(true)); nav.append(w); }
  }
  async function start() {
    document.documentElement.lang = lang;
    if (lang !== 'en') {
      // the shipped file first; the team's changes (dashboard) when they arrive, then the page is translated again
      const over = fetch(`${CFG.url}/rest/v1/translations?select=key,value&lang=eq.${encodeURIComponent(lang)}`, { headers: { apikey: CFG.key } }).then(r => r.ok ? r.json() : [], () => []);
      const file = await fetch(`assets/i18n/${lang}.json`).then(r => r.ok ? r.json() : {}, () => ({}));
      dict = {}; for (const [k, v] of Object.entries(file)) dict[norm(k)] = v;
      over.then(list => { if (!list.length) return; for (const o of list) dict[norm(o.key)] = o.value; ver++; walk(document.body); });
    }
    if (!COLLECT) picker();
    if (LEGAL && lang !== 'en') { const n = document.createElement('p'); n.className = 'legal-note'; n.textContent = t('This page is in English: the English version is the one that counts.'); const m = document.querySelector('main, .page'); if (m) m.prepend(n); }
    walk(document.body);
    // what scripts add later (the store, the account, the community, the helper)
    let queued = new Set(), timer = 0;
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) queued.add(n); else if (n.nodeType === 3 && n.parentElement) queued.add(n.parentElement);
      if (!timer) timer = requestAnimationFrame(() => { timer = 0; const list = [...queued]; queued = new Set(); for (const n of list) if (n.isConnected) walk(n); }); }).observe(document.body, { childList: true, subtree: true });
  }
  window.LKI18N = { t, lang: () => lang, LANGS, collect: () => (walk(document.body), [...collected]) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
