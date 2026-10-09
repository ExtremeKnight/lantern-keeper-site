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
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, storageKey: 'lk-site-auth', detectSessionInUrl: false, flowType: 'pkce' } }); // (0.31: pkce for Google)
  window.LKHUB = { sb, CFG }; // (tests)
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const day = d => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const ago = d => { const m = (Date.now() - Date.parse(d)) / 6e4; return m < 1 ? 'just now' : m < 60 ? Math.floor(m) + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : day(d); };
  const ROLE = { owner: 'Owner', developer: 'Developer', moderator: 'Moderator', contributor: 'Contributor', subscriber: 'Club', supporter: 'Supporter', veteran: 'Veteran', player: 'Player' };
  const roleChips = roles => (roles || []).filter(r => r !== 'player').map(r => `<span class="role role-${r}">${ROLE[r] || esc(r)}</span>`).join('');
  let me = null, myRoles = [], myProfile = null, myPerms = new Set();

  async function call(fn, body) {
    const { data: s } = await sb.auth.getSession(), t = s && s.session && s.session.access_token;
    const r = await fetch(`${CFG.url}/functions/v1/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || 'Something went wrong (' + r.status + '). Try again.'); return b;
  }
  async function loadMe() {
    const { data } = await sb.auth.getUser(); me = data && data.user || null; myRoles = []; myProfile = null; myPerms = new Set();
    if (me) { const [r, p, q] = await Promise.all([sb.rpc('roles_all', { p_user: me.id }).then(x => x.error ? sb.rpc('roles_of', { p_user: me.id }) : x), sb.from('profiles').select('*').eq('id', me.id).maybeSingle(), sb.rpc('my_perms')]); myRoles = r.data || ['player']; myProfile = p.data; myPerms = new Set(q.data || []); }
  }
  const isStaff = () => myRoles.some(r => ['owner', 'developer', 'moderator'].includes(r));
  const isTeam = () => myRoles.some(r => ['owner', 'developer'].includes(r));
  // 0.30.1: what this account may do comes from the permissions the owners set (the server checks it again)
  const can = (...ps) => ps.some(p => myPerms.has(p));
  function modal(html, onReady) {
    const back = h(`<div class="hub-modal" role="dialog" aria-modal="true"><div class="hub-dlg">${html}<button class="hub-x" type="button" aria-label="Close">×</button></div></div>`);
    const close = () => { back.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape' && !back.classList.contains('hub-must')) close(); }; // (hub-must: answered, not dismissed)
    back.addEventListener('click', e => { if (back.classList.contains('hub-must')) return; if (e.target === back || e.target.closest('.hub-x')) close(); }); document.addEventListener('keydown', key);
    document.body.append(back); const f = back.querySelector('input, select, textarea, button.btn'); if (f) f.focus(); if (onReady) onReady(back.querySelector('.hub-dlg'), close); return close;
  }
  const say = (box, msg, ok) => { const p = box.querySelector('.hub-msg') || box.appendChild(h('<p class="hub-msg" role="status"></p>')); p.textContent = msg; p.classList.toggle('ok', !!ok); };

  // ---------- show / hide password: an eye on every password field (hidden by default) ----------
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function eyes(scope) {
    for (const i of scope.querySelectorAll('input[type=password]:not([data-eye])')) {
      i.dataset.eye = '1'; const wrap = h('<span class="hub-pw"></span>'); i.replaceWith(wrap); wrap.append(i);
      const b = h(`<button type="button" class="hub-eye" aria-label="Show password" aria-pressed="false">${EYE}</button>`); wrap.append(b);
      b.onclick = () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.setAttribute('aria-pressed', String(show)); i.focus(); };
    }
  }
  new MutationObserver(() => eyes(document.body)).observe(document.body, { childList: true, subtree: true });

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
    if (tab === 'in' || tab === 'up') Promise.all([providers, emailCode]).then(([list, code]) => { if (!box.isConnected || (!list.length && !(code && tab === 'in'))) return;
      const g = h(`<div class="hub-oauth">${list.map(k => `<button class="btn btn-oauth p-${k}" type="button" data-p="${k}">Continue with ${oauthName(k)}</button>`).join('')}${code && tab === 'in' ? '<button class="btn btn-oauth p-email" type="button" data-code>Email me a sign-in code</button>' : ''}<p class="hub-or"><span>or with your email and password</span></p></div>`);
      box.querySelector('.hub-form').before(g);
      for (const b of g.querySelectorAll('[data-p]')) b.onclick = () => googleGo(b.dataset.p).catch(err => say(box.querySelector('form'), err.message || String(err)));
      const c = g.querySelector('[data-code]'); if (c) c.onclick = () => authPanel(box, done, 'code'); });
    if (googleMsg) { say(box.querySelector('form'), googleMsg); googleMsg = ''; }
    if (tab === 'code') { const f = box.querySelector('form'); f.querySelector('[type=submit]').textContent = 'Email me a code'; f.insertAdjacentHTML('afterbegin', '<p>We send a 6-digit code to your email: no password needed.</p>'); }
    const form = box.querySelector('form'); let token = () => undefined;
    captcha(box.querySelector('.hub-cap')).then(t => { token = t; }, () => { /* no check: the server will say */ });
    form.onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form)); const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        if (tab === 'in') { const { error } = await sb.auth.signInWithPassword({ email: v.email.trim(), password: v.pw, options: { captchaToken: token() } }); if (error) throw error; await loadMe(); signedIn(done); return; }
        if (tab === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(v.email.trim(), { captchaToken: token() }); if (error) throw error; codeStep(box, v.email.trim(), 'recovery', done); return; }
        if (tab === 'code') { const { error } = await sb.auth.signInWithOtp({ email: v.email.trim(), options: { shouldCreateUser: false, captchaToken: token() } }); if (error && !/signups not allowed|not found/i.test(error.message)) throw error; codeStep(box, v.email.trim(), 'email', done); return; }
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
        await loadMe(); signedIn(done); } catch (err) { say(form, err.message || String(err)); }
    };
  }
  // ---------- 0.31: other ways to sign in: Google, Discord, Twitch, Facebook, X (each shown once the owner turns
  // it on in Supabase), and a 6-digit code by email instead of a password (the dashboard switch "Sign in with an email code") ----------
  const OAUTH = [['google', 'Google'], ['discord', 'Discord'], ['twitch', 'Twitch'], ['facebook', 'Facebook'], ['x', 'X']];
  const oauthName = k => k === 'twitter' ? 'X' : (OAUTH.find(p => p[0] === k) || [k, k])[1];
  const providers = fetch(`${CFG.url}/auth/v1/settings`, { headers: { apikey: CFG.key } }).then(r => r.json()).then(j => { const x = (j && j.external) || {}; return OAUTH.map(p => p[0]).filter(k => x[k]).concat(!x.x && x.twitter ? ['twitter'] : []); }, () => []); // (X: Supabase names its older connection twitter)
  const emailCode = sb.from('game_switches').select('on').eq('key', 'emailcode').maybeSingle().then(r => !!(r.data && r.data.on), () => false);
  async function googleGo(provider = 'google', why = '') {
    try { sessionStorage.setItem('lk-site-oauth', provider + (why ? ':' + why : '')); } catch (e) { /* */ }
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname + location.search.replace(/[?&](code|error|error_description|error_code|state)=[^&]*/g, ''),
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } });
    if (error) throw error;
  }
  // back from the provider: ?code=... (or ?error=...); the session is made from it and the address cleaned up
  let googleMsg = '';
  async function googleReturn() {
    const q = new URLSearchParams(location.search), code = q.get('code'), err = q.get('error_description') || q.get('error'); if (!code && !err) return;
    let prov = ''; try { prov = sessionStorage.getItem('lk-site-oauth') || ''; sessionStorage.removeItem('lk-site-oauth'); } catch (e) { /* */ }
    for (const k of ['code', 'error', 'error_description', 'error_code', 'state']) q.delete(k);
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    if (!prov) return; let why = ''; [prov, why = ''] = prov.split(':'); const nm = oauthName(prov === '1' ? 'google' : prov);
    if (err) { googleMsg = /email/i.test(err) ? `${nm} did not share an email address, which every account needs. Try another way to sign in.` : `${nm} sign-in did not finish. Try again, or use your email.`; return; }
    const { error } = await sb.auth.exchangeCodeForSession(code); if (error) googleMsg = error.message; else if (why === 'delete') deleteNext = true;
  }
  let deleteNext = false;
  // an account made with Google answers the sign-up questions first, as every account does (complete_consent)
  function consentPanel(then) {
    const y = new Date().getFullYear();
    modal(`<h2>Finish your account</h2><p>Signed in with ${esc(oauthName(((me.identities || []).find(i => i.provider !== 'email') || {}).provider || 'google'))} as <b>${esc(me.email)}</b>. A few questions before you go on, as for every account. Accounts are for players aged 13 or over.</p>
      <form class="hub-form" novalidate><label>Keeper name<input name="name" maxlength="16" autocomplete="nickname" required></label>
        <div class="hub-row"><label>Born in<select name="bm"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
          <label>&nbsp;<select name="by"><option value="">Year</option>${Array.from({ length: 100 }, (_, i) => y - i).map(v => `<option>${v}</option>`).join('')}</select></label></div>
        <label class="hub-check"><input type="checkbox" name="parent"> I am 13 to 15 and a parent or guardian agrees</label>
        <label class="hub-check"><input type="checkbox" name="terms"> I agree to the <a href="terms.html" target="_blank">Terms of Service</a> and have read the <a href="privacy-policy.html" target="_blank">Privacy Policy</a></label>
        <label class="hub-check"><input type="checkbox" name="news"> Send me patch notes and updates (you can stop them any time)</label>
        <button class="btn btn-primary" type="submit">Finish</button> <button class="btn btn-ghost" type="button" data-cancel>Cancel and sign out</button></form>`, (dlg, close) => {
      const form = dlg.querySelector('form'); dlg.closest('.hub-modal').classList.add('hub-must');
      dlg.querySelector('[data-cancel]').onclick = async () => { await sb.auth.signOut({ scope: 'local' }); close(); location.reload(); };
      form.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]'); btn.disabled = true;
        try {
          const name = String(v.name || '').trim(); if (!/^[A-Za-z0-9 _.'-]{3,16}$/.test(name)) throw new Error('Choose a keeper name of 3 to 16 letters or numbers.');
          if (!v.bm || !v.by) throw new Error('Choose the month and year you were born.');
          const now = new Date(), age = now.getFullYear() - +v.by - (now.getMonth() + 1 < +v.bm ? 1 : 0), ok = age >= AGE_MIN, teen = ok && age < PARENT_UNDER;
          if (teen && !v.parent) throw new Error('Players aged 13 to 15 need a parent or guardian to agree: tick the box when they do.');
          if (ok && !v.terms) throw new Error('Please agree to the Terms of Service to make an account.');
          const unsub = Array.from(crypto.getRandomValues(new Uint8Array(18)), x => x.toString(16).padStart(2, '0')).join('');
          const { data, error } = await sb.rpc('complete_consent', { p_age_ok: ok, p_teen: teen, p_parent_ok: teen, p_terms: TERMS, p_news: !!v.news, p_name: name, p_unsub: unsub, p_adult: age >= 18 }); if (error) throw error;
          if (data === 'deleted') { await sb.auth.signOut({ scope: 'local' }); form.innerHTML = '<p>Accounts are for players aged 13 or over, so that account was removed. You can still play the game as a guest.</p>'; setTimeout(() => location.reload(), 4000); return; }
          close(); await loadMe(); then();
        } catch (err) { say(form, err.message || String(err)); btn.disabled = false; } };
    });
  }
  // after any sign-in: an account made with Google answers the questions first (0.31)
  const signedIn = done => { if (me && myProfile && myProfile.consent_pending) consentPanel(done); else done(); };
  // 0.31: deleting the account from the website (also explained on delete-data.html): a password account types its
  // password; an account made with Google, Discord... signs in with it again first (the server checks it was just now)
  function deleteAccount(confirmed) {
    const prov = ((me.identities || []).find(i => i.provider !== 'email') || {}).provider, viaOauth = !!prov && !(me.identities || []).some(i => i.provider === 'email');
    modal(`<h2>Delete your account</h2><p>This permanently deletes your Lantern Keeper account: your cloud save, profile, friends, messages, posts and Lumens. Purchased items can't be restored afterwards. Progress saved on your own devices stays there.</p>
      <form class="hub-form" novalidate>${viaOauth ? (confirmed ? `<p class="hub-msg ok">Confirmed with ${esc(oauthName(prov))}. You can delete now (within 10 minutes).</p>` : `<p>Your account signs in with ${esc(oauthName(prov))}: confirm with it first.</p><button class="btn btn-ghost" type="button" data-reauth>Confirm with ${esc(oauthName(prov))}</button>`)
        : '<label>Your password, to confirm<input name="pw" type="password" autocomplete="current-password" required></label><div class="hub-cap"></div>'}
        <label class="hub-check"><input type="checkbox" name="sure"> I understand this can't be undone</label>
        <button class="btn btn-danger" type="submit">Delete my account</button></form>`, (dlg, close) => {
      const form = dlg.querySelector('form'); let token = () => undefined;
      if (!viaOauth) captcha(form.querySelector('.hub-cap')).then(t => { token = t; }, () => {});
      const re = form.querySelector('[data-reauth]'); if (re) re.onclick = () => googleGo(prov, 'delete').catch(err => say(form, err.message || String(err)));
      form.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
        if (!v.sure) return say(form, 'Tick the box to confirm.'); btn.disabled = true;
        try { await call('delete-account', viaOauth ? { oauth: true } : { password: v.pw, captchaToken: token() });
          await sb.auth.signOut({ scope: 'local' }); close(); me = null; root.innerHTML = '<section class="card"><h2>Your account has been deleted</h2><p>Thank you for keeping the light. You can still play as a guest.</p></section>';
        } catch (err) { say(form, err.message || String(err)); btn.disabled = false; } };
    });
  }
  function needSignIn(box, why, done) { box.innerHTML = `<p class="hub-lead">${esc(why)}</p><div class="hub-authbox"></div>`; authPanel(box.querySelector('.hub-authbox'), done); }

  // ---------- the store ----------
  const store = { products: [], settings: null, club: null, orders: [],
    // the currency and the prices come from assets/i18n.js (nine currencies, 0.30.1); a product without a price in that
    // currency shows (and is charged) in US dollars
    cur() { return Lx().cur(); }, setCur(c) { Lx().setCur(c); },
    cents(p, cur = this.cur()) { return cur === 'USD' ? p.usd_cents : cur === 'PHP' ? p.php_cents : (p.prices || {})[cur] || null; },
    payCur(p, cur = this.cur()) { return this.cents(p, cur) ? cur : 'USD'; },
    price(p, cur = this.cur()) { const c = this.payCur(p, cur); return Lx().money(this.cents(p, c), c); } };
  const LF = { cur: () => 'USD', setCur: () => {}, money: (c, cur) => (cur === 'PHP' ? '₱' : '$') + (c / 100).toFixed(2), CURS: [['PHP', '₱', 'Philippine peso'], ['USD', '$', 'US dollar']] };
  const Lx = () => window.LKI18N || LF; // (assets/i18n.js may load after this script)
  async function loadStore() {
    const [p, s, c, o] = await Promise.all([sb.from('store_products').select('*').eq('active', true).order('sort'),
      me ? sb.from('store_settings').select('gcash_name, gcash_number, gcash_qr, bank_details, manual_on').eq('id', 1).maybeSingle() : { data: null },
      me ? sb.from('club_members').select('until, status, paypal_sub, months, currency, amount_cents, env').eq('user_id', me.id).maybeSingle() : { data: null },
      me ? sb.from('store_orders').select('id, sku, method, currency, amount_cents, status, created_at, reference, env').order('created_at', { ascending: false }).limit(30) : { data: [] }]);
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
        <div class="hub-cur" role="group" aria-label="Currency" translate="no">${Lx().CURS.map(([k, sym, name]) => `<button data-cur="${k}" aria-pressed="${cur === k}" title="${esc(Lx().t ? Lx().t(name) : name)}">${sym} ${k}</button>`).join('')}</div></div>
      ${club ? `<section class="hub-club card"><div><span class="kicker">Supporter Club · monthly, cancel any time</span><h2>Keep the light on, every month</h2>
        <ul class="hub-perks"><li>A new lantern each month, yours to keep</li><li>The Club frame, badge and Club Keeper title</li><li>The Club role and the Supporter Lounge in the community</li><li>Early looks, behind-the-scenes posts and polls</li><li>Your name in the credits</li></ul>
        ${store.club ? subPanel(store.club, club) : ''}</div>
        <div class="hub-club-buy"><p class="hub-price">${store.price(club, cur)}<small> / month</small></p>
        ${renewing(store.club) ? '<button class="btn btn-ghost" data-club-stop>Cancel the subscription</button>' : `<button class="btn btn-primary" data-club>${member ? 'Renew monthly with PayPal' : 'Join monthly with PayPal'}</button>`}
        ${store.settings && store.settings.manual_on ? `<button class="btn btn-ghost" data-buy="${esc(club.sku)}">One month by GCash or bank</button>` : ''}
        <p class="muted small">Recognition and looks only: never an advantage. Stop any time.</p></div></section>` : ''}
      <h2 class="hub-h">Supporter packs</h2><div class="cards hub-grid">${store.products.filter(p => p.kind === 'pack').map(card).join('')}</div>
      <h2 class="hub-h">Lumens</h2><p class="muted">Lumens buy looks in the game's shop. They never buy strength.</p><div class="cards hub-grid hub-grid-4">${store.products.filter(p => p.kind === 'lumens').map(card).join('')}</div>
      ${me && store.orders.length ? `<h2 class="hub-h">Your orders</h2><div class="hub-orders">${store.orders.map(orderRow).join('')}</div>` : ''}
      <p class="muted small">Sold by Exenova. Pay with PayPal (a PayPal account or a card) or GCash and bank transfer. Everything goes to your account, in the game on every device. Refunds within 14 days: see the <a href="terms.html#4a-refunds">Terms</a>. If you are under 18, ask a parent before buying.</p>`;
    for (const b of root.querySelectorAll('.hub-cur [data-cur]')) b.onclick = () => { store.setCur(b.dataset.cur); renderStore(); };
    for (const b of root.querySelectorAll('[data-buy]')) b.onclick = () => buy(store.products.find(p => p.sku === b.dataset.buy));
    const j = root.querySelector('[data-club]'); if (j) j.onclick = () => joinClub();
    const st = root.querySelector('[data-club-stop]'); if (st) st.onclick = () => modal(`<h2>Cancel your subscription?</h2><p>No more monthly payments. You stay a member until <b>${day(store.club.until)}</b>; then the Club frame, badge and title end. The lanterns you received stay yours, and you can join again any time.</p><div class="hub-actions"><button class="btn btn-primary" data-ok>Cancel the subscription</button><button class="btn btn-ghost" data-keep>Keep it</button></div>`, (d, close) => { d.querySelector('[data-keep]').onclick = close; d.querySelector('[data-ok]').onclick = async () => { try { await call('store', { action: 'club_cancel' }); close(); renderStore(); } catch (e) { say(d, e.message); } }; });
  }
  const ORDER_STATE = { created: 'Waiting for payment', review: 'Pending: being checked', paid: 'Completed', rejected: 'Not confirmed', refunded: 'Refunded', cancelled: 'Cancelled', expired: 'Not completed: nothing was charged' };
  const HOW = { paypal: 'PayPal', gcash: 'GCash', bank: 'Bank transfer', grant: 'Gift from the team' };
  const renewing = c => !!(c && c.paypal_sub && c.status === 'active' && Date.parse(c.until) > Date.now());
  function subPanel(c, club) {
    const member = Date.parse(c.until) > Date.now(), price = c.amount_cents ? Lx().money(c.amount_cents, c.currency) : store.price(club);
    const status = !member ? 'Ended' : renewing(c) ? 'Active, renews every month' : c.paypal_sub ? 'Cancelled: stays until the end of the paid month' : 'Active (paid month by month)';
    return `<dl class="hub-sum"><dt>Plan</dt><dd>Supporter Club${c.env && c.env !== 'live' ? ' <span class="hub-test">Test</span>' : ''}</dd><dt>Price</dt><dd>${esc(price)} a month</dd><dt>Billing</dt><dd>${c.paypal_sub ? 'Monthly with PayPal' : 'One month at a time (GCash or bank)'}</dd><dt>Status</dt><dd>${esc(status)}</dd>${renewing(c) ? `<dt>Next payment</dt><dd>${day(c.until)}</dd>` : `<dt>${member ? 'Ends' : 'Ended'}</dt><dd>${day(c.until)}</dd>`}</dl>`;
  }
  const orderRow = o => { const p = store.products.find(x => x.sku === o.sku); return `<div class="hub-order"><span>${esc(p ? p.label : o.sku)}${o.env && o.env !== 'live' ? ' <span class="hub-test">Test</span>' : ''}${o.method === 'grant' ? ' · a gift from the team' : ` · ${Lx().money(o.amount_cents, o.currency)} ${o.currency} · ${HOW[o.method] || esc(o.method)}`}${o.reference ? ' · ref ' + esc(o.reference) : ''}</span><span class="state-${o.status}">${ORDER_STATE[o.status] || esc(o.status)} · ${day(o.created_at)}</span></div>`; };
  function buy(p) {
    if (!me) { location.href = 'account.html?next=store.html'; return; }
    const cur = store.payCur(p), s = store.settings || {}, gc = s.manual_on && (s.gcash_number || s.gcash_qr), bk = s.manual_on && s.bank_details;
    modal(`<h2>${esc(p.label)}: ${store.price(p, cur)}</h2><p>${p.kind === 'club' ? 'One month in the Supporter Club. It does not renew by itself.' : p.kind === 'lumens' ? `${Number(p.lumens).toLocaleString()} Lumens for your account.` : esc(p.blurb)} <b>One-time payment.</b></p>
      <div class="hub-actions">${p.kind !== 'club' ? '<button class="btn btn-primary" data-pp>PayPal or card</button>' : ''}${gc ? `<button class="btn ${p.kind === 'club' ? 'btn-primary' : 'btn-ghost'}" data-gc="gcash">GCash${cur === 'PHP' ? '' : ' (pesos)'}</button>` : ''}${bk ? `<button class="btn btn-ghost" data-gc="bank">Bank transfer${cur === 'PHP' ? '' : ' (pesos)'}</button>` : ''}</div>
      <p class="muted small">Sold by Exenova. After paying with PayPal you come back here and it is added in a few seconds.</p>`, (d, close) => {
      const pp = d.querySelector('[data-pp]'); if (pp) pp.onclick = async () => { pp.disabled = true; try { const r = await call('store', { action: 'create', sku: p.sku, currency: cur }); location.href = r.approve; } catch (e) { say(d, e.message); pp.disabled = false; } };
      for (const b of d.querySelectorAll('[data-gc]')) b.onclick = () => { close(); gcash(p, b.dataset.gc); };
    });
  }
  async function joinClub() {
    if (!me) { location.href = 'account.html?next=store.html'; return; }
    try { const r = await call('store', { action: 'club', currency: store.payCur(store.products.find(x => x.kind === 'club') || {}) }); location.href = r.approve; } catch (e) { modal(`<h2>Not started</h2><p>${esc(e.message)}</p>`); }
  }
  function gcash(p, method) {
    const s = store.settings || {}, price = store.price(p, 'PHP'), g = method === 'gcash';
    modal(`<h2>Pay ${price} by ${g ? 'GCash' : 'bank transfer'}</h2>
      <ol class="hub-steps"><li>${g ? (s.gcash_qr ? 'Scan the QR code with GCash, or send' : 'Send') : 'Transfer'} exactly <b>${price}</b>.</li><li>Enter the reference number from your receipt.</li><li>It shows as <b>Pending</b> until we check it, usually within a day. Then it is in your account.</li></ol>
      ${g && s.gcash_qr ? `<img class="hub-qr" src="${esc(s.gcash_qr)}" alt="GCash QR code to pay ${esc(price)}" width="240" height="240">` : ''}
      ${g && s.gcash_number ? `<p><b>GCash number:</b> ${esc(s.gcash_number)}${s.gcash_name ? ' (' + esc(s.gcash_name) + ')' : ''}</p>` : ''}${!g ? `<p><b>Bank transfer to:</b> ${esc(s.bank_details || '')}</p>` : ''}
      <form class="hub-form"><label>Reference number<input name="ref" maxlength="64" autocomplete="off" required></label>
        <label>Name on the account you paid from <small>(optional, helps us find it)</small><input name="payer" maxlength="80" autocomplete="name"></label>
        <button class="btn btn-primary" type="submit">Submit payment</button></form>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        try { const r = await call('store', { action: 'manual', sku: p.sku, currency: 'PHP', method, reference: v.ref, payer: v.payer });
          d.innerHTML = `<h2>Payment submitted</h2><dl class="hub-sum"><dt>Product</dt><dd>${esc(p.label)}</dd><dt>Payment</dt><dd>${g ? 'GCash' : 'Bank transfer'}</dd><dt>Amount</dt><dd>${price} PHP</dd><dt>Status</dt><dd><b>Pending</b>: being checked</dd><dt>Reference</dt><dd>${esc(String(v.ref).trim())}</dd><dt>Order</dt><dd>${esc(String(r.order).slice(0, 8))}</dd></dl><p>We check it against our ${g ? 'GCash' : 'bank'} history, usually within a day; then it is in your account and the game tells you.</p><div class="hub-actions"><button class="btn btn-primary" data-done>Done</button></div>`;
          d.querySelector('[data-done]').onclick = () => { close(); renderStore(); };
        } catch (err) { say(f, err.message); } };
    });
  }

  // ---------- your account ----------
  const SKU_NAME = { 'lk.supporter.keeper': 'Supporter Pack', 'lk.supporter.starter': 'Starter Supporter', 'lk.supporter.dedicated': 'Dedicated Supporter', 'lk.supporter.founder': 'Founder', 'lk.club': 'Supporter Club (while a member)' };
  async function renderAccount() {
    if (!me) { needSignIn(root, 'Sign in with your Lantern Keeper account, or make one: it is the same account as in the game.', () => { const n = new URLSearchParams(location.search).get('next'); if (n && /^[a-z-]+\.html$/.test(n)) location.href = n; else renderAccount(); }); return; }
    root.innerHTML = '<p class="muted">Loading your account...</p>';
    const [w, e, c, prefs, o, kp] = await Promise.all([sb.from('wallets').select('lumens').eq('user_id', me.id).maybeSingle(), sb.from('entitlements').select('sku, granted_at, revoked_at').eq('user_id', me.id),
      sb.from('club_members').select('until, status, paypal_sub, months, currency, amount_cents, env').eq('user_id', me.id).maybeSingle(), sb.from('comm_prefs').select('*').eq('user_id', me.id).maybeSingle(),
      sb.from('store_orders').select('id, sku, method, currency, amount_cents, status, created_at, reference, env').order('created_at', { ascending: false }).limit(30),
      sb.rpc('keeper_page', { p_user: me.id }).then(x => x, () => ({ data: null }))]); // (0.31: the best wave and nights)
    const k = (kp && kp.data) || {}, p = myProfile || {}, ents = (e.data || []).filter(x => !x.revoked_at), sc = p.showcase || {}, md = me.user_metadata || {};
    const packs = ents.filter(x => SKU_NAME[x.sku] && x.sku !== 'lk.club').map(x => SKU_NAME[x.sku]), lanterns = ents.filter(x => /^lk\.club\.\d{4}-\d\d$/.test(x.sku)).length, looks = ents.filter(x => /^lumen:/.test(x.sku)).length;
    const member = c.data && Date.parse(c.data.until) > Date.now(), cp = prefs.data || {};
    store.products = store.products.length ? store.products : ((await sb.from('store_products').select('*')).data || []);
    root.innerHTML = `
      <section class="card hub-me"><div class="hub-me-head"><div class="hub-av" aria-hidden="true">${p.web_avatar ? `<img src="${esc(CFG.url + '/storage/v1/object/public/community/' + p.web_avatar)}" alt="">` : esc((p.display_name || '?').slice(0, 1))}</div><div>
        <h2>${esc(p.display_name || 'Keeper')}</h2><p>${roleChips(myRoles)} <span class="muted">Joined ${day(p.created_at || me.created_at)} · Friend code ${esc(p.friend_code || '-')}</span></p></div></div>
        <div class="hub-stats">${k.game && k.game.best ? `<span><b>${esc(k.game.best)}</b> best wave</span>` : ''}${k.game && k.game.runs ? `<span><b>${esc(k.game.runs)}</b> nights</span>` : ''}${sc.level ? `<span><b>${esc(sc.level)}</b> level</span>` : ''}${sc.regions != null ? `<span><b>${esc(sc.regions)}</b> regions</span>` : ''}${sc.achievements != null ? `<span><b>${esc(sc.achievements)}</b> achievements</span>` : ''}<span><b>${(w.data && w.data.lumens) || 0}</b> Lumens</span><span><b>${looks + packs.length + lanterns}</b> paid looks and packs</span></div>
        <p>${can('dashboard.open') ? '<a href="admin.html"><b>Dashboard</b></a> · ' : ''}<a href="community.html#/k/${me.id}">Your public page</a> · <a href="play/">Play</a> · <button class="hub-link" data-out>Sign out</button> · <button class="hub-link" data-del>Delete my account</button></p></section>
      <section class="card"><h2>Profile</h2><p class="muted small">Your picture, banner, name and colour show in the community and on your page. Your in-game avatar, frame and title are changed in the game (Profile).</p><div data-profile-editor></div></section>
      <section class="card"><h2>Supporter status</h2>
        ${c.data ? subPanel(c.data, store.products.find(x => x.kind === 'club') || { usd_cents: 0, php_cents: 0 }) + `<p><a href="store.html">${renewing(c.data) ? 'Manage or cancel the subscription' : member ? 'Renew monthly' : 'Join again'}</a></p>` : '<p>Not in the Supporter Club. <a href="store.html">Join it</a>.</p>'}
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
    root.querySelector('[data-del]').onclick = () => deleteAccount(); if (deleteNext) { deleteNext = false; deleteAccount(true); }
    profileEditor(root.querySelector('[data-profile-editor]'), () => setTimeout(renderAccount, 600));
    const mf = root.querySelector('[data-mail]'); mf.onsubmit = async ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(mf));
      const row = { user_id: me.id, email_updates: !!v.email_updates, email_events: !!v.email_events, email_friends: !!v.email_friends, email_promos: md.adult ? !!v.email_promos : false, updated_at: new Date().toISOString() };
      const { error } = await sb.from('comm_prefs').upsert(row); say(mf, error ? 'Not saved: ' + error.message : 'Saved.', !error); };
  }

  // ---------- the community (0.30.1): channels, live chat, threads, news, giveaways, tickets, search ----------
  const REACT = [['lamp', '🏮'], ['heart', '❤️'], ['laugh', '😄'], ['wow', '😮'], ['thanks', '🙏']];
  const GROUPS = [['news', 'From the team'], ['community', 'Community'], ['support', 'Support'], ['club', 'Supporter Club']];
  const TICKET_CATS = [['account', 'Account'], ['login', 'Signing in'], ['payment', 'A payment'], ['subscription', 'The Supporter Club'], ['bug', 'A bug'], ['game', 'The game'], ['report', 'Reporting someone'], ['other', 'Something else']];
  const TICKET_STATE = { open: 'Open: waiting for support', answered: 'Answered', waiting: 'Waiting for you', closed: 'Closed' };
  let channels = [], live = null, members = [], unread = 0, beat = 0;
  const names = new Map();
  const pubUrl = path => `${CFG.url}/storage/v1/object/public/community/${path}`;
  // other keepers come from community_people / community_online (0.30.1): a profile shows its name, picture and colour
  // only when it is shown; a hidden one is "A keeper" with only a staff role
  async function people(ids) {
    const need = [...new Set(ids)].filter(id => id && !names.has(id)); if (!need.length) return;
    const { data } = await sb.rpc('community_people', { p_ids: need });
    for (const id of need) { const p = (data || []).find(x => x.id === id) || {}; names.set(id, { name: p.shown ? p.name : 'A keeper', shown: !!p.shown, roles: p.roles || [], online: !!p.online, avatar: p.avatar || null, accent: p.accent || null }); }
  }
  const ACCENT = { gold: '#ffcf66', ember: '#ff8a3d', sky: '#7cc8ff', rose: '#e8616d', mint: '#7be0b0', violet: '#b49cff' };
  const ico = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const avatar = (id, size = 36) => { const n = names.get(id) || (me && id === me.id && myProfile ? { name: myProfile.display_name || '?', avatar: myProfile.web_avatar, accent: myProfile.accent, online: !!myProfile.show_profile } : { name: '?' });
    return `<span class="lkc-av${n.online ? ' on' : ''}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .45)}px${n.accent && ACCENT[n.accent] ? ';--acc:' + ACCENT[n.accent] : ''}" aria-hidden="true">${n.avatar ? `<img src="${esc(pubUrl(n.avatar))}" alt="" loading="lazy" decoding="async">` : esc(String(n.name).slice(0, 1).toUpperCase())}</span>`; };
  const who = id => { const n = names.get(id) || { name: 'A keeper', roles: [] }; const staffRoles = (n.roles || []).filter(r => ['owner', 'developer', 'moderator'].includes(r)); // (a hidden profile shows only staff roles: never whether someone paid)
    return n.shown ? `<a href="#/k/${id}" class="hub-who">${esc(n.name)}</a> ${roleChips(n.roles)}` : `<span class="hub-who">${esc(n.name)}</span> ${roleChips(staffRoles)}`; };
  const textHtml = (t, team) => esc(t).replace(/\n/g, '<br>').replace(/@([A-Za-z0-9_.'-]{3,16})/g, '<b class="lkc-mention">@$1</b>').replace(team ? /(https:\/\/[^\s<]+)/g : /$^/, '<a href="$1" rel="noopener nofollow" target="_blank">$1</a>');
  const canPost = ch => !ch ? !!me : ch.post_role === 'team' ? can('posts.publish') : ch.post_role === 'staff' ? can('posts.publish', 'events.post', 'moderation') : ch.post_role === 'club' ? isStaff() || myRoles.includes('subscriber') : !!me;
  const canRead = ch => ch.read_role !== 'club' || isStaff() || myRoles.includes('subscriber');
  const chan = id => channels.find(c => c.id === id), byCat = cat => channels.find(c => c.category === cat);
  const setLive = sub => { if (live) { sb.removeChannel(live); live = null; } live = sub || null; };
  async function loadNotifications() { if (!me) return; const { count } = await sb.from('community_notifications').select('id', { count: 'exact', head: true }).eq('read', false); unread = count || 0; const b = document.querySelector('.lkc-bell b'); if (b) { b.textContent = unread > 9 ? '9+' : unread || ''; b.hidden = !unread; } }
  // signed in on the website counts as being online (profile shown only)
  function heartbeat() { if (!me || beat) return; const tick = () => sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', me.id).then(() => {}, () => {}); tick(); beat = setInterval(() => { tick(); loadNotifications(); }, 120000); }
  function shell(active, inner) {
    const visible = channels.filter(canRead);
    root.innerHTML = `<div class="lkc">
      <aside class="lkc-rail" id="lkcRail" aria-label="Community channels">
        <form class="lkc-search" role="search"><input name="q" placeholder="Search the community" aria-label="Search the community" value="${esc(decodeURIComponent((location.hash.match(/^#\/search\/(.+)$/) || [])[1] || ''))}"></form>
        <a class="lkc-ch${active === 'home' ? ' on' : ''}" href="#/">${ico('home')}<span>Home</span></a>
        ${me ? `<a class="lkc-ch${active === 'following' ? ' on' : ''}" href="#/following">${ico('star')}<span>Following</span></a><a class="lkc-ch${active === 'saved' ? ' on' : ''}" href="#/saved">${ico('bookmark')}<span>Saved</span></a>` : ''}
        ${GROUPS.map(([g, label]) => { const list = visible.filter(c => c.grp === g); return list.length ? `<p class="lkc-grp">${label}</p>` + list.map(c => `<a class="lkc-ch${active === c.id ? ' on' : ''}" href="#/c/${c.id}" title="${esc(c.description)}">${ico(c.kind === 'chat' ? 'hash' : c.kind === 'news' ? 'megaphone' : 'list')}<span>${esc(c.name)}</span></a>`).join('') + (g === 'support' && me ? `<a class="lkc-ch${active === 'tickets' ? ' on' : ''}" href="#/tickets">${ico('mail')}<span>My tickets</span></a>` : '') : ''; }).join('')}
        <div class="lkc-me">${me ? `<a class="lkc-me-link" href="#/k/${me.id}">${avatar(me.id, 34)}<span><b>${esc((myProfile && myProfile.display_name) || 'Keeper')}</b><small>${myProfile && myProfile.show_profile ? 'Online' : 'Profile hidden'}</small></span></a><a class="lkc-iconbtn" href="#/me" aria-label="Edit your profile" title="Edit your profile">${ico('edit')}</a><button class="lkc-iconbtn lkc-bell" aria-label="Notifications" data-bell>${ico('bell')}<b ${unread ? '' : 'hidden'}>${unread > 9 ? '9+' : unread || ''}</b></button>`
          : '<a class="btn btn-primary btn-sm" href="account.html?next=community.html">Sign in to take part</a>'}</div>
      </aside>
      <section class="lkc-main"><div class="lkc-top"><button class="lkc-menu" aria-controls="lkcRail" aria-expanded="false" aria-label="Channels">${ico('menu')}</button><span id="lkcTitle"></span></div><div class="lkc-body">${inner}</div></section>
      <aside class="lkc-people" aria-label="Online now"><p class="lkc-grp"><span>Online now</span> · ${members.length}</p>${members.slice(0, 40).map(m => `<a class="lkc-person" href="#/k/${m.id}">${avatar(m.id, 30)}<span>${esc((names.get(m.id) || m).name)}</span></a>`).join('') || '<p class="muted small">Nobody right now.</p>'}</aside>
    </div>`;
    const rail = root.querySelector('#lkcRail'), mb = root.querySelector('.lkc-menu');
    const lkc = root.querySelector('.lkc'), closeRail = () => { rail.classList.remove('open'); lkc.classList.remove('rail-open'); mb.setAttribute('aria-expanded', 'false'); };
    mb.onclick = () => { const open = rail.classList.toggle('open'); mb.setAttribute('aria-expanded', String(open)); lkc.classList.toggle('rail-open', open); };
    lkc.addEventListener('click', e => { if (rail.classList.contains('open') && e.target === lkc) closeRail(); });
    rail.addEventListener('keydown', e => { if (e.key === 'Escape' && rail.classList.contains('open')) { closeRail(); mb.focus(); } });
    for (const a of rail.querySelectorAll('a')) a.addEventListener('click', closeRail);
    root.querySelector('.lkc-search').onsubmit = e => { e.preventDefault(); const q = new FormData(e.target).get('q').trim(); if (q.length >= 2) location.hash = '#/search/' + encodeURIComponent(q); };
    const bell = root.querySelector('[data-bell]'); if (bell) bell.onclick = showNotifications;
    return root.querySelector('.lkc-body');
  }
  const title = t => { const e = document.getElementById('lkcTitle'); if (e) e.innerHTML = t; };
  async function loadMembers() {
    const { data } = await sb.rpc('community_online'); members = data || [];
    const fresh = members.filter(m => !names.has(m.id)).map(m => m.id); await people(fresh);
    for (const m of members) { const n = names.get(m.id) || { roles: [] }; names.set(m.id, Object.assign(n, { name: m.name, shown: true, online: true, avatar: m.avatar || null, accent: m.accent || null })); }
  }
  async function showNotifications() {
    const { data } = await sb.from('community_notifications').select('*').order('created_at', { ascending: false }).limit(30);
    modal(`<h2>Notifications</h2>${(data || []).length ? `<div class="lkc-notes">${data.map(n => `<a class="lkc-note${n.read ? '' : ' new'}" href="${esc(n.link || '#/')}" data-n="${n.id}"><b>${esc(n.title)}</b><small>${ago(n.created_at)}</small></a>`).join('')}</div>` : '<p class="muted">Nothing yet. Mentions, replies, follows and ticket answers show here.</p>'}`, (d, close) => {
      for (const a of d.querySelectorAll('[data-n]')) a.addEventListener('click', () => close());
    });
    if ((data || []).some(n => !n.read)) { await sb.from('community_notifications').update({ read: true }).eq('read', false); loadNotifications(); }
  }
  // ----- home -----
  async function home() {
    const body = shell('home', '<p class="muted">Loading...</p>'); title('<b>Lantern Keeper Community</b>');
    const now = new Date().toISOString();
    const [ann, dev, ev, recent, online] = await Promise.all([
      sb.from('community_posts').select('id, title, body, created_at, author').eq('category', 'announcements').eq('status', 'visible').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      sb.from('community_posts').select('id, title, version, created_at').eq('category', 'devlog').eq('status', 'visible').order('created_at', { ascending: false }).limit(1),
      sb.from('community_posts').select('id, title, category, starts_at, ends_at, prize').in('category', ['events', 'giveaways']).eq('status', 'visible').or(`ends_at.is.null,ends_at.gt.${now}`).order('created_at', { ascending: false }).limit(4),
      sb.from('community_posts').select('id, title, category, replies, created_at, author').in('category', ['features', 'feedback', 'bugs', 'help', 'artwork', 'screenshots', 'general', 'discussion']).eq('status', 'visible').order('created_at', { ascending: false }).limit(6),
      Promise.resolve(members.length)]);
    await people([...(ann.data || []), ...(recent.data || [])].map(p => p.author));
    const catName = c => (byCat(c) || { name: c }).name;
    body.innerHTML = `<div class="lkc-home">
      <section class="card lkc-hero"><span class="kicker">Welcome</span><h2>The home of Lantern Keeper</h2><p>News and devlogs from the team, live chat with other keepers, ideas, bug reports and support.</p><p class="lkc-online-n"><span>Keepers online now:</span> <b>${online}</b></p>
        ${me ? '' : '<p><a class="btn btn-primary btn-sm" href="account.html?next=community.html">Sign in with your game account</a></p>'}</section>
      <div class="lkc-cols"><section><h3 class="lkc-h">Announcements</h3>${(ann.data || []).map(p => `<a class="card lkc-mini" href="#/p/${p.id}"><b>${esc(p.title)}</b><small>${ago(p.created_at)}</small><span>${esc(p.body.slice(0, 140))}${p.body.length > 140 ? '...' : ''}</span></a>`).join('') || '<p class="muted">No announcements yet.</p>'}
        ${(dev.data || [])[0] ? `<h3 class="lkc-h">Latest devlog</h3><a class="card lkc-mini" href="#/p/${dev.data[0].id}"><b>${dev.data[0].version ? 'v' + esc(dev.data[0].version) + ' · ' : ''}${esc(dev.data[0].title)}</b><small>${ago(dev.data[0].created_at)}</small></a>` : ''}</section>
      <section><h3 class="lkc-h">Events and giveaways</h3>${(ev.data || []).map(p => `<a class="card lkc-mini" href="#/p/${p.id}"><b>${esc(p.title)}</b><small>${p.category === 'giveaways' ? 'Giveaway' : 'Event'}${p.ends_at ? ' · until ' + day(p.ends_at) : ''}</small>${p.prize ? `<span>Prize: ${esc(p.prize)}</span>` : ''}</a>`).join('') || '<p class="muted">Nothing running right now.</p>'}
        <h3 class="lkc-h">New from keepers</h3>${(recent.data || []).map(p => `<a class="lkc-row" href="#/p/${p.id}"><span>${esc(p.title)}</span><small>${esc(catName(p.category))} · ${p.replies} repl${p.replies === 1 ? 'y' : 'ies'} · ${ago(p.created_at)}</small></a>`).join('') || '<p class="muted">Be the first: say hello in #general.</p>'}</section></div></div>`;
  }
  // ----- a live chat channel -----
  async function chat(ch) {
    const body = shell(ch.id, '<p class="muted">Loading...</p>'); title(`<b># ${esc(ch.name)}</b> <small>${esc(ch.description)}</small>`);
    const { data } = await sb.from('community_messages').select('*').eq('channel', ch.id).order('created_at', { ascending: false }).limit(80);
    const msgs = (data || []).reverse(); await people(msgs.map(m => m.author));
    let replyTo = null;
    body.innerHTML = `<div class="lkc-chat"><div class="lkc-msgs" role="log" aria-live="polite"></div>
      ${canPost(ch) ? `<form class="lkc-compose"><div class="lkc-replying" hidden></div><textarea name="body" rows="1" maxlength="1000" placeholder="Message #${esc(ch.name)} (@Name to mention someone)" aria-label="Your message"></textarea><button class="btn btn-primary btn-sm" type="submit">Send</button></form>`
        : `<p class="lkc-locked">${me ? (ch.post_role === 'club' ? 'This chat is for Supporter Club members.' : 'Only the team writes here.') : '<a href="account.html?next=community.html">Sign in</a> to chat.'}</p>`}</div>`;
    const box = body.querySelector('.lkc-msgs');
    const line = m => { const r = m.reply_to && msgs.find(x => x.id === m.reply_to), mine = me && m.author === me.id, mentioned = me && (m.mentions || []).includes(me.id);
      return `<div class="lkc-msg${mentioned ? ' me' : ''}${m.status !== 'visible' ? ' gone' : ''}" data-m="${m.id}">${avatar(m.author)}<div>${r ? `<p class="lkc-quote">↪ ${esc((names.get(r.author) || { name: 'A keeper' }).name)}: ${esc(r.body.slice(0, 80))}</p>` : ''}<p class="lkc-meta">${who(m.author)} <small>${ago(m.created_at)}${m.edited_at ? ' · edited' : ''}${m.status !== 'visible' ? ' · ' + esc(m.status) : ''}</small></p><p class="lkc-text">${textHtml(m.body, (names.get(m.author) || { roles: [] }).roles.some(x => x === 'owner' || x === 'developer'))}</p></div>
        <span class="lkc-acts">${me && canPost(ch) ? `<button data-reply="${m.id}" aria-label="Reply" title="Reply">${ico('reply')}</button>` : ''}${mine ? `<button data-del="${m.id}" aria-label="Delete" title="Delete">${ico('trash')}</button>` : me ? `<button data-rep="${m.id}" aria-label="Report" title="Report">${ico('flag')}</button>` : ''}${can('moderation') && !mine ? `<button data-hide="${m.id}" aria-label="Hide" title="Hide">${ico('ban')}</button>` : ''}</span></div>`; };
    const draw = () => { box.innerHTML = msgs.length ? msgs.map(line).join('') : '<p class="muted lkc-empty">No messages yet: say hello!</p>'; box.scrollTop = box.scrollHeight; wire(); };
    const wire = () => {
      for (const b of box.querySelectorAll('[data-reply]')) b.onclick = () => { replyTo = +b.dataset.reply; const m = msgs.find(x => x.id === replyTo), rp = body.querySelector('.lkc-replying'); rp.hidden = false; rp.innerHTML = `Replying to ${esc((names.get(m.author) || { name: '' }).name)} <button type="button" aria-label="Stop replying">✕</button>`; rp.querySelector('button').onclick = () => { replyTo = null; rp.hidden = true; }; body.querySelector('textarea').focus(); };
      for (const b of box.querySelectorAll('[data-del]')) b.onclick = async () => { try { await call('community', { action: 'message_delete', message: +b.dataset.del }); const m = msgs.find(x => x.id === +b.dataset.del); if (m) m.status = 'removed'; draw(); } catch (e) { modal(`<p>${esc(e.message)}</p>`); } };
      for (const b of box.querySelectorAll('[data-hide]')) b.onclick = async () => { try { await call('community', { action: 'message_moderate', message: +b.dataset.hide, status: 'hidden' }); const m = msgs.find(x => x.id === +b.dataset.hide); if (m) m.status = 'hidden'; draw(); } catch (e) { modal(`<p>${esc(e.message)}</p>`); } };
      for (const b of box.querySelectorAll('[data-rep]')) b.onclick = () => report({ message: +b.dataset.rep });
    };
    draw();
    const f = body.querySelector('.lkc-compose');
    if (f) { const ta = f.querySelector('textarea');
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
      f.onsubmit = async e => { e.preventDefault(); const text = ta.value.trim(); if (!text) return; ta.disabled = true;
        try { const r = await call('community', { action: 'message', channel: ch.id, body: text, reply_to: replyTo }); ta.value = ''; if (!msgs.some(m => m.id === r.message)) { const { data: row } = await sb.from('community_messages').select('*').eq('id', r.message).maybeSingle(); if (row && !msgs.some(m => m.id === row.id)) { await people([row.author]); msgs.push(row); draw(); } } replyTo = null; f.querySelector('.lkc-replying').hidden = true; } catch (err) { say(f, err.message); } ta.disabled = false; ta.focus(); }; }
    // new messages arrive live
    setLive(sb.channel('lkc-' + ch.id + '-' + Date.now()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `channel=eq.${ch.id}` }, async ev => {
      if (msgs.some(m => m.id === ev.new.id)) return; await people([ev.new.author]); msgs.push(ev.new); draw();
    }).subscribe());
  }
  // ----- a forum or news channel: the list -----
  async function threads(ch) {
    const body = shell(ch.id, '<p class="muted">Loading...</p>'); title(`<b>${esc(ch.name)}</b> <small>${esc(ch.description)}</small>`);
    const devlog = ch.category === 'devlog', version = devlog ? decodeURIComponent((location.hash.match(/[?&]v=([^&]+)/) || [])[1] || '') : '';
    let q = sb.from('community_posts').select('id, author, category, title, body, image, pinned, locked, state, replies, reactions, created_at, poll, version, published, publish_at, starts_at, ends_at, prize').eq('category', ch.category).neq('status', 'removed');
    if (version) q = q.eq('version', version);
    const { data, error } = await q.order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60);
    if (error) { body.innerHTML = `<p>Could not load: ${esc(error.message)}</p>`; return; }
    await people((data || []).map(p => p.author));
    const versions = devlog ? [...new Set((await sb.from('community_posts').select('version').eq('category', 'devlog').not('version', 'is', null)).data.map(x => x.version))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) : [];
    body.innerHTML = `<div class="lkc-list-head">${canPost(ch) ? `<a class="btn btn-primary btn-sm" href="#/new/${ch.id}">${ch.kind === 'news' ? 'New post' : 'New thread'}</a>` : ''}
        ${devlog && versions.length ? `<label class="lkc-ver">Version <select data-ver><option value="">All versions</option>${versions.map(v => `<option ${v === version ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : ''}</div>
      ${(data || []).map(p => `<article class="card hub-post${p.pinned ? ' pinned' : ''}"><a class="hub-post-link" href="#/p/${p.id}">
        ${p.pinned ? '<span class="hub-pin">Pinned</span>' : ''}${!p.published ? '<span class="hub-state">Draft</span>' : ''}${p.publish_at && Date.parse(p.publish_at) > Date.now() ? `<span class="hub-state">Scheduled ${day(p.publish_at)}</span>` : ''}${p.version ? `<span class="hub-cat">v${esc(p.version)}</span>` : ''}${p.state ? `<span class="hub-state st-${p.state.replace(/ /g, '-')}">${esc(p.state)}</span>` : ''}${p.poll ? '<span class="hub-pin">Poll</span>' : ''}${p.category === 'giveaways' ? `<span class="hub-pin">${p.ends_at && Date.parse(p.ends_at) < Date.now() ? 'Ended' : 'Open'}</span>` : ''}
        <h3>${esc(p.title)}</h3><p>${esc(p.body.slice(0, 220))}${p.body.length > 220 ? '...' : ''}</p></a>${p.image ? `<img class="hub-thumb" src="${esc(pubUrl(p.image))}" alt="" loading="lazy">` : ''}
        <p class="hub-meta">${who(p.author)} · ${ago(p.created_at)} · ${p.replies} repl${p.replies === 1 ? 'y' : 'ies'} · ${p.reactions} reaction${p.reactions === 1 ? '' : 's'}${p.locked ? ' · closed' : ''}${p.ends_at ? ' · until ' + day(p.ends_at) : ''}</p></article>`).join('') || `<p class="muted">Nothing here yet.${canPost(ch) ? ' Start the first one.' : ''}</p>`}`;
    const vs = body.querySelector('[data-ver]'); if (vs) vs.onchange = () => { location.hash = '#/c/' + ch.id + (vs.value ? '?v=' + encodeURIComponent(vs.value) : ''); };
  }
  // ----- one post (thread, news, devlog, event, giveaway) -----
  async function showPost(id) {
    const body = shell('', '<p class="muted">Loading...</p>');
    const { data: p } = await sb.from('community_posts').select('*').eq('id', id).maybeSingle();
    if (!p) { body.innerHTML = '<p>That post is gone, or it is in the Supporter Lounge.</p>'; return; }
    const ch = byCat(p.category) || { id: p.category, name: p.category }; title(`<a href="#/c/${ch.id}">${esc(ch.name)}</a>`);
    const [{ data: replies }, { data: reacts }, { data: votes }, gcount, mine] = await Promise.all([sb.from('community_replies').select('*').eq('post_id', id).order('created_at'),
      sb.from('community_reactions').select('kind, user_id').eq('post_id', id), p.poll ? sb.from('community_votes').select('choice, user_id').eq('post_id', id) : { data: [] },
      p.category === 'giveaways' ? sb.rpc('giveaway_count', { p_post: id }) : { data: 0 }, p.category === 'giveaways' && me ? sb.from('giveaway_entries').select('winner').eq('post_id', id).eq('user_id', me.id).maybeSingle() : { data: null }]);
    const saved = me ? !!(await sb.from('community_saves').select('post_id').eq('post_id', id).maybeSingle()).data : false;
    await people([p.author, ...(replies || []).map(r => r.author)]);
    const authorTeam = (names.get(p.author) || { roles: [] }).roles.some(r => r === 'owner' || r === 'developer');
    const own = r => me && r.author === me.id, myVote = (votes || []).find(v => me && v.user_id === me.id), total = (votes || []).length;
    const giveOpen = p.category === 'giveaways' && (!p.starts_at || Date.parse(p.starts_at) <= Date.now()) && (!p.ends_at || Date.parse(p.ends_at) > Date.now());
    body.innerHTML = `<article class="card hub-full">
        <p class="hub-meta">${who(p.author)} · ${ago(p.created_at)}${p.edited_at ? ' · edited' : ''}${p.version ? ` · <span class="hub-cat">v${esc(p.version)}</span>` : ''}${p.state ? ` · <span class="hub-state st-${p.state.replace(/ /g, '-')}">${esc(p.state)}</span>` : ''}${!p.published ? ' · <b>Draft</b>' : ''}${p.status !== 'visible' ? ` · <b>${esc(p.status)}</b>` : ''}</p>
        <h2>${esc(p.title)}</h2>${p.starts_at || p.ends_at ? `<p class="lkc-when">${p.starts_at ? 'From ' + day(p.starts_at) : ''}${p.ends_at ? ' until ' + day(p.ends_at) : ''}</p>` : ''}
        ${p.body ? `<p class="hub-body">${textHtml(p.body, authorTeam)}</p>` : ''}${p.image ? `<img class="hub-img" src="${esc(pubUrl(p.image))}" alt="${esc(p.title)}">` : ''}
        ${p.category === 'giveaways' ? `<div class="lkc-give"><p><b>Prize:</b> ${esc(p.prize || 'see above')} · ${gcount.data || 0} entr${gcount.data === 1 ? 'y' : 'ies'}</p>${mine.data ? `<p class="hub-ok">${mine.data.winner ? 'You won! We will contact you.' : 'You are in. Good luck!'}</p>` : giveOpen ? (me ? '<button class="btn btn-primary btn-sm" data-enter>Enter the giveaway</button>' : '<a href="account.html?next=community.html">Sign in to enter</a>') : '<p class="muted">This giveaway has ended.</p>'}<p class="muted small">No purchase needed. One entry per account. Winners are drawn by the team and announced here.</p></div>` : ''}
        ${p.poll ? `<div class="hub-poll">${p.poll.map((o, i) => { const n = (votes || []).filter(v => v.choice === i).length, pc = total ? Math.round(n / total * 100) : 0; return `<button class="hub-opt${myVote && myVote.choice === i ? ' on' : ''}" data-vote="${i}" ${myVote || !me || p.locked ? 'disabled' : ''}><span style="width:${myVote || !me ? pc : 0}%"></span><b>${esc(o)}</b>${myVote || !me ? ` <small>${pc}% (${n})</small>` : ''}</button>`; }).join('')}<p class="muted small">${total} vote${total === 1 ? '' : 's'}${!me ? ' · sign in to vote' : myVote ? ' · you voted' : ''}</p></div>` : ''}
        <div class="hub-reacts">${REACT.map(([k, e]) => { const n = (reacts || []).filter(r => r.kind === k).length, on = me && (reacts || []).some(r => r.kind === k && r.user_id === me.id); return `<button class="hub-react${on ? ' on' : ''}" data-react="${k}" ${me ? '' : 'disabled'} aria-pressed="${!!on}" aria-label="${k}">${e} ${n || ''}</button>`; }).join('')}</div>
        <p class="hub-tools">${me ? `<button class="hub-link" data-save aria-pressed="${saved}">${saved ? 'Saved' : 'Save'}</button> · ` : ''}<button class="hub-link" data-share>Copy link</button>${own(p) ? ' · <button class="hub-link" data-edit>Edit</button> <button class="hub-link" data-del>Delete</button>' : ''}${me && !own(p) ? `<button class="hub-link" data-report>Report</button>` : ''}
        ${can('moderation') ? ` · <button class="hub-link" data-mod="pinned:${!p.pinned}">${p.pinned ? 'Unpin' : 'Pin'}</button> <button class="hub-link" data-mod="locked:${!p.locked}">${p.locked ? 'Reopen' : 'Close replies'}</button> <button class="hub-link" data-mod="status:${p.status === 'visible' ? 'hidden' : 'visible'}">${p.status === 'visible' ? 'Hide' : 'Show'}</button>${!p.published && can('posts.publish') ? ' <button class="hub-link" data-mod="published:true">Publish</button>' : ''}${p.state ? ` <select data-state aria-label="State">${['open', 'planned', 'in progress', 'done', 'fixed', 'not planned'].map(s => `<option ${s === p.state ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}` : ''}</p></article>
      <h3 class="hub-h">${(replies || []).length} repl${(replies || []).length === 1 ? 'y' : 'ies'}</h3>
      ${(replies || []).map(r => `<div class="card hub-reply${r.status !== 'visible' ? ' hidden-r' : ''}"><div class="lkc-msg plain">${avatar(r.author)}<div><p class="lkc-meta">${who(r.author)} <small>${ago(r.created_at)}${r.edited_at ? ' · edited' : ''}${r.status !== 'visible' ? ' · ' + esc(r.status) : ''}</small></p><p class="hub-body">${textHtml(r.body, (names.get(r.author) || { roles: [] }).roles.some(x => x === 'owner' || x === 'developer'))}</p></div></div>
        <p class="hub-tools">${own(r) ? `<button class="hub-link" data-rdel="${r.id}">Delete</button>` : me ? `<button class="hub-link" data-rrep="${r.id}">Report</button>` : ''}${can('moderation') ? ` <button class="hub-link" data-rmod="${r.id}:${r.status === 'visible' ? 'hidden' : 'visible'}">${r.status === 'visible' ? 'Hide' : 'Show'}</button>` : ''}</p></div>`).join('')}
      ${p.locked ? '<p class="muted">Replies are closed.</p>' : me ? `<form class="hub-form card" data-reply><label>Your reply<textarea name="body" maxlength="2000" rows="3" required></textarea></label><button class="btn btn-primary" type="submit">Reply</button></form>` : '<p><a href="account.html?next=community.html">Sign in</a> to reply.</p>'}`;
    const act = async (b, after) => { try { await call('community', b); (after || (() => showPost(id)))(); } catch (e) { modal(`<h2>Not done</h2><p>${esc(e.message)}</p>`); } };
    const $$ = s => body.querySelectorAll(s), $1 = s => body.querySelector(s);
    for (const b of $$('[data-vote]')) b.onclick = async () => { const { error } = await sb.from('community_votes').insert({ post_id: id, user_id: me.id, choice: +b.dataset.vote }); if (error) modal(`<p>${esc(error.message)}</p>`); showPost(id); };
    for (const b of $$('[data-react]')) b.onclick = async () => { if (b.classList.contains('on')) await sb.from('community_reactions').delete().eq('post_id', id).eq('user_id', me.id).eq('kind', b.dataset.react); else await sb.from('community_reactions').insert({ post_id: id, user_id: me.id, kind: b.dataset.react }); showPost(id); };
    for (const b of $$('[data-mod]')) b.onclick = () => { const [k, v] = b.dataset.mod.split(':'); act({ action: 'moderate', post: id, [k]: k === 'status' ? v : v === 'true' }); };
    const sel = $1('[data-state]'); if (sel) sel.onchange = () => act({ action: 'moderate', post: id, state: sel.value });
    for (const b of $$('[data-rmod]')) b.onclick = () => { const [rid, s] = b.dataset.rmod.split(':'); act({ action: 'moderate', reply: +rid, status: s }); };
    for (const b of $$('[data-rdel]')) b.onclick = () => act({ action: 'delete', reply: +b.dataset.rdel });
    for (const b of $$('[data-rrep]')) b.onclick = () => report({ reply: +b.dataset.rrep });
    const rp = $1('[data-report]'); if (rp) rp.onclick = () => report({ post: id });
    const sv = $1('[data-save]'); if (sv) sv.onclick = async () => { const { error } = saved ? await sb.from('community_saves').delete().eq('post_id', id).eq('user_id', me.id) : await sb.from('community_saves').insert({ user_id: me.id, post_id: id }); if (error) modal(`<p>${esc(error.message)}</p>`); showPost(id); };
    const sh = $1('[data-share]'); if (sh) sh.onclick = () => copyLink(sh, `community.html#/p/${id}`);
    const en = $1('[data-enter]'); if (en) en.onclick = async () => { const { error } = await sb.from('giveaway_entries').insert({ post_id: id, user_id: me.id }); if (error) modal(`<p>${esc(error.message)}</p>`); showPost(id); };
    const del = $1('[data-del]'); if (del) del.onclick = () => modal('<h2>Delete this post?</h2><p>It is removed for everyone, with its picture.</p><div class="hub-actions"><button class="btn btn-primary" data-ok>Delete</button></div>', (d, close) => { d.querySelector('[data-ok]').onclick = () => { close(); act({ action: 'delete', post: id }, () => { location.hash = '#/c/' + ch.id; }); }; });
    const ed = $1('[data-edit]'); if (ed) ed.onclick = () => modal(`<h2>Edit your post</h2><form class="hub-form"><label>Title<input name="title" maxlength="120" value="${esc(p.title)}"></label><label>Text<textarea name="body" rows="8" maxlength="5000">${esc(p.body)}</textarea></label><button class="btn btn-primary" type="submit">Save</button></form>`, (d, close) => { const f = d.querySelector('form'); f.onsubmit = e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); close(); act({ action: 'edit', post: id, title: v.title, body: v.body }); }; });
    const rf = $1('[data-reply]'); if (rf) rf.onsubmit = e => { e.preventDefault(); act({ action: 'reply', post: id, body: new FormData(rf).get('body') }); };
  }
  function report(target) {
    modal(`<h2>Report this</h2><form class="hub-form"><label>Why<select name="reason">${['abuse', 'spam', 'cheating', 'personal information', 'not for children', 'other'].map(r => `<option>${r}</option>`).join('')}</select></label><label>Anything to add <small>(optional)</small><textarea name="details" maxlength="500" rows="3"></textarea></label><button class="btn btn-primary" type="submit">Send the report</button></form><p class="muted small">Moderators see it; the person you report doesn't see who reported.</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        const row = { reporter: me.id, reason: v.reason, details: v.details || null, [target.post ? 'post_id' : target.reply ? 'reply_id' : target.profile ? 'profile_id' : 'message_id']: target.post || target.reply || target.profile || target.message };
        const { error } = await sb.from('community_reports').insert(row); if (error) say(f, error.message); else { d.innerHTML = '<h2>Thank you</h2><p>A moderator will look at it.</p>'; setTimeout(close, 1500); } };
    });
  }
  // ----- a keeper's page (0.30.1): banner, picture, name and pronouns, roles and badges, about, numbers, posts and replies -----
  const BADGE = { 'lk.event.community-founder': ['Community Founder', 'Posted in the first week of the community'], 'lk.event.spotlight-2026': ['Spotlight 2026', 'A winner of Show Us Your Lighthouse'] };
  const copyLink = (b, path) => { const url = new URL(path, location.href).href, done = () => { const t = b.textContent; b.textContent = 'Link copied'; setTimeout(() => { b.textContent = t; }, 1500); };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Link', url)); else prompt('Link', url); };
  // the top of a profile, also the editor's live preview (k: name, pronouns, accent, bio, roles...; pics: picture and banner addresses)
  const profileHead = (k, pics, extra = '') => { const acc = ACCENT[k.accent] || ACCENT.gold;
    return `<div class="lkp-banner" style="--acc:${acc}${pics.banner ? `;background-image:url('${esc(pics.banner)}')` : ''}"></div>
      <div class="lkp-head"><span class="lkp-av" style="--acc:${acc}">${pics.avatar ? `<img src="${esc(pics.avatar)}" alt="">` : esc(String(k.name || '?').slice(0, 1).toUpperCase())}</span>
        <div class="lkp-id"><h2>${esc(k.name || 'Keeper')}${k.pronouns ? ` <small>${esc(k.pronouns)}</small>` : ''}</h2><p>${roleChips(k.roles || [])}${(k.badges || []).filter(x => BADGE[x]).map(x => `<span class="lkp-badge" title="${esc(BADGE[x][1])}">${ico('star')}${esc(BADGE[x][0])}</span>`).join('')}</p></div>${extra}</div>
      ${k.bio ? `<p class="lkp-bio">${esc(k.bio)}</p>` : ''}`; };
  async function showKeeper(id, tab = 'posts') {
    const body = shell('', '<p class="muted">Loading...</p>'); title('<b>A keeper</b>');
    const { data: k } = await sb.rpc('keeper_page', { p_user: id });
    if (!k) { body.innerHTML = `<div class="card"><p>This keeper's profile is hidden.</p>${me && me.id === id ? '<p><a class="btn btn-primary btn-sm" href="#/me">Show and edit your profile</a></p>' : ''}</div>`; return; }
    names.delete(id); await people([id]); title(`<b>${esc(k.name)}</b>`);
    const mine = me && me.id === id, follows = me && !mine ? !!(await sb.from('community_follows').select('follower').eq('follower', me.id).eq('followee', id).maybeSingle()).data : false;
    const [{ data: posts }, { data: replies }] = await Promise.all([
      sb.from('community_posts').select('id, title, category, created_at, replies').eq('author', id).eq('status', 'visible').order('created_at', { ascending: false }).limit(30),
      sb.from('community_replies').select('id, post_id, body, created_at').eq('author', id).eq('status', 'visible').order('created_at', { ascending: false }).limit(30)]);
    const sc = k.showcase || {}, n = names.get(id) || {};
    const acts = `<div class="lkp-acts">${mine ? `<a class="btn btn-primary btn-sm" href="#/me">${ico('edit')}<span>Edit profile</span></a>` : me ? `<button class="btn ${follows ? 'btn-ghost' : 'btn-primary'} btn-sm" data-follow aria-pressed="${follows}">${follows ? 'Following' : 'Follow'}</button>` : ''}
      <button class="lkc-iconbtn" data-share aria-label="Share this profile" title="Share">${ico('share')}</button>${me && !mine ? `<button class="lkc-iconbtn" data-report aria-label="Report this profile" title="Report">${ico('flag')}</button>` : ''}</div>`;
    body.innerHTML = `<section class="card lkp">${profileHead(k, { avatar: k.web_avatar && pubUrl(k.web_avatar), banner: k.web_banner && pubUrl(k.web_banner) }, acts)}
        <p class="lkp-facts">${n.online ? '<b class="lkc-online">● Online</b>' : k.last_seen ? `Seen ${ago(k.last_seen)}` : ''}<span>Joined ${day(k.joined)}</span>${k.discord ? `<span>Discord <b>${esc(k.discord)}</b></span>` : ''}<span>Friend code <b>${esc(k.friend_code || '-')}</b></span></p>
        <div class="hub-stats">${sc.level ? `<span><b>${esc(sc.level)}</b> level</span>` : ''}${sc.regions != null ? `<span><b>${esc(sc.regions)}</b> regions</span>` : ''}${sc.achievements != null ? `<span><b>${esc(sc.achievements)}</b> achievements</span>` : ''}<span><b>${k.posts}</b> posts</span><span><b>${k.replies || 0}</b> replies</span><span><b>${k.followers}</b> followers</span><span><b>${k.following}</b> following</span></div></section>
      <div class="lkp-tabs" role="tablist"><button role="tab" data-tab="posts" aria-selected="${tab === 'posts'}">Posts</button><button role="tab" data-tab="replies" aria-selected="${tab === 'replies'}">Replies</button></div>
      <div class="lkp-list" data-pane="posts" ${tab === 'posts' ? '' : 'hidden'}>${(posts || []).map(p => `<a class="lkc-row" href="#/p/${p.id}"><span>${esc(p.title)}</span><small>${esc((byCat(p.category) || { name: p.category }).name)} · ${ago(p.created_at)} · ${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}</small></a>`).join('') || '<p class="muted">No posts yet.</p>'}</div>
      <div class="lkp-list" data-pane="replies" ${tab === 'replies' ? '' : 'hidden'}>${(replies || []).map(r => `<a class="lkc-row" href="#/p/${r.post_id}"><span class="lkc-text">${esc(r.body.slice(0, 160))}${r.body.length > 160 ? '...' : ''}</span><small>${ago(r.created_at)}</small></a>`).join('') || '<p class="muted">No replies yet.</p>'}</div>`;
    for (const t of body.querySelectorAll('[data-tab]')) t.onclick = () => { for (const x of body.querySelectorAll('[data-tab]')) x.setAttribute('aria-selected', String(x === t)); for (const pn of body.querySelectorAll('[data-pane]')) pn.hidden = pn.dataset.pane !== t.dataset.tab; };
    const f = body.querySelector('[data-follow]'); if (f) f.onclick = async () => { f.disabled = true; if (follows) await sb.from('community_follows').delete().eq('follower', me.id).eq('followee', id); else await sb.from('community_follows').insert({ follower: me.id, followee: id }); showKeeper(id); };
    body.querySelector('[data-share]').onclick = e => copyLink(e.currentTarget, `community.html#/k/${id}`);
    const rp = body.querySelector('[data-report]'); if (rp) rp.onclick = () => report({ profile: id });
  }
  // ----- editing your profile: picture, banner, colour, name, pronouns, about, Discord, shown or hidden; a live preview -----
  // Pictures are cropped to the middle and made smaller in this browser, then saved as WebP: what a photo hides (where
  // and when it was taken, the camera) never leaves the device. A moderator can take a picture down if it is reported.
  async function squash(file, w, h) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Use a PNG, JPEG or WebP picture.');
    if (file.size > 20e6) throw new Error('That picture is too big (20 MB at most).');
    const src = await (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null) : null) || await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('That picture could not be opened.')); i.src = URL.createObjectURL(file); });
    const sw = src.width, sh = src.height, k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', .86)) || await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
    if (!blob) throw new Error('That picture could not be prepared.'); return blob;
  }
  // Animated pictures and banners (GIF) are a Supporter Club perk, like Discord Nitro: members and the team keep the
  // GIF as it is (3 MB at most; it is shown cropped to fit); anyone else's GIF is saved as a still picture. The server
  // checks this too (profiles_gif_guard).
  const canAnimate = () => isStaff() || myRoles.includes('subscriber');
  // (for tools/i18n-extract.js: t('Supporter Club perk: your picture and banner can be animated (GIF, up to 3 MB).') t('Animated pictures and banners (GIF) are a Supporter Club perk. A GIF you choose now is saved as a still picture.')
  //  t('Saved as a still picture: animated ones are a Supporter Club perk.') t('Animated pictures can be 3 MB at most.') t('Animated pictures are a Supporter Club perk.') t('Saved.'))
  async function editProfile() {
    if (!me) { const body = shell('me', ''); title('<b>Your profile</b>'); needSignIn(body, 'Sign in with your game account to set up your profile.', async () => { await loadMe(); heartbeat(); editProfile(); }); return; }
    await loadMe(); const body = shell('me', ''); title('<b>Edit your profile</b>');
    await profileEditor(body, () => { names.delete(me.id); location.hash = '#/k/' + me.id; });
  }
  // the editor itself, in the community (#/me) and on the account page
  async function profileEditor(box, saved) {
    const p = Object.assign({}, myProfile || {}), pageLink = PAGE === 'community' ? `#/k/${me.id}` : `community.html#/k/${me.id}`;
    const pics = { avatar: p.web_avatar ? pubUrl(p.web_avatar) : null, banner: p.web_banner ? pubUrl(p.web_banner) : null }, pending = {}, anim = canAnimate();
    const roles = myRoles.filter(r => r !== 'player'), badgesQ = (await sb.rpc('keeper_page', { p_user: me.id })).data, badges = badgesQ ? badgesQ.badges : [];
    const accept = 'image/png,image/jpeg,image/webp,image/gif';
    box.innerHTML = `<div class="lkp-edit">
      <form class="hub-form card lkp-form" novalidate>
        <div class="lkp-media"><div><p class="lkp-lab">Profile picture</p><p class="muted small">Square, shown everywhere you post.</p>
            <div class="lkp-pick"><label class="btn btn-ghost btn-sm">${ico('camera')}<span>Choose a picture</span><input type="file" accept="${accept}" data-file="avatar" class="sr-only"></label><button type="button" class="hub-link" data-clear="avatar">Remove</button></div></div>
          <div><p class="lkp-lab">Banner</p><p class="muted small">Wide, across the top of your page.</p>
            <div class="lkp-pick"><label class="btn btn-ghost btn-sm">${ico('image')}<span>Choose a banner</span><input type="file" accept="${accept}" data-file="banner" class="sr-only"></label><button type="button" class="hub-link" data-clear="banner">Remove</button></div></div></div>
        <p class="lkp-perk">${ico('star')}<span>${anim ? 'Supporter Club perk: your picture and banner can be animated (GIF, up to 3 MB).' : 'Animated pictures and banners (GIF) are a <a href="store.html">Supporter Club</a> perk. A GIF you choose now is saved as a still picture.'}</span></p>
        <p class="lkp-note">Keep pictures friendly: keepers of every age see them. Don't show your face if you are under 18, or anything personal like your school or address. Pictures are made smaller and saved without hidden details (such as where a photo was taken).</p>
        <label>Keeper name <small>(3 to 16 characters; your name in the game too)</small><input name="name" minlength="3" maxlength="16" required autocomplete="nickname" value="${esc(p.display_name || '')}"></label>
        <label>Pronouns <small>(optional, for example she/her, he/him, they/them)</small><input name="pronouns" maxlength="24" value="${esc(p.pronouns || '')}"></label>
        <fieldset class="lkp-acc"><legend>Colour</legend>${Object.entries(ACCENT).map(([k2, c]) => `<label title="${k2}"><input type="radio" name="accent" value="${k2}" ${(p.accent || 'gold') === k2 ? 'checked' : ''}><span style="--c:${c}"></span><b class="sr-only">${k2}</b></label>`).join('')}</fieldset>
        <label>About you <small>(300 characters)</small><textarea name="bio" maxlength="300" rows="3">${esc(p.bio || '')}</textarea></label>
        <label>Discord name <small>(optional: so friends can find you)</small><input name="discord" maxlength="40" value="${esc(p.discord || '')}"></label>
        <label class="hub-check"><input type="checkbox" name="show" ${p.show_profile ? 'checked' : ''}> Show my profile to other keepers (your page, your name and picture in the community, the leaderboard)</label>
        <div class="hub-actions"><button class="btn btn-primary" type="submit">Save profile</button><a class="btn btn-ghost" href="${pageLink}">View my page</a></div>
      </form>
      <aside class="lkp-preview" aria-label="Preview"><p class="lkp-lab">Preview</p><section class="card lkp" data-preview></section></aside></div>`;
    const f = box.querySelector('form'), pv = box.querySelector('[data-preview]');
    const draw = () => { const v = Object.fromEntries(new FormData(f)); pv.innerHTML = profileHead({ name: v.name, pronouns: v.pronouns, accent: v.accent, bio: v.bio, roles, badges }, pics); };
    f.addEventListener('input', draw); draw();
    for (const inp of box.querySelectorAll('[data-file]')) inp.onchange = async () => { const which = inp.dataset.file, file = inp.files[0]; if (!file) return;
      try { let blob, msg = which === 'avatar' ? 'Picture ready: save to keep it.' : 'Banner ready: save to keep it.';
        if (file.type === 'image/gif' && anim) { if (file.size > 3 * 1048576) throw new Error('Animated pictures can be 3 MB at most.'); blob = file; msg = 'Animated ' + (which === 'avatar' ? 'picture' : 'banner') + ' ready: save to keep it.'; }
        else { blob = which === 'avatar' ? await squash(file, 320, 320) : await squash(file, 1500, 500); if (file.type === 'image/gif') msg = 'Saved as a still picture: animated ones are a Supporter Club perk.'; }
        pending[which] = blob; if (pics[which] && pics[which].startsWith('blob:')) URL.revokeObjectURL(pics[which]); pics[which] = URL.createObjectURL(blob); draw(); say(f, msg, true); }
      catch (e) { say(f, e.message); } inp.value = ''; };
    for (const b of box.querySelectorAll('[data-clear]')) b.onclick = () => { pending[b.dataset.clear] = null; pics[b.dataset.clear] = null; draw(); };
    f.onsubmit = async ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(f)), btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const row = { display_name: String(v.name || '').trim(), pronouns: String(v.pronouns || '').trim().slice(0, 24) || null, accent: v.accent || null, bio: String(v.bio || '').trim().slice(0, 300) || null, discord: String(v.discord || '').trim().slice(0, 40) || null, show_profile: !!v.show };
        if (row.display_name.length < 3) throw new Error('Names need 3 to 16 characters.');
        const old = [], up = async (which, blob) => { const gif = blob.type === 'image/gif', path = `${me.id}/profile/${which}-${Date.now()}.${gif ? 'gif' : 'webp'}`; const { error } = await sb.storage.from('community').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }); if (error) throw new Error('The picture was not saved: ' + error.message); return path; };
        for (const which of ['avatar', 'banner']) if (which in pending) { const col = 'web_' + which; if (p[col]) old.push(p[col]); row[col] = pending[which] ? await up(which, pending[which]) : null; }
        if (row.display_name === p.display_name) delete row.display_name;
        const { error } = await sb.from('profiles').update(row).eq('id', me.id); if (error) throw new Error(/animated/i.test(error.message) ? 'Animated pictures are a Supporter Club perk.' : error.message);
        if (old.length) sb.storage.from('community').remove(old).then(() => {}, () => {});
        await loadMe(); say(f, 'Saved.', true); if (saved) saved();
      } catch (e) { say(f, 'Not saved: ' + e.message); btn.disabled = false; } };
  }
  // ----- the posts you saved -----
  async function savedPosts() {
    const body = shell('saved', '<p class="muted">Loading...</p>'); title('<b>Saved</b> <small>Only you see this list</small>');
    const { data } = await sb.from('community_saves').select('post_id, created_at, community_posts(id, title, category, created_at, replies, author)').order('created_at', { ascending: false }).limit(100);
    const list = (data || []).map(x => x.community_posts).filter(Boolean); await people(list.map(p => p.author));
    body.innerHTML = list.map(p => `<a class="lkc-row" href="#/p/${p.id}"><span>${esc(p.title)}</span><small>${esc((byCat(p.category) || { name: p.category }).name)} · ${esc((names.get(p.author) || { name: 'A keeper' }).name)} · ${ago(p.created_at)}</small></a>`).join('') || '<p class="muted">Nothing saved yet. Use Save on a post to keep it here.</p>';
  }
  function compose(chId) {
    if (!me) { location.href = 'account.html?next=community.html'; return; }
    const options = channels.filter(c => c.kind !== 'chat' && canPost(c)), pre = chan(chId);
    const body = shell(chId || '', ''); title('<b>New post</b>');
    body.innerHTML = `<form class="hub-form card" data-new>
      <label>Where<select name="channel">${options.map(c => `<option value="${c.id}" ${pre && pre.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Title<input name="title" maxlength="120" required></label>
      <label>Text<textarea name="body" maxlength="5000" rows="8"></textarea></label>
      <label>A picture <small>(optional: PNG, JPEG or WebP, up to 3 MB)</small><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label>A poll <small>(optional: one choice per line, 2 to 6)</small><textarea name="poll" rows="3" maxlength="400"></textarea></label>
      ${can('posts.publish', 'events.post') ? `<fieldset class="lkc-team"><legend>Team options</legend>
        <label>Version <small>(devlogs: for example 0.30)</small><input name="version" maxlength="10" placeholder="0.30"></label>
        <div class="hub-row"><label>Starts <small>(events, giveaways)</small><input name="starts_at" type="datetime-local"></label><label>Ends<input name="ends_at" type="datetime-local"></label></div>
        <label>Prize <small>(giveaways)</small><input name="prize" maxlength="200"></label>
        <label>Show from <small>(empty: now)</small><input name="publish_at" type="datetime-local"></label>
        <label class="hub-check"><input type="checkbox" name="draft"> Save as a draft (only the team sees it)</label></fieldset>` : ''}
      <p class="muted small">Be kind, no links (the team can share them), no personal details. Posts are public; moderators can remove what breaks the <a href="terms.html#5-co-op-chat-and-the-community">rules</a>.</p>
      <button class="btn btn-primary" type="submit">Post</button></form>`;
    const f = body.querySelector('[data-new]');
    f.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(f), btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        let image = null; const file = fd.get('image');
        if (file && file.size) { if (file.size > 3 * 1048576) throw new Error('Use a picture under 3 MB.'); const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          image = `${me.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`; const up = await sb.storage.from('community').upload(image, file, { contentType: file.type }); if (up.error) throw up.error; }
        const poll = String(fd.get('poll') || '').split('\n').map(s => s.trim()).filter(Boolean), c = chan(fd.get('channel'));
        const team = can('posts.publish', 'events.post') ? { version: fd.get('version') || undefined, starts_at: fd.get('starts_at') || undefined, ends_at: fd.get('ends_at') || undefined, prize: fd.get('prize') || undefined, publish_at: fd.get('publish_at') || undefined, published: fd.get('draft') ? false : undefined } : {};
        const r = await call('community', Object.assign({ action: 'post', category: c.category, title: fd.get('title'), body: fd.get('body'), image, poll: poll.length ? poll : undefined }, team));
        location.hash = '#/p/' + r.post;
      } catch (err) { say(f, err.message || String(err)); btn.disabled = false; }
    };
  }
  // ----- support tickets -----
  async function tickets() {
    if (!me) { location.href = 'account.html?next=community.html'; return; }
    const body = shell('tickets', '<p class="muted">Loading...</p>'); title('<b>My tickets</b> <small>Private: only you and support see them</small>');
    const { data } = await sb.from('support_tickets').select('*').eq('user_id', me.id).order('updated_at', { ascending: false });
    body.innerHTML = `<div class="lkc-list-head"><a class="btn btn-primary btn-sm" href="#/tickets/new">New ticket</a></div>
      ${(data || []).map(t => `<a class="lkc-row" href="#/tickets/${t.id}"><span>#${t.id} · ${esc(t.subject)}</span><small class="tk-${t.status}">${TICKET_STATE[t.status]} · ${ago(t.updated_at)}</small></a>`).join('') || '<p class="muted">No tickets. For account, payment or subscription problems, open one: support answers usually within a day.</p>'}`;
  }
  function newTicket(cat) {
    if (!me) { location.href = 'account.html?next=community.html'; return; }
    const body = shell('tickets', ''); title('<b>New ticket</b>');
    body.innerHTML = `<form class="hub-form card" data-tk><label>What is it about<select name="category">${TICKET_CATS.map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Subject<input name="subject" maxlength="120" required></label><label>Describe the problem <small>(what happened, when, on which device; never your password)</small><textarea name="body" rows="7" maxlength="4000" required></textarea></label>
      <label>A file <small>(optional: a screenshot or a receipt, PNG, JPEG, WebP, PDF or text, up to 5 MB)</small><input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"></label>
      <button class="btn btn-primary" type="submit">Send to support</button></form>`;
    const f = body.querySelector('[data-tk]');
    f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f), btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const { data: t, error } = await sb.from('support_tickets').insert({ user_id: me.id, category: fd.get('category'), subject: String(fd.get('subject')).trim() }).select('id').single(); if (error) throw error;
        const attachment = await upTicketFile(fd.get('file'));
        const { error: e2 } = await sb.from('ticket_messages').insert({ ticket_id: t.id, author: me.id, body: String(fd.get('body')).trim(), attachment }); if (e2) throw e2;
        location.hash = '#/tickets/' + t.id;
      } catch (err) { say(f, err.message || String(err)); btn.disabled = false; } };
  }
  async function upTicketFile(file) {
    if (!file || !file.size) return null; if (file.size > 5 * 1048576) throw new Error('Use a file under 5 MB.');
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt' })[file.type]; if (!ext) throw new Error('That kind of file can\'t be attached.');
    const path = `${me.id}/${Date.now().toString(36)}.${ext}`; const up = await sb.storage.from('tickets').upload(path, file, { contentType: file.type }); if (up.error) throw up.error; return path;
  }
  async function showTicket(id) {
    const body = shell('tickets', '<p class="muted">Loading...</p>');
    const { data: t } = await sb.from('support_tickets').select('*').eq('id', id).maybeSingle(); if (!t) { body.innerHTML = '<p>No such ticket.</p>'; return; }
    title(`<b>#${t.id} · ${esc(t.subject)}</b>`);
    const { data: msgs } = await sb.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'); await people((msgs || []).map(m => m.author));
    const files = {}; for (const m of msgs || []) if (m.attachment) { const { data: s } = await sb.storage.from('tickets').createSignedUrl(m.attachment, 600); if (s) files[m.id] = s.signedUrl; }
    body.innerHTML = `<p class="lkc-when">${esc((TICKET_CATS.find(c => c[0] === t.category) || [, t.category])[1])} · <b class="tk-${t.status}">${TICKET_STATE[t.status]}</b> · opened ${day(t.created_at)}</p>
      ${(msgs || []).map(m => `<div class="card hub-reply${m.author === t.user_id ? '' : ' lkc-staff'}"><div class="lkc-msg plain">${avatar(m.author)}<div><p class="lkc-meta">${m.author === t.user_id ? 'You' : '<b>Lantern Keeper support</b>'} <small>${ago(m.created_at)}</small></p><p class="hub-body">${esc(m.body).replace(/\n/g, '<br>')}</p>${files[m.id] ? `<p><a href="${esc(files[m.id])}" target="_blank" rel="noopener">Attached file</a></p>` : ''}</div></div></div>`).join('')}
      ${t.status === 'closed' ? '<p class="muted">This ticket is closed.</p><button class="btn btn-ghost btn-sm" data-reopen>Reopen it</button>'
        : `<form class="hub-form card" data-tr><label>Your reply<textarea name="body" rows="4" maxlength="4000" required></textarea></label><label>A file <small>(optional)</small><input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"></label>
          <div class="hub-actions"><button class="btn btn-primary" type="submit">Send</button><button class="btn btn-ghost" type="button" data-close>It's solved: close the ticket</button></div></form>`}`;
    const f = body.querySelector('[data-tr]'); if (f) f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f); try { const attachment = await upTicketFile(fd.get('file')); const { error } = await sb.from('ticket_messages').insert({ ticket_id: id, author: me.id, body: String(fd.get('body')).trim(), attachment }); if (error) throw error; showTicket(id); } catch (err) { say(f, err.message); } };
    const cl = body.querySelector('[data-close]'); if (cl) cl.onclick = async () => { await sb.from('support_tickets').update({ status: 'closed' }).eq('id', id); showTicket(id); };
    const ro = body.querySelector('[data-reopen]'); if (ro) ro.onclick = async () => { await sb.from('support_tickets').update({ status: 'open' }).eq('id', id); showTicket(id); };
  }
  async function search(q) {
    const body = shell('', '<p class="muted">Searching...</p>'); title(`<b>Search</b> <small>"${esc(q)}"</small>`);
    const { data } = await sb.rpc('community_search', { p_q: q });
    body.innerHTML = (data || []).map(r => r.kind === 'post' ? `<a class="lkc-row" href="#/p/${r.id}"><span>${esc(r.title)}</span><small>${esc((byCat(r.channel) || { name: r.channel }).name)} · ${ago(r.created_at)} · ${esc(r.snippet)}</small></a>`
      : `<a class="lkc-row" href="#/c/${esc(r.channel)}"><span>#${esc((chan(r.channel) || { name: r.channel }).name)}: ${esc(r.snippet)}</span><small>${ago(r.created_at)}</small></a>`).join('') || '<p class="muted">Nothing found.</p>';
  }
  async function following() {
    const body = shell('following', '<p class="muted">Loading...</p>'); title('<b>Following</b>');
    const { data: f } = await sb.from('community_follows').select('followee').eq('follower', me.id); const ids = (f || []).map(x => x.followee);
    if (!ids.length) { body.innerHTML = '<p class="muted">Follow keepers from their page to see their posts here.</p>'; return; }
    const { data } = await sb.from('community_posts').select('id, title, category, created_at, author, replies').in('author', ids).eq('status', 'visible').order('created_at', { ascending: false }).limit(40); await people(ids);
    body.innerHTML = (data || []).map(p => `<a class="lkc-row" href="#/p/${p.id}"><span>${esc(p.title)}</span><small>${esc(names.get(p.author).name)} · ${esc((byCat(p.category) || { name: p.category }).name)} · ${ago(p.created_at)}</small></a>`).join('') || '<p class="muted">Nothing from them yet.</p>';
  }
  async function route() {
    setLive(null);
    const hsh = location.hash.replace(/^#/, '') || '/', path = hsh.split('?')[0];
    let m;
    if ((m = path.match(/^\/c\/([a-z0-9-]+)$/)) && chan(m[1])) { const ch = chan(m[1]); if (!canRead(ch)) { shell(ch.id, '<p>This channel is for Supporter Club members. <a href="store.html">Join the Club</a>.</p>'); return; } return ch.kind === 'chat' ? chat(ch) : threads(ch); }
    if ((m = path.match(/^\/s\/([a-z]+)$/))) { const ch = byCat(m[1]); if (ch) { location.replace('#/c/' + ch.id); return; } } // (links from 0.30)
    if ((m = path.match(/^\/p\/(\d+)$/))) return showPost(+m[1]);
    if ((m = path.match(/^\/k\/([0-9a-f-]{36})$/))) return showKeeper(m[1]);
    if (path === '/me') return editProfile();
    if (path === '/saved' && me) return savedPosts();
    if ((m = path.match(/^\/new(?:\/([a-z0-9-]+))?$/))) return compose(m[1]);
    if (path === '/tickets') return tickets();
    if (path === '/tickets/new') return newTicket((hsh.match(/[?&]cat=([a-z]+)/) || [])[1]);
    if ((m = path.match(/^\/tickets\/(\d+)$/))) return showTicket(+m[1]);
    if ((m = path.match(/^\/search\/(.+)$/))) return search(decodeURIComponent(m[1]));
    if (path === '/following' && me) return following();
    return home();
  }
  async function startCommunity() {
    const { data } = await sb.from('community_channels').select('*').order('sort'); channels = data || [];
    await loadMembers(); await loadNotifications(); heartbeat();
    route(); window.addEventListener('hashchange', route);
    setInterval(() => { loadMembers().then(() => { const p = root.querySelector('.lkc-people'); if (p) p.innerHTML = `<p class="lkc-grp"><span>Online now</span> · ${members.length}</p>${members.slice(0, 40).map(m => `<a class="lkc-person" href="#/k/${m.id}">${avatar(m.id, 28)}<span>${esc((names.get(m.id) || m).name)}</span></a>`).join('') || '<p class="muted small">Nobody right now.</p>'}`; }); }, 60000);
  }

  // ---------- start ----------
  googleReturn().then(loadMe).then(() => new Promise(res => { if (me && myProfile && myProfile.consent_pending) consentPanel(res); else res(); })).then(() => {
    if (PAGE === 'store') renderStore();
    else if (PAGE === 'account') renderAccount();
    else if (PAGE === 'community') startCommunity();
    else if (PAGE === 'admin') { // 0.30.1: the dashboard (assets/admin.js) gets the sign-in and the helpers
      const api = { sb, CFG, call, modal, say, esc, day, ago, h, me, myRoles, myProfile, myPerms, can, isStaff, isTeam, isOwner: () => myRoles.includes('owner'), roleChips, signIn: () => { location.href = 'account.html?next=admin.html'; } };
      const go = () => window.LKAdmin ? window.LKAdmin(root, api) : setTimeout(go, 50); go();
    }
  });
})();
