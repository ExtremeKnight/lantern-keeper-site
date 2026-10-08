/* The support helper on every page (0.30.1): answers from the FAQ only (no AI, nothing sent anywhere but our own server
   to read the questions). It never shows anything private unless you are signed in on this website, and then only your
   own orders and Club status (the server only returns your own). When it can't help, it hands you to a person: a
   support ticket (signed in) or email. Questions are matched by words and keywords the team sets in the dashboard. */
(function () {
  'use strict';
  if (window.LKBot || /admin\.html$/.test(location.pathname)) return; window.LKBot = true;
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor' };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests: the local server)
  const t = s => (window.LKI18N && window.LKI18N.t(s)) || s;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const token = () => { try { const s = JSON.parse(localStorage.getItem('lk-site-auth') || 'null'); return s && s.access_token && s.expires_at * 1000 > Date.now() ? s.access_token : null; } catch (e) { return null; } };
  const rest = (path, tok) => fetch(`${CFG.url}/rest/v1/${path}`, { headers: { apikey: CFG.key, Authorization: 'Bearer ' + (tok || CFG.key) } }).then(r => r.ok ? r.json() : []);
  const STOP = new Set('a an the i my me is are was do does did to of in on for it and or how what why when can could would should with be at this that i\'m im not no you your we our please help'.split(' '));
  const words = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9À-￿' ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  let faq = null;
  const lang = () => (document.documentElement.lang || 'en').slice(0, 5);
  async function load() {
    if (faq) return faq;
    const l = lang(), all = await rest('faq?select=id,category,question,answer,keywords,link,lang,sort&published=eq.true&order=sort').catch(() => []);
    const mine = all.filter(q => q.lang === l); faq = mine.length ? mine.concat(all.filter(q => q.lang === 'en' && !mine.some(m => m.sort === q.sort))) : all.filter(q => q.lang === 'en');
    return faq;
  }
  function match(q) {
    const ws = words(q), raw = ' ' + q.toLowerCase() + ' ';
    return faq.map(f => { let s = 0; const qw = words(f.question), aw = new Set(words(f.answer));
      for (const k of f.keywords || []) { if (raw.includes(k.toLowerCase())) s += k.includes(' ') ? 4 : 3; else if (ws.some(w => w.length > 3 && k.startsWith(w))) s += 1; }
      for (const w of ws) { if (qw.includes(w)) s += 1.5; else if (qw.some(x => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x)))) s += .8; if (aw.has(w)) s += .3; }
      return [s, f]; }).filter(x => x[0] >= 2).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  }
  // ---------- the panel ----------
  const css = document.createElement('style');
  css.textContent = `.lkb-btn{position:fixed;left:18px;bottom:18px;z-index:70;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;border:1px solid rgba(255,207,102,.5);background:#121a3a;color:#ffcf66;font:700 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .lkb-btn:hover{background:#18224a}.lkb-btn svg{width:20px;height:20px}
  .lkb{position:fixed;left:18px;bottom:78px;z-index:71;padding:0;margin:0;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 110px));display:flex;flex-direction:column;background:#0d1430;border:1px solid #34407a;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.55);overflow:hidden;font:15px/1.5 system-ui,sans-serif;color:#e8eaf6}
  .lkb[hidden]{display:none}.lkb-top{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#121a3a;border-bottom:1px solid #26305a}.lkb-top b{flex:1}.lkb-top small{display:block;color:#8a91b8;font-weight:400}
  .lkb-x{border:0;background:none;color:#b3b9d8;font-size:22px;cursor:pointer;padding:0 4px}.lkb-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  .lkb-m{max-width:88%;padding:10px 12px;border-radius:14px;background:#18224a;align-self:flex-start;white-space:pre-line}.lkb-m.me{align-self:flex-end;background:#ffcf66;color:#1d1405}
  .lkb-m a{color:#ffcf66}.lkb-m b.q{display:block;margin-bottom:4px;color:#fff}.lkb-chips{display:flex;flex-wrap:wrap;gap:6px}.lkb-chip{border:1px solid #34407a;background:none;color:#e8eaf6;border-radius:999px;padding:6px 10px;font:13px system-ui,sans-serif;cursor:pointer}.lkb-chip:hover{border-color:#ffcf66;color:#ffcf66}
  .lkb-in{display:flex;gap:8px;padding:10px;border-top:1px solid #26305a}.lkb-in input{flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:1px solid #34407a;background:#0a0f24;color:#e8eaf6;font:inherit}.lkb-in button{border:0;border-radius:12px;padding:0 14px;background:#ffcf66;color:#1d1405;font-weight:700;cursor:pointer}
  .lkb-note{padding:0 14px 10px;color:#8a91b8;font-size:12px}@media (max-width:520px){.lkb{right:8px;left:8px;width:auto;bottom:72px}.lkb-btn{left:12px;bottom:12px}}`;
  document.head.append(css);
  const btn = document.createElement('button'); btn.className = 'lkb-btn'; btn.type = 'button'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'lkbPanel');
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v3M8 5h8l-1 3H9zM7 8h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M12 12v4"/></svg>${t('Help')}`;
  const box = document.createElement('section'); box.className = 'lkb'; box.id = 'lkbPanel'; box.hidden = true; box.setAttribute('aria-label', t('Lantern Keeper help'));
  box.innerHTML = `<div class="lkb-top"><img src="assets/img/icon-64.png" width="28" height="28" alt="" style="border-radius:7px"><b>${t('Lantern Keeper help')}<small>${t('Answers from our FAQ. A person can take over any time.')}</small></b><button class="lkb-x" type="button" aria-label="${t('Close')}">×</button></div>
    <div class="lkb-log" role="log" aria-live="polite"></div><form class="lkb-in"><input name="q" maxlength="200" autocomplete="off" placeholder="${t('Ask a question')}" aria-label="${t('Ask a question')}"><button type="submit">${t('Ask')}</button></form>
    <p class="lkb-note">${t('Never share your password: we will never ask for it.')}</p>`;
  document.body.append(btn, box);
  const log = box.querySelector('.lkb-log');
  const say = (html, me) => { const m = document.createElement('div'); m.className = 'lkb-m' + (me ? ' me' : ''); m.innerHTML = html; log.append(m); log.scrollTop = log.scrollHeight; return m; };
  const chips = list => { const d = document.createElement('div'); d.className = 'lkb-chips'; for (const [label, fn] of list) { const b = document.createElement('button'); b.type = 'button'; b.className = 'lkb-chip'; b.textContent = label; b.onclick = fn; d.append(b); } log.append(d); log.scrollTop = log.scrollHeight; };
  const TOPICS = [['payment', 'Payments'], ['subscription', 'Supporter Club'], ['account', 'My account'], ['login', 'Signing in'], ['game', 'The game'], ['troubleshooting', 'Problems']];
  function person(cat) {
    const signed = !!token();
    say(signed ? `${t('A person from support can help. Open a ticket: you get the answer there and by email.')}\n<a href="community.html#/tickets/new${cat ? '?cat=' + encodeURIComponent(cat) : ''}">${t('Open a support ticket')}</a>`
      : `${t('A person from support can help.')}\n<a href="account.html?next=community.html">${t('Sign in')}</a> ${t('and open a ticket, or write to')} <a href="mailto:l4nternkeeper@gmail.com">l4nternkeeper@gmail.com</a>.`);
  }
  function answer(f) {
    say(`<b class="q">${esc(f.question)}</b>${esc(f.answer)}${f.link ? `\n<a href="${esc(f.link)}">${t('More about this')}</a>` : ''}`);
    chips([[t('That helped'), () => { say(t('Glad to help. Keep the light burning!')); }], [t('Talk to a person'), () => person(f.category)], ...(f.category === 'payment' || f.category === 'subscription' ? [[t('My orders'), mine]] : [])]);
  }
  async function ask(q) {
    say(esc(q), true); await load();
    if (/\b(person|human|agent|someone|staff|support team)\b/i.test(q)) return person();
    if (/\b(my (orders?|payments?|purchases?|subscription|club))\b/i.test(q)) return mine();
    const found = match(q);
    if (!found.length) { say(t('I am not sure about that one.')); chips([...TOPICS.map(([c, l]) => [t(l), () => topic(c)]), [t('Talk to a person'), () => person()]]); return; }
    answer(found[0]);
    if (found.length > 1) chips(found.slice(1, 4).map(f => [f.question, () => { say(esc(f.question), true); answer(f); }]));
  }
  async function topic(c) { await load(); const list = faq.filter(f => f.category === c); say(t('Here is what people often ask:')); chips(list.slice(0, 6).map(f => [f.question, () => { say(esc(f.question), true); answer(f); }])); }
  // your own orders and Club status (signed in only; the server returns only yours)
  async function mine() {
    const tok = token(); if (!tok) { say(`${t('To see your orders, sign in first.')} <a href="account.html?next=store.html">${t('Sign in')}</a>`); return; }
    const [orders, club] = await Promise.all([rest('store_orders?select=sku,status,amount_cents,currency,method,created_at,reference&order=created_at.desc&limit=3', tok), rest('club_members?select=until,status,paypal_sub', tok)]);
    const ST = { created: t('Waiting for payment'), review: t('Pending: being checked'), paid: t('Completed'), rejected: t('Not confirmed'), refunded: t('Refunded'), cancelled: t('Cancelled'), expired: t('Not completed: nothing was charged') };
    const c = club[0], d = x => new Date(x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    say((orders.length ? t('Your latest orders:') + '\n' + orders.map(o => `• ${esc(o.sku.replace(/^lk\./, ''))}: ${window.LKI18N ? LKI18N.money(o.amount_cents, o.currency) : (o.amount_cents / 100).toFixed(2) + ' ' + o.currency} ${esc(({ paypal: 'PayPal', gcash: 'GCash', bank: t('bank transfer'), grant: t('gift') })[o.method] || o.method)}, ${esc(ST[o.status] || o.status)} (${d(o.created_at)})${o.reference ? ', ref ' + esc(o.reference) : ''}`).join('\n') : t('You have no web store orders yet.'))
      + (c ? `\n\n${t('Supporter Club')}: ${Date.parse(c.until) < Date.now() ? t('ended') + ' ' + d(c.until) : c.paypal_sub && c.status === 'active' ? t('renews on') + ' ' + d(c.until) : t('active until') + ' ' + d(c.until)}` : '') + `\n<a href="account.html">${t('Your account')}</a>`);
    chips([[t('Talk to a person'), () => person('payment')]]);
  }
  let started = false;
  function open(on) {
    box.hidden = !on; btn.setAttribute('aria-expanded', String(on));
    if (on && !started) { started = true; say(t('Hi! I can answer common questions about Lantern Keeper, your purchases and the Supporter Club. What do you need?')); chips(TOPICS.map(([c, l]) => [t(l), () => topic(c)]).concat(token() ? [[t('My orders'), mine]] : [])); load(); }
    if (on) box.querySelector('input').focus();
  }
  btn.onclick = () => open(box.hidden);
  box.querySelector('.lkb-x').onclick = () => { open(false); btn.focus(); };
  box.addEventListener('keydown', e => { if (e.key === 'Escape') { open(false); btn.focus(); } });
  box.querySelector('form').onsubmit = e => { e.preventDefault(); const i = e.target.q, q = i.value.trim(); if (q.length < 2) return; i.value = ''; ask(q); };
  window.LKBotOpen = () => open(true); // (tests, and "Ask the helper" links)
})();
