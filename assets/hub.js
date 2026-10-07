/* Lantern Keeper on the website (0.30): the store, your account and the community, signed in with the same account as
   the game. Everything is checked by the server (Supabase): purchases are given only after PayPal or a developer
   confirms the payment, posts are written through the community function (filtered, rate-limited). This page keeps
   only the sign-in (in this browser's storage) and draws what the server returns; nothing here is trusted by the server.
   The human check (hCaptcha) loads only when a sign-in, sign-up or password form is opened. */
(function () {
  'use strict';
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor', captcha: '40488912-dbd0-40ca-9726-be9e3f983e42' }; // (public by design: the same as the game ships)
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
  if (LOCAL && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests: the local server)
  const root = document.getElementById('hub'); if (!root || !window.supabase) return;
  const PAGE = root.dataset.page;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, storageKey: 'lk-site-auth', detectSessionInUrl: false } });
  window.LKHUB = { sb, CFG }; // (tests)
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const day = d => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const ago = d => { const m = (Date.now() - Date.parse(d)) / 6e4; return m < 1 ? 'just now' : m < 60 ? Math.floor(m) + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : day(d); };
  const ROLE = { owner: 'Owner', developer: 'Developer', moderator: 'Moderator', contributor: 'Contributor', subscriber: 'Club', supporter: 'Supporter', veteran: 'Veteran', player: 'Player' };
  const roleChips = roles => (roles || []).filter(r => r !== 'player').map(r => `<span class="role role-${r}">${ROLE[r] || esc(r)}</span>`).join('');
  let me = null, myRoles = [], myProfile = null;

  async function call(fn, body) {
    const { data: s } = await sb.auth.getSession(), t = s && s.session && s.session.access_token;
    const r = await fetch(`${CFG.url}/functions/v1/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || 'Something went wrong (' + r.status + '). Try again.'); return b;
  }
  async function loadMe() {
    const { data } = await sb.auth.getUser(); me = data && data.user || null; myRoles = []; myProfile = null;
    if (me) { const [r, p] = await Promise.all([sb.rpc('roles_of', { p_user: me.id }), sb.from('profiles').select('*').eq('id', me.id).maybeSingle()]); myRoles = r.data || ['player']; myProfile = p.data; }
  }
  const isStaff = () => myRoles.some(r => ['owner', 'developer', 'moderator'].includes(r));
  const isTeam = () => myRoles.some(r => ['owner', 'developer'].includes(r));
  function modal(html, onReady) {
    const back = h(`<div class="hub-modal" role="dialog" aria-modal="true"><div class="hub-dlg">${html}<button class="hub-x" type="button" aria-label="Close">×</button></div></div>`);
    const close = () => { back.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('.hub-x')) close(); }); document.addEventListener('keydown', key);
    document.body.append(back); const f = back.querySelector('input, select, textarea, button.btn'); if (f) f.focus(); if (onReady) onReady(back.querySelector('.hub-dlg'), close); return close;
  }
  const say = (box, msg, ok) => { const p = box.querySelector('.hub-msg') || box.appendChild(h('<p class="hub-msg" role="status"></p>')); p.textContent = msg; p.classList.toggle('ok', !!ok); };

  // ---------- the human check, loaded only when needed ----------
  let capReady = null;
  function captcha(box) {
    if (!CFG.captcha) return Promise.resolve(() => undefined);
    capReady = capReady || new Promise(res => { window.lkCaptchaReady = res; const s = document.createElement('script'); s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=lkCaptchaReady'; s.async = true; document.head.append(s); });
    return capReady.then(() => { const id = window.hcaptcha.render(box, { sitekey: CFG.captcha, theme: 'dark' }); return () => { const t = window.hcaptcha.getResponse(id); window.hcaptcha.reset(id); return t; }; });
  }

  // ---------- sign in, create an account, reset a password ----------
  const AGE_MIN = 13, PARENT_UNDER = 16, TERMS = '1.6';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function authPanel(box, done, tab = 'in') {
    const y = new Date().getFullYear();
    box.innerHTML = `<div class="hub-auth card"><div class="hub-tabs" role="tablist"><button role="tab" data-t="in" aria-selected="${tab === 'in'}">Sign in</button><button role="tab" data-t="up" aria-selected="${tab === 'up'}">Create an account</button></div>
      <form class="hub-form" novalidate>${tab === 'in' ? `
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="pw" type="password" autocomplete="current-password" required></label>` : tab === 'up' ? `
        <label>Keeper name<input name="name" maxlength="16" autocomplete="nickname" required></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password <small>(8 or more, with upper and lower case, a number and a symbol)</small><input name="pw" type="password" autocomplete="new-password" required></label>
        <div class="hub-row"><label>Born in<select name="bm"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
          <label>&nbsp;<select name="by"><option value="">Year</option>${Array.from({ length: 100 }, (_, i) => y - i).map(v => `<option>${v}</option>`).join('')}</select></label></div>
        <label class="hub-check"><input type="checkbox" name="parent"> I am 13 to 15 and a parent or guardian agrees</label>
        <label class="hub-check"><input type="checkbox" name="terms"> I agree to the <a href="terms.html" target="_blank">Terms of Service</a> and have read the <a href="privacy-policy.html" target="_blank">Privacy Policy</a></label>
        <label class="hub-check"><input type="checkbox" name="news"> Send me patch notes and updates (you can stop them any time)</label>` : `
        <label>Email<input name="email" type="email" autocomplete="email" required></label>`}
        <div class="hub-cap"></div>
        <button class="btn btn-primary" type="submit">${tab === 'in' ? 'Sign in' : tab === 'up' ? 'Create my account' : 'Send me a code'}</button>
        ${tab === 'in' ? '<button class="hub-link" type="button" data-t="reset">Forgot your password?</button>' : ''}
      </form><p class="muted small">The same account as in the game: your progress, looks and purchases are shared.</p></div>`;
    for (const b of box.querySelectorAll('[data-t]')) b.onclick = () => authPanel(box, done, b.dataset.t);
    const form = box.querySelector('form'); let token = () => undefined;
    captcha(box.querySelector('.hub-cap')).then(t => { token = t; }, () => { /* no check: the server will say */ });
    form.onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form)); const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        if (tab === 'in') { const { error } = await sb.auth.signInWithPassword({ email: v.email.trim(), password: v.pw, options: { captchaToken: token() } }); if (error) throw error; await loadMe(); done(); return; }
        if (tab === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(v.email.trim(), { captchaToken: token() }); if (error) throw error; codeStep(box, v.email.trim(), 'recovery', done); return; }
        const name = String(v.name || '').trim(); if (!/^[A-Za-z0-9 _.'-]{3,16}$/.test(name)) throw new Error('Choose a keeper name of 3 to 16 letters or numbers.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || '')) throw new Error('That doesn\'t look like an email address.');
        if (!(v.pw.length >= 8 && /[a-z]/.test(v.pw) && /[A-Z]/.test(v.pw) && /\d/.test(v.pw) && /[^A-Za-z0-9]/.test(v.pw))) throw new Error('The password needs all four: 8 or more characters, upper and lower case, a number and a symbol.');
        if (!v.bm || !v.by) throw new Error('Choose the month and year you were born.');
        const now = new Date(), age = now.getFullYear() - +v.by - (now.getMonth() + 1 < +v.bm ? 1 : 0); // (only the answer is sent, never the birth date)
        if (age < AGE_MIN) throw new Error('Accounts are for players aged 13 or over. You can play as a guest in the game.');
        const teen = age < PARENT_UNDER; if (teen && !v.parent) throw new Error('Players aged 13 to 15 need a parent or guardian to agree: tick the box when they do.');
        if (!v.terms) throw new Error('Please agree to the Terms of Service to make an account.');
        const unsub = Array.from(crypto.getRandomValues(new Uint8Array(18)), x => x.toString(16).padStart(2, '0')).join('');
        const { error } = await sb.auth.signUp({ email: v.email.trim(), password: v.pw, options: { captchaToken: token(), data: { display_name: name, age_ok: true, teen, parent_ok: teen, adult: age >= 18, terms: TERMS, news: !!v.news, unsub } } });
        if (error) throw error; codeStep(box, v.email.trim(), 'signup', done);
      } catch (err) { say(form, err.message || String(err)); btn.disabled = false; }
    };
  }
  function codeStep(box, email, type, done) {
    box.innerHTML = `<div class="hub-auth card"><h2>Check your email</h2><p>We sent a 6-digit code to <b>${esc(email)}</b>. It works for one hour.</p>
      <form class="hub-form"><label>Code<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label>
      ${type === 'recovery' ? '<label>New password<input name="pw" type="password" autocomplete="new-password" required></label>' : ''}
      <button class="btn btn-primary" type="submit">${type === 'recovery' ? 'Set my new password' : 'Confirm'}</button></form></div>`;
    const form = box.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form));
      try { const { error } = await sb.auth.verifyOtp({ email, token: String(v.code).trim(), type }); if (error) throw error;
        if (type === 'recovery') { const { error: e2 } = await sb.auth.updateUser({ password: v.pw }); if (e2) throw e2; }
        await loadMe(); done(); } catch (err) { say(form, err.message || String(err)); }
    };
  }
  function needSignIn(box, why, done) { box.innerHTML = `<p class="hub-lead">${esc(why)}</p><div class="hub-authbox"></div>`; authPanel(box.querySelector('.hub-authbox'), done); }

  // ---------- the store ----------
  const store = { products: [], settings: null, club: null, orders: [],
    cur() { try { const c = localStorage.getItem('lk-currency'); if (c === 'PHP' || c === 'USD') return c; } catch (e) { /* none */ } let ph = false; try { ph = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Manila' || /-PH$/i.test(navigator.language); } catch (e) { /* none */ } return ph ? 'PHP' : 'USD'; },
    setCur(c) { try { localStorage.setItem('lk-currency', c); } catch (e) { /* this visit */ } },
    price(p, cur = this.cur()) { const v = (cur === 'PHP' ? p.php_cents : p.usd_cents) / 100; return cur === 'PHP' ? '₱' + v.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : '$' + v.toFixed(2); } };
  async function loadStore() {
    const [p, s, c, o] = await Promise.all([sb.from('store_products').select('*').eq('active', true).order('sort'),
      me ? sb.from('store_settings').select('gcash_name, gcash_number, gcash_qr, bank_details, manual_on').eq('id', 1).maybeSingle() : { data: null },
      me ? sb.from('club_members').select('until, status, paypal_sub, months').eq('user_id', me.id).maybeSingle() : { data: null },
      me ? sb.from('store_orders').select('id, sku, method, currency, amount_cents, status, created_at, reference').order('created_at', { ascending: false }).limit(30) : { data: [] }]);
    store.products = p.data || []; store.settings = s.data; store.club = c.data; store.orders = o.data || [];
  }
  async function renderStore() {
    root.innerHTML = '<p class="muted">Loading the store...</p>';
    await loadStore();
    const cur = store.cur(), member = store.club && Date.parse(store.club.until) > Date.now();
    const offer = p => p.offer && (!p.offer_ends || Date.parse(p.offer_ends) > Date.now()) ? `<span class="hub-offer">${esc(p.offer)}${p.offer_ends ? ' · until ' + day(p.offer_ends) : ''}</span>` : '';
    const card = p => `<article class="card hub-prod kind-${p.kind}">${offer(p)}<h3>${esc(p.label)}</h3>${p.kind === 'lumens' ? `<p class="hub-lum">${Number(p.lumens).toLocaleString()} Lumens</p>` : `<p>${esc(p.blurb)}</p>`}
      <button class="btn btn-primary" data-buy="${esc(p.sku)}">${p.kind === 'club' ? 'One month · ' : ''}${store.price(p, cur)}</button></article>`;
    const club = store.products.find(p => p.kind === 'club');
    root.innerHTML = `
      <div class="hub-bar"><div>${me ? `Signed in as <b>${esc(myProfile && myProfile.display_name || me.email)}</b> ${roleChips(myRoles)} · <a href="account.html">Your account</a>` : '<a href="account.html?next=store.html" class="btn btn-ghost btn-sm">Sign in to buy</a>'}</div>
        <div class="hub-cur" role="group" aria-label="Currency"><button data-cur="PHP" aria-pressed="${cur === 'PHP'}">₱ Pesos</button><button data-cur="USD" aria-pressed="${cur === 'USD'}">$ US dollars</button></div></div>
      ${club ? `<section class="hub-club card"><div><span class="kicker">Supporter Club</span><h2>Keep the light on, every month</h2>
        <ul class="hub-perks"><li>A new lantern each month, yours to keep</li><li>The Club frame, badge and Club Keeper title</li><li>The Club role and the Supporter Lounge in the community</li><li>Early looks, behind-the-scenes posts and polls</li><li>Your name in the credits</li></ul>
        ${member ? `<p class="hub-ok">You are in the Club until ${day(store.club.until)}${store.club.paypal_sub && store.club.status === 'active' ? ' (renews each month)' : ''}. Thank you!</p>` : ''}</div>
        <div class="hub-club-buy"><p class="hub-price">${store.price(club, cur)}<small> / month</small></p>
        ${store.club && store.club.paypal_sub && store.club.status === 'active' && member ? '<button class="btn btn-ghost" data-club-stop>Stop the monthly payment</button>' : '<button class="btn btn-primary" data-club>Join monthly with PayPal</button>'}
        ${store.settings && store.settings.manual_on ? `<button class="btn btn-ghost" data-buy="${esc(club.sku)}">One month by GCash</button>` : ''}
        <p class="muted small">Recognition and looks only: never an advantage. Stop any time.</p></div></section>` : ''}
      <h2 class="hub-h">Supporter packs</h2><div class="cards hub-grid">${store.products.filter(p => p.kind === 'pack').map(card).join('')}</div>
      <h2 class="hub-h">Lumens</h2><p class="muted">Lumens buy looks in the game's shop. They never buy strength.</p><div class="cards hub-grid hub-grid-4">${store.products.filter(p => p.kind === 'lumens').map(card).join('')}</div>
      ${me && store.orders.length ? `<h2 class="hub-h">Your orders</h2><div class="hub-orders">${store.orders.map(orderRow).join('')}</div>` : ''}
      <p class="muted small">Sold by Shan Patrick V. Cruz (Exenova). Pay with PayPal (a PayPal account or a card) or GCash and bank transfer. Everything goes to your account, in the game on every device. Refunds within 14 days: see the <a href="terms.html#4a-refunds">Terms</a>. If you are under 18, ask a parent before buying.</p>`;
    for (const b of root.querySelectorAll('[data-cur]')) b.onclick = () => { store.setCur(b.dataset.cur); renderStore(); };
    for (const b of root.querySelectorAll('[data-buy]')) b.onclick = () => buy(store.products.find(p => p.sku === b.dataset.buy));
    const j = root.querySelector('[data-club]'); if (j) j.onclick = () => joinClub();
    const st = root.querySelector('[data-club-stop]'); if (st) st.onclick = () => modal(`<h2>Stop the monthly payment?</h2><p>Your membership stays until ${day(store.club.until)}; the lanterns you received stay yours.</p><div class="hub-actions"><button class="btn btn-primary" data-ok>Stop it</button></div>`, (d, close) => { d.querySelector('[data-ok]').onclick = async () => { try { await call('store', { action: 'club_cancel' }); close(); renderStore(); } catch (e) { say(d, e.message); } }; });
  }
  const ORDER_STATE = { created: 'Waiting for payment', review: 'Pending: being checked', paid: 'Completed', rejected: 'Not confirmed', refunded: 'Refunded', cancelled: 'Cancelled' };
  const orderRow = o => { const p = store.products.find(x => x.sku === o.sku); return `<div class="hub-order"><span>${esc(p ? p.label : o.sku)}${o.method === 'grant' ? ' · a gift from the team' : ` · ${o.currency === 'PHP' ? '₱' : '$'}${(o.amount_cents / 100).toFixed(2)} · ${o.method === 'paypal' ? 'PayPal' : o.method === 'gcash' ? 'GCash' : 'Bank'}`}${o.reference ? ' · ref ' + esc(o.reference) : ''}</span><span class="state-${o.status}">${ORDER_STATE[o.status] || esc(o.status)} · ${day(o.created_at)}</span></div>`; };
  function buy(p) {
    if (!me) { location.href = 'account.html?next=store.html'; return; }
    const cur = store.cur(), manual = store.settings && store.settings.manual_on;
    modal(`<h2>${esc(p.label)}: ${store.price(p, cur)}</h2><p>${p.kind === 'club' ? 'One month in the Supporter Club (it does not renew by itself).' : p.kind === 'lumens' ? `${Number(p.lumens).toLocaleString()} Lumens for your account.` : esc(p.blurb)}</p>
      <div class="hub-actions">${p.kind !== 'club' ? '<button class="btn btn-primary" data-pp>PayPal or card</button>' : ''}${manual ? `<button class="btn ${p.kind === 'club' ? 'btn-primary' : 'btn-ghost'}" data-gc>GCash or bank transfer${cur === 'PHP' ? '' : ' (pesos)'}</button>` : ''}</div>
      <p class="muted small">Sold by Shan Patrick V. Cruz (Exenova). After paying with PayPal you come back here and it is added in a few seconds.</p>`, (d, close) => {
      const pp = d.querySelector('[data-pp]'); if (pp) pp.onclick = async () => { pp.disabled = true; try { const r = await call('store', { action: 'create', sku: p.sku, currency: cur }); location.href = r.approve; } catch (e) { say(d, e.message); pp.disabled = false; } };
      const gc = d.querySelector('[data-gc]'); if (gc) gc.onclick = () => { close(); gcash(p); };
    });
  }
  async function joinClub() {
    if (!me) { location.href = 'account.html?next=store.html'; return; }
    try { const r = await call('store', { action: 'club', currency: store.cur() }); location.href = r.approve; } catch (e) { modal(`<h2>Not started</h2><p>${esc(e.message)}</p>`); }
  }
  function gcash(p) {
    const s = store.settings || {}, price = store.price(p, 'PHP');
    modal(`<h2>Pay ${price} by GCash or bank</h2>
      <ol class="hub-steps"><li>${s.gcash_qr ? 'Scan the QR code with GCash, or send' : 'Send'} exactly <b>${price}</b>.</li><li>Enter the reference number from your receipt.</li><li>It shows as <b>Pending</b> until we check it, usually within a day. Then it is in your account.</li></ol>
      ${s.gcash_qr ? `<img class="hub-qr" src="${esc(s.gcash_qr)}" alt="GCash QR code to pay ${esc(price)}" width="240" height="240">` : ''}
      ${s.gcash_number ? `<p><b>GCash:</b> ${esc(s.gcash_number)}${s.gcash_name ? ' (' + esc(s.gcash_name) + ')' : ''}</p>` : ''}${s.bank_details ? `<p><b>Bank transfer:</b> ${esc(s.bank_details)}</p>` : ''}
      <form class="hub-form"><label>Paid with<select name="method">${s.gcash_number || s.gcash_qr ? '<option value="gcash">GCash</option>' : ''}${s.bank_details ? '<option value="bank">Bank transfer</option>' : ''}</select></label>
        <label>Reference number<input name="ref" maxlength="64" autocomplete="off" required></label>
        <label>Name on the account you paid from <small>(optional, helps us find it)</small><input name="payer" maxlength="80" autocomplete="name"></label>
        <button class="btn btn-primary" type="submit">Submit payment</button></form>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        try { const r = await call('store', { action: 'manual', sku: p.sku, currency: 'PHP', method: v.method, reference: v.ref, payer: v.payer });
          d.innerHTML = `<h2>Payment submitted</h2><p>${esc(p.label)} · ${price} · ${v.method === 'gcash' ? 'GCash' : 'Bank transfer'} · reference <b>${esc(String(v.ref).trim())}</b></p><p>Status: <b>Pending</b>. We check it against our ${v.method === 'gcash' ? 'GCash' : 'bank'} history, usually within a day; then it is in your account and the game tells you. Order ${esc(String(r.order).slice(0, 8))}.</p><div class="hub-actions"><button class="btn btn-primary" data-done>Done</button></div>`;
          d.querySelector('[data-done]').onclick = () => { close(); renderStore(); };
        } catch (err) { say(f, err.message); } };
    });
  }

  // ---------- your account ----------
  const SKU_NAME = { 'lk.supporter.keeper': 'Supporter Pack', 'lk.supporter.starter': 'Starter Supporter', 'lk.supporter.dedicated': 'Dedicated Supporter', 'lk.supporter.founder': 'Founder', 'lk.club': 'Supporter Club (while a member)' };
  async function renderAccount() {
    if (!me) { needSignIn(root, 'Sign in with your Lantern Keeper account, or make one: it is the same account as in the game.', () => { const n = new URLSearchParams(location.search).get('next'); if (n && /^[a-z-]+\.html$/.test(n)) location.href = n; else renderAccount(); }); return; }
    root.innerHTML = '<p class="muted">Loading your account...</p>';
    const [w, e, c, prefs, o] = await Promise.all([sb.from('wallets').select('lumens').eq('user_id', me.id).maybeSingle(), sb.from('entitlements').select('sku, granted_at, revoked_at').eq('user_id', me.id),
      sb.from('club_members').select('until, status, paypal_sub, months').eq('user_id', me.id).maybeSingle(), sb.from('comm_prefs').select('*').eq('user_id', me.id).maybeSingle(),
      sb.from('store_orders').select('id, sku, method, currency, amount_cents, status, created_at, reference').order('created_at', { ascending: false }).limit(30)]);
    const p = myProfile || {}, ents = (e.data || []).filter(x => !x.revoked_at), sc = p.showcase || {}, md = me.user_metadata || {};
    const packs = ents.filter(x => SKU_NAME[x.sku] && x.sku !== 'lk.club').map(x => SKU_NAME[x.sku]), lanterns = ents.filter(x => /^lk\.club\.\d{4}-\d\d$/.test(x.sku)).length, looks = ents.filter(x => /^lumen:/.test(x.sku)).length;
    const member = c.data && Date.parse(c.data.until) > Date.now(), cp = prefs.data || {};
    store.products = store.products.length ? store.products : ((await sb.from('store_products').select('*')).data || []);
    root.innerHTML = `
      <section class="card hub-me"><div class="hub-me-head"><div class="hub-av" aria-hidden="true">${esc((p.display_name || '?').slice(0, 1))}</div><div>
        <h2>${esc(p.display_name || 'Keeper')}</h2><p>${roleChips(myRoles)} <span class="muted">Joined ${day(p.created_at || me.created_at)} · Friend code ${esc(p.friend_code || '-')}</span></p></div></div>
        <div class="hub-stats">${sc.level ? `<span><b>${esc(sc.level)}</b> level</span>` : ''}${sc.regions != null ? `<span><b>${esc(sc.regions)}</b> regions</span>` : ''}${sc.achievements != null ? `<span><b>${esc(sc.achievements)}</b> achievements</span>` : ''}<span><b>${(w.data && w.data.lumens) || 0}</b> Lumens</span><span><b>${looks + packs.length + lanterns}</b> paid looks and packs</span></div>
        <p><a href="community.html#/k/${me.id}">Your public page</a> · <a href="play/">Play</a> · <button class="hub-link" data-out>Sign out</button></p></section>
      <section class="card"><h2>Profile</h2><form class="hub-form" data-profile>
        <label>About you <small>(shown on your public page, 300 characters)</small><textarea name="bio" maxlength="300" rows="3">${esc(p.bio || '')}</textarea></label>
        <label>Discord name <small>(optional: shown so friends can find you)</small><input name="discord" maxlength="40" value="${esc(p.discord || '')}"></label>
        <label class="hub-check"><input type="checkbox" name="show" ${p.show_profile ? 'checked' : ''}> Show my profile to other keepers (your public page, the community and the leaderboard)</label>
        <button class="btn btn-primary" type="submit">Save</button></form>
        <p class="muted small">Your keeper name, avatar, frame and title are changed in the game (Profile).</p></section>
      <section class="card"><h2>Supporter status</h2>
        ${member ? `<p class="hub-ok">Supporter Club until ${day(c.data.until)}${c.data.paypal_sub && c.data.status === 'active' ? ' (renews each month)' : ''} · ${c.data.months} month${c.data.months === 1 ? '' : 's'} so far</p>` : '<p>Not in the Supporter Club. <a href="store.html">Join it</a>.</p>'}
        ${packs.length ? `<p>Packs: ${packs.map(esc).join(', ')}</p>` : '<p class="muted">No supporter packs yet.</p>'}${lanterns ? `<p>Club lanterns kept: ${lanterns}</p>` : ''}</section>
      <section class="card"><h2>Emails</h2><form class="hub-form" data-mail>
        <label class="hub-check"><input type="checkbox" name="email_updates" ${cp.email_updates ? 'checked' : ''}> Patch notes and updates</label>
        <label class="hub-check"><input type="checkbox" name="email_events" ${cp.email_events ? 'checked' : ''}> Events</label>
        <label class="hub-check"><input type="checkbox" name="email_friends" ${cp.email_friends ? 'checked' : ''}> From friends (at most one a day, only what you missed)</label>
        ${md.adult ? `<label class="hub-check"><input type="checkbox" name="email_promos" ${cp.email_promos ? 'checked' : ''}> Promotions</label>` : ''}
        <button class="btn btn-ghost" type="submit">Save email choices</button></form></section>
      <section class="card"><h2>Purchase history</h2>${(o.data || []).length ? `<div class="hub-orders">${o.data.map(orderRow).join('')}</div>` : '<p class="muted">No web store purchases yet.</p>'}
        <p class="muted small">Purchases made in the Google Play version show in the game (Shop > Supporter).</p></section>`;
    root.querySelector('[data-out]').onclick = async () => { await sb.auth.signOut({ scope: 'local' }); await loadMe(); renderAccount(); };
    const pf = root.querySelector('[data-profile]'); pf.onsubmit = async ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(pf));
      const { error } = await sb.from('profiles').update({ bio: String(v.bio || '').trim().slice(0, 300) || null, discord: String(v.discord || '').trim().slice(0, 40) || null, show_profile: !!v.show }).eq('id', me.id);
      say(pf, error ? 'Not saved: ' + error.message : 'Saved.', !error); if (!error) await loadMe(); };
    const mf = root.querySelector('[data-mail]'); mf.onsubmit = async ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(mf));
      const row = { user_id: me.id, email_updates: !!v.email_updates, email_events: !!v.email_events, email_friends: !!v.email_friends, email_promos: md.adult ? !!v.email_promos : false, updated_at: new Date().toISOString() };
      const { error } = await sb.from('comm_prefs').upsert(row); say(mf, error ? 'Not saved: ' + error.message : 'Saved.', !error); };
  }

  // ---------- the community ----------
  const CATS = [['announcements', 'Announcements', 'team'], ['updates', 'Development updates', 'team'], ['roadmap', 'Roadmap', 'team'], ['devlog', 'Devlogs', 'team'], ['events', 'Events', 'staff'],
    ['general', 'General', ''], ['feedback', 'Feedback', ''], ['bugs', 'Bug reports', ''], ['features', 'Feature requests', ''], ['artwork', 'Artwork', ''], ['screenshots', 'Screenshots', ''], ['lounge', 'Supporter Lounge', 'club']];
  const CAT = Object.fromEntries(CATS.map(c => [c[0], c]));
  const REACT = [['lamp', '🏮'], ['heart', '❤️'], ['laugh', '😄'], ['wow', '😮'], ['thanks', '🙏']];
  const canPostIn = c => { const w = CAT[c][2]; return w === 'team' ? isTeam() : w === 'staff' ? isStaff() : w === 'club' ? isStaff() || myRoles.includes('subscriber') : !!me; };
  const names = new Map();
  async function people(ids) {
    const need = [...new Set(ids)].filter(id => id && !names.has(id)); if (!need.length) return;
    const [{ data }, roles] = await Promise.all([sb.from('profiles').select('id, display_name, show_profile').in('id', need), Promise.all(need.map(id => sb.rpc('roles_of', { p_user: id }).then(r => [id, r.data || []])))]);
    const rm = new Map(roles); for (const id of need) { const p = (data || []).find(x => x.id === id); names.set(id, { name: p && p.show_profile ? p.display_name : 'A keeper', shown: !!(p && p.show_profile), roles: rm.get(id) || [] }); }
  }
  const who = id => { const n = names.get(id) || { name: 'A keeper', roles: [] }; const team = (n.roles || []).filter(r => ['owner', 'developer', 'moderator'].includes(r)); // (a hidden profile shows only staff roles: never whether someone paid)
    return n.shown ? `<a href="#/k/${id}" class="hub-who">${esc(n.name)}</a> ${roleChips(n.roles)}` : `<span class="hub-who">${esc(n.name)}</span> ${roleChips(team)}`; };
  const pubUrl = path => `${CFG.url}/storage/v1/object/public/community/${path}`;
  const textHtml = (t, team) => esc(t).replace(/\n/g, '<br>').replace(team ? /(https:\/\/[^\s<]+)/g : /$^/, '<a href="$1" rel="noopener nofollow" target="_blank">$1</a>');
  function shell(inner, active) {
    root.innerHTML = `<div class="hub-com"><nav class="hub-side" aria-label="Community sections">
        <a href="#/" class="${active === 'all' ? 'on' : ''}">Everything</a>${me ? `<a href="#/following" class="${active === 'following' ? 'on' : ''}">Following</a>` : ''}
        <p class="hub-side-h">From the team</p>${CATS.filter(c => c[2] === 'team' || c[2] === 'staff').map(c => `<a href="#/s/${c[0]}" class="${active === c[0] ? 'on' : ''}">${c[1]}</a>`).join('')}
        <p class="hub-side-h">Keepers</p>${CATS.filter(c => !c[2]).map(c => `<a href="#/s/${c[0]}" class="${active === c[0] ? 'on' : ''}">${c[1]}</a>`).join('')}
        ${me && (myRoles.includes('subscriber') || isStaff()) ? `<a href="#/s/lounge" class="${active === 'lounge' ? 'on' : ''}">Supporter Lounge</a>` : ''}
        ${me ? '<a href="#/new" class="btn btn-primary btn-sm">New post</a>' : '<a href="account.html?next=community.html" class="btn btn-ghost btn-sm">Sign in to post</a>'}
      </nav><div class="hub-main">${inner}</div></div>`;
  }
  async function listPosts(filter, active, title) {
    shell('<p class="muted">Loading...</p>', active);
    let q = sb.from('community_posts').select('id, author, category, title, body, image, pinned, locked, state, replies, reactions, created_at, poll').eq('status', 'visible');
    q = filter(q); const { data, error } = await q.order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(40);
    if (error) { root.querySelector('.hub-main').innerHTML = `<p>Could not load the posts: ${esc(error.message)}</p>`; return; }
    await people((data || []).map(p => p.author));
    root.querySelector('.hub-main').innerHTML = `<h2 class="hub-h">${esc(title)}</h2>${(data || []).length ? data.map(p => `<article class="card hub-post${p.pinned ? ' pinned' : ''}"><a class="hub-post-link" href="#/p/${p.id}">
        <span class="hub-cat">${esc(CAT[p.category][1])}</span>${p.pinned ? '<span class="hub-pin">Pinned</span>' : ''}${p.state ? `<span class="hub-state st-${p.state.replace(/ /g, '-')}">${esc(p.state)}</span>` : ''}${p.poll ? '<span class="hub-pin">Poll</span>' : ''}
        <h3>${esc(p.title)}</h3><p>${esc(p.body.slice(0, 220))}${p.body.length > 220 ? '...' : ''}</p></a>
        ${p.image ? `<img class="hub-thumb" src="${esc(pubUrl(p.image))}" alt="" loading="lazy">` : ''}
        <p class="hub-meta">${who(p.author)} · ${ago(p.created_at)} · ${p.replies} repl${p.replies === 1 ? 'y' : 'ies'} · ${p.reactions} reaction${p.reactions === 1 ? '' : 's'}${p.locked ? ' · closed' : ''}</p></article>`).join('') : '<p class="muted">Nothing here yet.</p>'}`;
  }
  async function showPost(id) {
    shell('<p class="muted">Loading...</p>', '');
    const { data: p } = await sb.from('community_posts').select('*').eq('id', id).maybeSingle();
    const main = root.querySelector('.hub-main'); if (!p) { main.innerHTML = '<p>That post is gone, or it is in the Supporter Lounge.</p>'; return; }
    const [{ data: replies }, { data: reacts }, { data: votes }] = await Promise.all([sb.from('community_replies').select('*').eq('post_id', id).order('created_at'),
      sb.from('community_reactions').select('kind, user_id').eq('post_id', id), p.poll ? sb.from('community_votes').select('choice, user_id').eq('post_id', id) : { data: [] }]);
    await people([p.author, ...(replies || []).map(r => r.author)]);
    const authorTeam = (names.get(p.author) || { roles: [] }).roles.some(r => r === 'owner' || r === 'developer');
    const mine = r => me && r.author === me.id, myVote = (votes || []).find(v => me && v.user_id === me.id), total = (votes || []).length;
    main.innerHTML = `<p><a href="#/s/${p.category}">← ${esc(CAT[p.category][1])}</a></p><article class="card hub-full">
        <p class="hub-meta">${who(p.author)} · ${ago(p.created_at)}${p.edited_at ? ' · edited' : ''}${p.state ? ` · <span class="hub-state st-${p.state.replace(/ /g, '-')}">${esc(p.state)}</span>` : ''}${p.status !== 'visible' ? ` · <b>${esc(p.status)}</b>` : ''}</p>
        <h2>${esc(p.title)}</h2>${p.body ? `<p class="hub-body">${textHtml(p.body, authorTeam)}</p>` : ''}${p.image ? `<img class="hub-img" src="${esc(pubUrl(p.image))}" alt="${esc(p.title)}">` : ''}
        ${p.poll ? `<div class="hub-poll">${p.poll.map((o, i) => { const n = (votes || []).filter(v => v.choice === i).length, pc = total ? Math.round(n / total * 100) : 0; return `<button class="hub-opt${myVote && myVote.choice === i ? ' on' : ''}" data-vote="${i}" ${myVote || !me || p.locked ? 'disabled' : ''}><span style="width:${myVote || !me ? pc : 0}%"></span><b>${esc(o)}</b>${myVote || !me ? ` <small>${pc}% (${n})</small>` : ''}</button>`; }).join('')}<p class="muted small">${total} vote${total === 1 ? '' : 's'}${!me ? ' · sign in to vote' : myVote ? ' · you voted' : ''}</p></div>` : ''}
        <div class="hub-reacts">${REACT.map(([k, e]) => { const n = (reacts || []).filter(r => r.kind === k).length, on = me && (reacts || []).some(r => r.kind === k && r.user_id === me.id); return `<button class="hub-react${on ? ' on' : ''}" data-react="${k}" ${me ? '' : 'disabled'} aria-pressed="${!!on}" aria-label="${k}">${e} ${n || ''}</button>`; }).join('')}</div>
        <p class="hub-tools">${mine(p) ? '<button class="hub-link" data-edit>Edit</button> <button class="hub-link" data-del>Delete</button>' : ''}${me && !mine(p) ? `<button class="hub-link" data-report="post:${p.id}">Report</button>` : ''}
        ${isStaff() ? ` · <button class="hub-link" data-mod="pinned:${!p.pinned}">${p.pinned ? 'Unpin' : 'Pin'}</button> <button class="hub-link" data-mod="locked:${!p.locked}">${p.locked ? 'Reopen' : 'Close replies'}</button> <button class="hub-link" data-mod="status:${p.status === 'visible' ? 'hidden' : 'visible'}">${p.status === 'visible' ? 'Hide' : 'Show'}</button>${p.state ? ` <select data-state aria-label="State">${['open', 'planned', 'in progress', 'done', 'fixed', 'not planned'].map(s => `<option ${s === p.state ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}` : ''}</p></article>
      <h3 class="hub-h">${(replies || []).length} repl${(replies || []).length === 1 ? 'y' : 'ies'}</h3>
      ${(replies || []).map(r => `<div class="card hub-reply${r.status !== 'visible' ? ' hidden-r' : ''}"><p class="hub-meta">${who(r.author)} · ${ago(r.created_at)}${r.edited_at ? ' · edited' : ''}${r.status !== 'visible' ? ' · <b>' + esc(r.status) + '</b>' : ''}</p><p class="hub-body">${textHtml(r.body, (names.get(r.author) || { roles: [] }).roles.some(x => x === 'owner' || x === 'developer'))}</p>
        <p class="hub-tools">${mine(r) ? `<button class="hub-link" data-rdel="${r.id}">Delete</button>` : me ? `<button class="hub-link" data-report="reply:${r.id}">Report</button>` : ''}${isStaff() ? ` <button class="hub-link" data-rmod="${r.id}:${r.status === 'visible' ? 'hidden' : 'visible'}">${r.status === 'visible' ? 'Hide' : 'Show'}</button>` : ''}</p></div>`).join('')}
      ${p.locked ? '<p class="muted">Replies are closed.</p>' : me ? `<form class="hub-form card" data-reply><label>Your reply<textarea name="body" maxlength="2000" rows="3" required></textarea></label><button class="btn btn-primary" type="submit">Reply</button></form>` : '<p><a href="account.html?next=community.html">Sign in</a> to reply.</p>'}`;
    const act = async (body, after) => { try { await call('community', body); (after || (() => showPost(id)))(); } catch (e) { modal(`<h2>Not done</h2><p>${esc(e.message)}</p>`); } };
    for (const b of main.querySelectorAll('[data-vote]')) b.onclick = async () => { const { error } = await sb.from('community_votes').insert({ post_id: id, user_id: me.id, choice: +b.dataset.vote }); if (error) modal(`<p>${esc(error.message)}</p>`); showPost(id); };
    for (const b of main.querySelectorAll('[data-react]')) b.onclick = async () => { const on = b.classList.contains('on'); if (on) await sb.from('community_reactions').delete().eq('post_id', id).eq('user_id', me.id).eq('kind', b.dataset.react); else await sb.from('community_reactions').insert({ post_id: id, user_id: me.id, kind: b.dataset.react }); showPost(id); };
    for (const b of main.querySelectorAll('[data-mod]')) b.onclick = () => { const [k, v] = b.dataset.mod.split(':'); act({ action: 'moderate', post: id, [k]: k === 'status' ? v : v === 'true' }); };
    const sel = main.querySelector('[data-state]'); if (sel) sel.onchange = () => act({ action: 'moderate', post: id, state: sel.value });
    for (const b of main.querySelectorAll('[data-rmod]')) b.onclick = () => { const [rid, s] = b.dataset.rmod.split(':'); act({ action: 'moderate', reply: +rid, status: s }); };
    for (const b of main.querySelectorAll('[data-rdel]')) b.onclick = () => act({ action: 'delete', reply: +b.dataset.rdel });
    const del = main.querySelector('[data-del]'); if (del) del.onclick = () => modal('<h2>Delete this post?</h2><p>It is removed for everyone, with its picture.</p><div class="hub-actions"><button class="btn btn-primary" data-ok>Delete</button></div>', (d, close) => { d.querySelector('[data-ok]').onclick = () => { close(); act({ action: 'delete', post: id }, () => { location.hash = '#/s/' + p.category; }); }; });
    const ed = main.querySelector('[data-edit]'); if (ed) ed.onclick = () => modal(`<h2>Edit your post</h2><form class="hub-form"><label>Title<input name="title" maxlength="120" value="${esc(p.title)}"></label><label>Text<textarea name="body" rows="8" maxlength="5000">${esc(p.body)}</textarea></label><button class="btn btn-primary" type="submit">Save</button></form>`, (d, close) => { const f = d.querySelector('form'); f.onsubmit = e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); close(); act({ action: 'edit', post: id, title: v.title, body: v.body }); }; });
    for (const b of main.querySelectorAll('[data-report]')) b.onclick = () => { const [k, rid] = b.dataset.report.split(':'); modal(`<h2>Report this</h2><form class="hub-form"><label>Why<select name="reason">${['abuse', 'spam', 'cheating', 'personal information', 'not for children', 'other'].map(r => `<option>${r}</option>`).join('')}</select></label><label>Anything to add <small>(optional)</small><textarea name="details" maxlength="500" rows="3"></textarea></label><button class="btn btn-primary" type="submit">Send the report</button></form><p class="muted small">Moderators see it; the person you report doesn't see who reported.</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const row = { reporter: me.id, reason: v.reason, details: v.details || null, [k === 'post' ? 'post_id' : 'reply_id']: +rid }; const { error } = await sb.from('community_reports').insert(row); if (error) say(f, error.message); else { d.innerHTML = '<h2>Thank you</h2><p>A moderator will look at it.</p>'; setTimeout(close, 1500); } }; }); };
    const rf = main.querySelector('[data-reply]'); if (rf) rf.onsubmit = e => { e.preventDefault(); act({ action: 'reply', post: id, body: new FormData(rf).get('body') }); };
  }
  async function showKeeper(id) {
    shell('<p class="muted">Loading...</p>', '');
    const { data: k } = await sb.rpc('keeper_page', { p_user: id }); const main = root.querySelector('.hub-main');
    if (!k) { main.innerHTML = '<p>This keeper\'s profile is hidden.</p>'; return; }
    const follows = me && me.id !== id ? !!(await sb.from('community_follows').select('follower').eq('follower', me.id).eq('followee', id).maybeSingle()).data : false;
    const { data: posts } = await sb.from('community_posts').select('id, title, category, created_at, replies').eq('author', id).eq('status', 'visible').order('created_at', { ascending: false }).limit(20);
    const sc = k.showcase || {};
    main.innerHTML = `<section class="card hub-me"><div class="hub-me-head"><div class="hub-av" aria-hidden="true">${esc(String(k.name || '?').slice(0, 1))}</div><div><h2>${esc(k.name)}</h2><p>${roleChips(k.roles)} <span class="muted">Joined ${day(k.joined)}</span></p></div></div>
      ${k.bio ? `<p>${esc(k.bio)}</p>` : ''}<div class="hub-stats">${sc.level ? `<span><b>${esc(sc.level)}</b> level</span>` : ''}${sc.regions != null ? `<span><b>${esc(sc.regions)}</b> regions</span>` : ''}<span><b>${k.posts}</b> posts</span><span><b>${k.followers}</b> followers</span><span><b>${k.following}</b> following</span></div>
      <p>${k.discord ? `Discord: <b>${esc(k.discord)}</b> · ` : ''}Friend code <b>${esc(k.friend_code || '-')}</b>${me && me.id !== id ? ` · <button class="btn btn-ghost btn-sm" data-follow>${follows ? 'Following' : 'Follow'}</button>` : ''}</p></section>
      <h3 class="hub-h">Posts</h3>${(posts || []).map(p => `<p><a href="#/p/${p.id}">${esc(p.title)}</a> <span class="muted small">${esc(CAT[p.category][1])} · ${ago(p.created_at)} · ${p.replies} replies</span></p>`).join('') || '<p class="muted">No posts yet.</p>'}`;
    const f = main.querySelector('[data-follow]'); if (f) f.onclick = async () => { if (follows) await sb.from('community_follows').delete().eq('follower', me.id).eq('followee', id); else await sb.from('community_follows').insert({ follower: me.id, followee: id }); showKeeper(id); };
  }
  function compose() {
    if (!me) { location.href = 'account.html?next=community.html'; return; }
    const cats = CATS.filter(c => canPostIn(c[0]));
    shell(`<h2 class="hub-h">New post</h2><form class="hub-form card" data-new>
      <label>Section<select name="category">${cats.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></label>
      <label>Title<input name="title" maxlength="120" required></label>
      <label>Text<textarea name="body" maxlength="5000" rows="8"></textarea></label>
      <label>A picture <small>(optional: PNG, JPEG or WebP, up to 3 MB)</small><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label>A poll <small>(optional: one choice per line, 2 to 6)</small><textarea name="poll" rows="3" maxlength="400"></textarea></label>
      <p class="muted small">Be kind, no links (the team can share them), no personal details. Posts are public; moderators can remove what breaks the <a href="terms.html#5-co-op-chat-and-the-community">rules</a>.</p>
      <button class="btn btn-primary" type="submit">Post</button></form>`, '');
    const f = root.querySelector('[data-new]');
    f.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(f), btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        let image = null; const file = fd.get('image');
        if (file && file.size) { if (file.size > 3 * 1048576) throw new Error('Use a picture under 3 MB.'); const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          image = `${me.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`; const up = await sb.storage.from('community').upload(image, file, { contentType: file.type }); if (up.error) throw up.error; }
        const poll = String(fd.get('poll') || '').split('\n').map(s => s.trim()).filter(Boolean);
        const r = await call('community', { action: 'post', category: fd.get('category'), title: fd.get('title'), body: fd.get('body'), image, poll: poll.length ? poll : undefined });
        location.hash = '#/p/' + r.post;
      } catch (err) { say(f, err.message || String(err)); btn.disabled = false; }
    };
  }
  async function following() {
    const { data: f } = await sb.from('community_follows').select('followee').eq('follower', me.id);
    const ids = (f || []).map(x => x.followee); if (!ids.length) { shell('<h2 class="hub-h">Following</h2><p class="muted">Follow keepers from their page to see their posts here.</p>', 'following'); return; }
    listPosts(q => q.in('author', ids), 'following', 'Following');
  }
  function route() {
    const hsh = location.hash.replace(/^#/, '') || '/', m = hsh.match(/^\/(s|p|k)\/([^/]+)$/);
    if (hsh === '/new') return compose();
    if (hsh === '/following' && me) return following();
    if (m && m[1] === 's' && CAT[m[2]]) return listPosts(q => q.eq('category', m[2]), m[2], CAT[m[2]][1]);
    if (m && m[1] === 'p') return showPost(+m[2]);
    if (m && m[1] === 'k') return showKeeper(m[2]);
    return listPosts(q => q, 'all', 'Everything');
  }

  // ---------- start ----------
  loadMe().then(() => {
    if (PAGE === 'store') renderStore();
    else if (PAGE === 'account') renderAccount();
    else if (PAGE === 'community') { route(); window.addEventListener('hashchange', route); }
  });
})();
