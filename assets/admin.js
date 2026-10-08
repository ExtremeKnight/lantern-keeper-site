/* The Lantern Keeper dashboard (0.30.1): for the team (owners and developers) and moderators. Signed in with the same
   account as the game; every section is checked again by the server (row-level security and the functions), so this page
   only shows what the account may see and do. Passwords are never shown or set here: people set their own.
   Money: payment status comes from PayPal or from a person checking a GCash or bank history; test payments are marked
   and left out of the totals. Changes to prices and emails go through a review step first. */
window.LKAdmin = function (root, A) {
  'use strict';
  const { sb, call, modal, say, esc, day, ago } = A;
  const when = d => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const money = (c, cur) => (window.LKI18N ? LKI18N.money(c, cur) : (c / 100).toFixed(2)) + ' ' + cur;
  const local = d => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const iso = v => v ? new Date(v).toISOString() : null;
  const testTag = env => env && env !== 'live' ? ' <span class="hub-test">Test</span>' : '';
  const err = e => modal(`<h2>Not done</h2><p>${esc(e && e.message || e)}</p>`);
  const names = new Map(), mails = new Map();
  async function people(ids) {
    const need = [...new Set(ids)].filter(id => id && !names.has(id)); if (!need.length) return;
    const { data } = await sb.rpc('admin_names', { p_ids: need }); for (const id of need) { const p = (data || []).find(x => x.id === id) || {}; names.set(id, p.name || p.email || 'A keeper'); if (p.email) mails.set(id, p.email); }
  }
  const nm = id => id ? `<a href="community.html#/k/${id}" target="_blank" rel="noopener" title="${esc(mails.get(id) || '')}">${esc(names.get(id) || 'A keeper')}</a>${mails.get(id) ? ` <span class="adm-mailto">${esc(mails.get(id))}</span>` : ''}` : '<i>deleted account</i>';

  if (!A.me) { root.innerHTML = '<section class="card"><h2>The dashboard</h2><p>Sign in with a team or moderator account.</p><button class="btn btn-primary" data-in>Sign in</button></section>'; root.querySelector('[data-in]').onclick = A.signIn; return; }
  const can = A.can; // 0.30.1: what this account may open comes from the permissions page (the server checks again)
  if (!can('dashboard.open')) { root.innerHTML = '<section class="card"><h2>Not for this account</h2><p>The dashboard is for the Lantern Keeper team and moderators.</p></section>'; return; }
  const team = can('payments.view'), owner = A.isOwner();

  // section: [id, label, the permissions that open it (any one), draw]
  const SECTIONS = [
    ['overview', 'Overview', ['dashboard.open'], overview], ['device', 'Phone app and alerts', ['dashboard.open'], devicePage], ['payments', 'Payments', ['payments.view', 'payments.settings'], payments], ['subs', 'Subscriptions', ['subs.view'], subs], ['sales', 'Sales', ['payments.view'], sales],
    ['tickets', 'Tickets', ['tickets.handle'], tickets], ['moderation', 'Reports and mutes', ['moderation'], moderation], ['people', 'People and roles', ['people.view'], peoplePage], ['activity', 'Activity log', ['activity.view'], activity],
    ['perms', 'Permissions', ['perms.manage'], permsPage], ['site', 'Website', ['site.edit', 'site.settings'], sitePage],
    ['posts', 'News, devlogs, events', ['posts.publish', 'events.post'], posts], ['announce', 'In-game announcements', ['announce.ingame'], announce], ['switches', 'Game switches', ['game.switches'], switchesPage],
    ['faq', 'FAQ and chatbot', ['faq.edit'], faq], ['store', 'Products and prices', ['prices.edit', 'payments.settings'], store], ['emails', 'Email templates', ['emails.templates', 'emails.approve'], emails],
    ['campaigns', 'Email campaigns', ['emails.send'], campaigns], ['translations', 'Translations', ['translations.edit'], translations], ['rewards', 'Rewards and gifts', ['rewards.give'], rewards],
  ].filter(s => can(...s[2]));
  root.innerHTML = `<div class="adm"><nav class="adm-nav" aria-label="Dashboard sections"><p class="adm-who">${esc((A.myProfile && A.myProfile.display_name) || A.me.email)} ${A.roleChips(A.myRoles)}</p>
    <label class="adm-pick"><span class="sr-only">Section</span><select data-pick>${SECTIONS.map(([id, label]) => `<option value="${id}" data-label="${esc(label)}">${label}</option>`).join('')}</select></label>
    ${SECTIONS.map(([id, label]) => `<a href="#${id}" data-s="${id}">${label}<span class="adm-badge" data-badge="${id}" hidden></span></a>`).join('')}</nav><section class="adm-main" id="admMain" tabindex="-1"></section></div>`;
  root.querySelector('[data-pick]').onchange = e => { location.hash = '#' + e.target.value; };
  const main = root.querySelector('#admMain');
  async function route() {
    const id = (location.hash.slice(1).split('/')[0]) || 'overview', s = SECTIONS.find(x => x[0] === id) || SECTIONS[0];
    for (const a of root.querySelectorAll('[data-s]')) { a.classList.toggle('on', a.dataset.s === s[0]); if (a.dataset.s === s[0]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    root.querySelector('[data-pick]').value = s[0];
    main.innerHTML = '<p class="muted">Loading...</p>';
    try { await s[3](main, location.hash.slice(1).split('/').slice(1)); } catch (e) { main.innerHTML = `<p>Could not load: ${esc(e.message || e)}</p>`; }
  }
  window.addEventListener('hashchange', route);
  // the dashboard as an app (0.30.1): its own service worker, for notifications (scope /admin: never the rest of the site)
  const swReg = 'serviceWorker' in navigator ? navigator.serviceWorker.register('admin-sw.js', { scope: '/admin' }).catch(() => null) : Promise.resolve(null);
  let installEvt = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if ((location.hash || '').startsWith('#device')) route(); });
  const ALERT_KINDS = [['payments', 'A payment to check (GCash or bank)', ['payments.approve', 'payments.view']], ['tickets', 'A new support ticket', ['tickets.handle']], ['reports', 'A new report', ['moderation']]].filter(k => can(...k[2]));
  const alertPrefs = () => { try { return JSON.parse(localStorage.getItem('adm-alerts') || 'null') || ALERT_KINDS.map(k => k[0]); } catch (e) { return ALERT_KINDS.map(k => k[0]); } };
  let lastCounts = null;
  async function alertIfMore(n) { // while the dashboard is open (even in the background): a notification when something new waits
    if (lastCounts && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const want = alertPrefs(), msgs = { payments: 'A payment to check', tickets: 'A new support ticket', reports: 'A new report' };
      const reg = await swReg;
      for (const k of Object.keys(n)) if (want.includes(k === 'moderation' ? 'reports' : k) && n[k] > (lastCounts[k] || 0)) {
        const kind = k === 'moderation' ? 'reports' : k, opts = { body: `${n[k]} waiting now`, tag: kind, renotify: true, icon: 'assets/img/icon-192.png', data: { url: 'admin.html#' + k } };
        if (reg && reg.showNotification) reg.showNotification(msgs[kind], opts); else new Notification(msgs[kind], opts); }
    }
    lastCounts = n;
  }
  // what waits for the team, on the menu (and the phone's dropdown): payments to check, open tickets, open reports
  async function badges() {
    const { data } = await sb.rpc('admin_overview'); if (!data) return;
    const n = { payments: can('payments.view', 'payments.approve') ? data.pending_payments : 0, tickets: can('tickets.handle') ? data.open_tickets : 0, moderation: can('moderation') ? data.open_reports : 0 };
    for (const [id, v] of Object.entries(n)) { const b = root.querySelector(`[data-badge="${id}"]`), o = root.querySelector(`[data-pick] option[value="${id}"]`);
      if (b) { b.hidden = !v; b.textContent = v > 99 ? '99+' : v; b.setAttribute('aria-label', v + ' waiting'); } if (o) o.textContent = o.dataset.label + (v ? ` (${v})` : ''); }
    if (!document.querySelector('#appDialog:not([hidden])')) alertIfMore(n).catch(() => {});
    if (navigator.setAppBadge) { const t = Object.values(n).reduce((a, v) => a + (v || 0), 0); (t ? navigator.setAppBadge(t) : navigator.clearAppBadge()).catch(() => {}); } // (the number on the app's icon)
  }
  badges().catch(() => {}); addEventListener('lk-admin-poll', () => badges().catch(() => {})); // (tests ask for the counts at once)
  // lists refresh by themselves every minute while this tab is open (never while a dialog is open or something is being typed)
  setInterval(() => {
    badges().catch(() => {}); if (document.hidden) return; // (the counts and alerts keep going in the background; the lists refresh only when seen)
    const [id, sub] = location.hash.slice(1).split('/'), typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#admMain input, #admMain textarea, #admMain select');
    if (['overview', 'payments', 'tickets', 'moderation', 'subs'].includes(id || 'overview') && !(id === 'tickets' && sub) && !document.querySelector('.hub-modal') && !typing) route();
  }, 60000);
  route(); // (after everything the sections use is ready: a notification can open any section directly)
  const head = (title, sub, extra = '') => `<div class="adm-head"><div><h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${extra}</div>`;
  const confirmBox = (title, html, ok, label = 'Confirm') => modal(`<h2>${title}</h2>${html}<div class="hub-actions"><button class="btn btn-primary" data-ok>${label}</button><button class="btn btn-ghost" data-no>Cancel</button></div>`, (d, close) => {
    d.querySelector('[data-no]').onclick = close; d.querySelector('[data-ok]').onclick = async () => { d.querySelector('[data-ok]').disabled = true; try { await ok(); close(); } catch (e) { say(d, e.message || String(e)); d.querySelector('[data-ok]').disabled = false; } }; });

  // ---------- overview ----------
  async function overview(el) {
    const { data, error } = await sb.rpc('admin_overview'); if (error) throw error;
    const tile = (n, label, href, warn) => `<a class="card adm-tile${warn ? ' adm-warn' : ''}" href="${href}"><b>${esc(n)}</b><span>${label}</span></a>`;
    const [paid, tpl, camp, sw] = await Promise.all([
      can('payments.view') ? sb.from('store_orders').select('currency, amount_cents').eq('status', 'paid').eq('env', 'live').neq('method', 'grant').limit(10000) : { data: null },
      can('emails.approve') ? sb.from('email_templates').select('key', { count: 'exact', head: true }).eq('approved', false) : { count: null },
      can('emails.send') ? sb.from('email_campaigns').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'sending']) : { count: null },
      sb.from('game_switches').select('key, on, message')]);
    const byCur = {}; for (const o of paid.data || []) byCur[o.currency] = (byCur[o.currency] || 0) + o.amount_cents;
    const off = (sw.data || []).filter(x => x.key !== 'notice' && !x.on).map(x => x.key), notice = (sw.data || []).find(x => x.key === 'notice' && x.on);
    const bar = window.LKSiteEdit && LKSiteEdit.settings() && LKSiteEdit.settings().bar;
    el.innerHTML = head('Overview', 'Live numbers, refreshed every minute. Test and sandbox payments are not counted.')
      + `<h3>Waiting for the team</h3><div class="adm-tiles">${tile(data.pending_payments, 'Payments to check', '#payments', data.pending_payments)}${tile(data.open_tickets, 'Open tickets', '#tickets', data.open_tickets)}${tile(data.open_reports, 'Open reports', '#moderation', data.open_reports)}
        ${tpl.count != null ? tile(tpl.count, 'Email templates not approved (not sent)', '#emails', tpl.count) : ''}${camp.count != null ? tile(camp.count, 'Email campaigns scheduled or sending', '#campaigns') : ''}</div>
      <h3>Players</h3><div class="adm-tiles">${tile(data.players, 'Players', '#people')}${tile(data.new_week, 'New this week', '#people')}${tile(data.online, 'Online now', '#people')}${tile(data.club, 'Supporter Club members', '#subs')}</div>
      ${paid.data ? `<h3>Paid, all time</h3><div class="adm-tiles">${Object.keys(byCur).sort((a, b) => byCur[b] - byCur[a]).map(c => tile(money(byCur[c], c), 'Paid in ' + c, '#payments/paid')).join('') || '<p class="muted">Nothing paid yet.</p>'}</div>` : ''}
      <h3>The game and the website now</h3><div class="adm-tiles">${tile(off.length ? off.length + ' off' : 'All on', off.length ? 'Switched off: ' + off.join(', ') : 'Game switches', can('game.switches') ? '#switches' : '#overview', off.length)}
        ${tile(notice ? 'Shown' : 'None', notice ? 'Home screen message: ' + esc(notice.message.slice(0, 60)) : 'Home screen message', can('game.switches') ? '#switches' : '#overview', !!notice)}
        ${tile(bar && bar.on ? 'On' : 'Off', bar && bar.on ? 'Website announcement bar: ' + esc(String(bar.text || '').replace(/<[^>]+>/g, '').slice(0, 60)) : 'Website announcement bar', can('site.settings') ? '#site' : '#overview')}</div>`;
  }


  // ---------- payments ----------
  const ORDER = { created: 'Waiting for payment', review: 'To check', paid: 'Paid', rejected: 'Rejected', refunded: 'Refunded', cancelled: 'Cancelled', expired: 'Expired (nothing charged)' };
  const HOW = { paypal: 'PayPal', gcash: 'GCash', bank: 'Bank transfer', grant: 'Gift from the team' };
  async function payments(el, [st]) {
    const status = st || 'review', env = sessionStorage.getItem('adm-env') || 'live';
    let q = sb.from('store_orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') q = q.eq('status', status); if (env !== 'all') q = q.eq('env', env);
    const [{ data, error }, { data: prods }] = await Promise.all([q, sb.from('store_products').select('sku, label')]); if (error) throw error;
    await people((data || []).map(o => o.user_id)); const label = sku => ((prods || []).find(p => p.sku === sku) || { label: sku }).label;
    el.innerHTML = head('Payments', 'PayPal payments are confirmed by PayPal. GCash and bank payments wait here: check the reference and amount in your GCash or bank history, then approve or reject.',
      `<div class="adm-filters"><select data-st aria-label="Status">${['review', 'paid', 'created', 'rejected', 'refunded', 'expired', 'cancelled', 'all'].map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s === 'all' ? 'Every status' : ORDER[s]}</option>`).join('')}</select>
      <input data-find placeholder="Reference, payer, account or item" aria-label="Search these payments" value="${esc(sessionStorage.getItem('adm-pq') || '')}">
      <select data-env aria-label="Live or test"><option value="live" ${env === 'live' ? 'selected' : ''}>Real payments</option><option value="test" ${env === 'test' ? 'selected' : ''}>Test payments</option><option value="sandbox" ${env === 'sandbox' ? 'selected' : ''}>PayPal sandbox</option><option value="all" ${env === 'all' ? 'selected' : ''}>All</option></select></div>`)
      + `<p class="adm-count"><span data-shown></span> <button class="btn btn-ghost btn-sm" data-csv>Export these (CSV)</button></p><div class="adm-table" role="table">${(data || []).map(o => `<div class="adm-row" role="row" data-hay="${esc([label(o.sku), o.reference, o.payer_name, o.paypal_order, names.get(o.user_id), mails.get(o.user_id), o.id, o.note].filter(Boolean).join(' ').toLowerCase())}">
        <span><b>${esc(label(o.sku))}</b>${testTag(o.env)}<br><small>${nm(o.user_id)} · ${when(o.created_at)} · #${esc(o.id.slice(0, 8))}</small></span>
        <span>${o.method === 'grant' ? '<i>gift</i>' : esc(money(o.amount_cents, o.currency))}<br><small>${HOW[o.method] || esc(o.method)}${o.reference ? ' · ref <b>' + esc(o.reference) + '</b>' : ''}${o.payer_name ? ' · from ' + esc(o.payer_name) : ''}${o.paypal_order ? ' · PayPal ' + esc(o.paypal_order) : ''}</small>${o.note ? `<br><small class="muted">${esc(o.note)}</small>` : ''}</span>
        <span class="adm-state st-${o.status}">${ORDER[o.status] || esc(o.status)}</span>
        <span class="adm-acts">${o.status === 'review' ? `<label class="adm-pickrow"><input type="checkbox" data-sel="${o.id}" aria-label="Select this payment"></label><button class="btn btn-primary btn-sm" data-ok="${o.id}">Approve</button><button class="btn btn-ghost btn-sm" data-no="${o.id}">Reject</button>` : ''}${o.status === 'paid' && (o.method !== 'paypal' || o.sku !== 'lk.club.month') ? `<button class="btn btn-ghost btn-sm" data-ref="${o.id}">${o.method === 'paypal' ? 'Refund through PayPal' : o.method === 'grant' ? 'Take the gift back' : 'Refund'}</button>` : ''}</span></div>`).join('') || '<p class="muted">Nothing here.</p>'}</div>
      ${(data || []).some(o => o.status === 'review') ? `<div class="adm-bulk" data-bulk hidden><span data-bulkn></span><button class="btn btn-primary btn-sm" data-bulkok>Approve selected</button><button class="btn btn-ghost btn-sm" data-bulkno>Reject selected</button><button class="btn btn-ghost btn-sm" data-bulkall>Select all shown</button></div>` : ''}`;
    el.querySelector('[data-st]').onchange = e => { location.hash = '#payments/' + e.target.value; };
    el.querySelector('[data-env]').onchange = e => { sessionStorage.setItem('adm-env', e.target.value); route(); };
    const rowsEl = [...el.querySelectorAll('.adm-row[data-hay]')], filter = () => { const q = el.querySelector('[data-find]').value.trim().toLowerCase(); sessionStorage.setItem('adm-pq', q); let n = 0;
      for (const r of rowsEl) { const on = !q || r.dataset.hay.includes(q); r.hidden = !on; if (on) n++; } el.querySelector('[data-shown]').textContent = `${n} of ${rowsEl.length} shown`; return q; };
    el.querySelector('[data-find]').oninput = filter; filter();
    el.querySelector('[data-csv]').onclick = () => { const q = filter(), cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const list = (data || []).filter((o, i) => !rowsEl[i].hidden), lines = [['date', 'order', 'product', 'status', 'method', 'amount', 'currency', 'reference', 'payer', 'account', 'email', 'environment', 'note'].join(',')]
        .concat(list.map(o => [o.created_at, o.id, label(o.sku), o.status, o.method, (o.amount_cents / 100).toFixed(2), o.currency, o.reference, o.payer_name, names.get(o.user_id), mails.get(o.user_id), o.env, o.note].map(cell).join(',')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' })); a.download = `payments-${status}-${env}${q ? '-search' : ''}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); };
    const find = id => data.find(o => o.id === id), sum = o => `<dl class="hub-sum"><dt>Product</dt><dd>${esc(label(o.sku))}</dd><dt>Amount</dt><dd>${esc(money(o.amount_cents, o.currency))}</dd><dt>Method</dt><dd>${HOW[o.method] || esc(o.method)}</dd><dt>Reference</dt><dd>${esc(o.reference || '-')}</dd><dt>Payer</dt><dd>${esc(o.payer_name || '-')}</dd><dt>Account</dt><dd>${esc(names.get(o.user_id) || '-')}</dd></dl>`;
    for (const b of el.querySelectorAll('[data-ok]')) b.onclick = () => { const o = find(b.dataset.ok); confirmBox('Approve this payment?', sum(o) + `<p>Only approve after you have found <b>${esc(money(o.amount_cents, o.currency))}</b> with this reference in your ${HOW[o.method]} history. The player gets the purchase at once.</p>`, () => call('store', { action: 'review', order: o.id, approve: true }).then(route), 'Approve: I found the payment'); };
    for (const b of el.querySelectorAll('[data-no]')) b.onclick = () => { const o = find(b.dataset.no); confirmBox('Reject this payment?', sum(o) + '<p>The player sees "Not confirmed" and can open a ticket. Nothing is given.</p>', () => call('store', { action: 'review', order: o.id, approve: false }).then(route), 'Reject'); };
    for (const b of el.querySelectorAll('[data-ref]')) b.onclick = () => { const o = find(b.dataset.ref);
      const how = o.method === 'paypal' ? `<p><b>${esc(money(o.amount_cents, o.currency))} goes back to the player through PayPal now</b>, then the purchase is taken back from the account (Lumens, looks or the pack). This can't be undone.</p>`
        : o.method === 'grant' ? '<p>The gift is taken back from the account. No money is involved.</p>' : '<p>The purchase is taken back from the account (Lumens, looks or Club time). Send the money back yourself by GCash or bank first.</p>';
      confirmBox(o.method === 'paypal' ? 'Refund through PayPal?' : o.method === 'grant' ? 'Take this gift back?' : 'Refund this purchase?', sum(o) + how, () => call('store', { action: 'refund', order: o.id }).then(route), o.method === 'paypal' ? 'Refund ' + money(o.amount_cents, o.currency) : o.method === 'grant' ? 'Take it back' : 'Refund'); };
    // several payments at once: each one is checked the same way, and the summary shows every reference first
    const bulk = el.querySelector('[data-bulk]'), picked = () => [...el.querySelectorAll('[data-sel]:checked')].map(c => find(c.dataset.sel)).filter(Boolean);
    const showBulk = () => { const n = picked().length; if (bulk) { bulk.hidden = !n; bulk.querySelector('[data-bulkn]').textContent = n + ' selected'; } };
    for (const c of el.querySelectorAll('[data-sel]')) c.onchange = showBulk;
    if (bulk) {
      bulk.querySelector('[data-bulkall]').onclick = () => { for (const c of el.querySelectorAll('[data-sel]')) if (!c.closest('.adm-row').hidden) c.checked = true; showBulk(); };
      const many = approve => { const list = picked(); if (!list.length) return;
        const total = {}; for (const o of list) total[o.currency] = (total[o.currency] || 0) + o.amount_cents;
        confirmBox(`${approve ? 'Approve' : 'Reject'} ${list.length} payment${list.length === 1 ? '' : 's'}?`, `<table class="adm-diff"><thead><tr><th>Reference</th><th>Payer</th><th>Amount</th><th>Account</th></tr></thead><tbody>${list.map(o => `<tr><td>${esc(o.reference || '-')}</td><td>${esc(o.payer_name || '-')}</td><td>${esc(money(o.amount_cents, o.currency))}</td><td>${esc(names.get(o.user_id) || '-')}</td></tr>`).join('')}</tbody></table>
          <p>Total: <b>${Object.entries(total).map(([c, v]) => esc(money(v, c))).join(' + ')}</b>. ${approve ? 'Only approve the ones you found in your GCash or bank history: each player gets their purchase at once.' : 'Each player sees "Not confirmed" and can open a ticket.'}</p>`,
          async () => { let done = 0; const fails = []; for (const o of list) { try { await call('store', { action: 'review', order: o.id, approve }); done++; } catch (e) { fails.push(`${o.reference || o.id}: ${e.message}`); } }
            if (fails.length) throw new Error(`${done} done; not done: ${fails.join('; ')}`); route(); }, approve ? `Approve ${list.length}: I found them all` : `Reject ${list.length}`); };
      bulk.querySelector('[data-bulkok]').onclick = () => many(true); bulk.querySelector('[data-bulkno]').onclick = () => many(false);
    }
  }

  // ---------- subscriptions ----------
  async function subs(el) {
    const { data, error } = await sb.from('club_members').select('*').order('until', { ascending: false }).limit(300); if (error) throw error;
    await people((data || []).map(m => m.user_id)); const now = Date.now();
    el.innerHTML = head('Subscriptions', 'The Supporter Club. Renewing: PayPal will charge again on the date shown. Cancelled: no more payments, benefits until the date shown.')
      + `<div class="adm-table">${(data || []).map(m => { const on = Date.parse(m.until) > now, renew = on && m.paypal_sub && m.status === 'active';
        return `<div class="adm-row"><span><b>${nm(m.user_id)}</b>${testTag(m.env)}<br><small>${m.months || 0} month${m.months === 1 ? '' : 's'} so far${m.paypal_sub ? ' · PayPal ' + esc(m.paypal_sub) : ' · GCash or bank, month by month'}</small></span>
          <span>${m.amount_cents ? esc(money(m.amount_cents, m.currency)) + ' a month' : '-'}</span><span class="adm-state ${on ? 'st-paid' : 'st-cancelled'}">${!on ? 'Ended' : renew ? 'Renewing' : m.paypal_sub ? 'Cancelled' : 'Active'}</span><span>${renew ? 'Next payment ' : on ? 'Until ' : 'Ended '}${day(m.until)}</span></div>`; }).join('') || '<p class="muted">No members yet.</p>'}</div>`;
  }

  // ---------- tickets ----------
  const TK = { open: 'Open', answered: 'Answered', waiting: 'Waiting for the player', closed: 'Closed' };
  async function tickets(el, [id]) {
    if (id) return ticket(el, +id);
    const f = JSON.parse(sessionStorage.getItem('adm-tk') || '{"status":"active"}');
    let q = sb.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(200);
    if (f.status === 'active') q = q.in('status', ['open', 'waiting']); else if (f.status !== 'all') q = q.eq('status', f.status);
    if (f.mine) q = q.eq('assignee', A.me.id);
    const { data, error } = await q; if (error) throw error; await people((data || []).flatMap(t => [t.user_id, t.assignee]));
    el.innerHTML = head('Support tickets', 'Private between the player and support. Internal notes are never shown to the player.',
      `<div class="adm-filters"><select data-f aria-label="Status">${[['active', 'Needs an answer'], ['answered', 'Answered'], ['closed', 'Closed'], ['all', 'All']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select><label class="hub-check"><input type="checkbox" data-mine ${f.mine ? 'checked' : ''}> Mine</label></div>`)
      + `<div class="adm-table">${(data || []).map(t => `<a class="adm-row adm-link" href="#tickets/${t.id}"><span><b>#${t.id} · ${esc(t.subject)}</b><br><small>${nm(t.user_id)} · ${esc(t.category)} · ${ago(t.updated_at)}</small></span><span class="adm-pri pri-${t.priority}">${esc(t.priority)}</span><span class="adm-state tk-${t.status}">${TK[t.status]}</span><span><small>${t.assignee ? 'Assigned: ' + esc(names.get(t.assignee) || '') : 'Unassigned'}</small></span></a>`).join('') || '<p class="muted">No tickets here.</p>'}</div>`;
    const save = () => sessionStorage.setItem('adm-tk', JSON.stringify(f));
    el.querySelector('[data-f]').onchange = e => { f.status = e.target.value; save(); route(); };
    el.querySelector('[data-mine]').onchange = e => { f.mine = e.target.checked; save(); route(); };
  }
  async function ticket(el, id) {
    const [{ data: t }, { data: msgs }] = await Promise.all([sb.from('support_tickets').select('*').eq('id', id).maybeSingle(), sb.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at')]);
    if (!t) { el.innerHTML = '<p>No such ticket.</p>'; return; }
    await people([t.user_id, t.assignee, ...(msgs || []).map(m => m.author)]);
    const files = {}; for (const m of msgs || []) if (m.attachment) { const { data: s } = await sb.storage.from('tickets').createSignedUrl(m.attachment, 900); if (s) files[m.id] = s.signedUrl; }
    const orders = t.user_id ? (await sb.from('store_orders').select('id, sku, status, amount_cents, currency, method, created_at, env').eq('user_id', t.user_id).order('created_at', { ascending: false }).limit(5)).data || [] : [];
    el.innerHTML = `<p><a href="#tickets">&larr; All tickets</a></p>` + head(`#${t.id} · ${esc(t.subject)}`, `${nm(t.user_id)} · ${esc(t.category)} · opened ${when(t.created_at)}`)
      + `<div class="adm-split"><div>${(msgs || []).map(m => `<div class="card adm-msg${m.internal ? ' internal' : m.author === t.user_id ? '' : ' staff'}"><p class="adm-meta"><b>${m.author === t.user_id ? 'Player' : esc(names.get(m.author) || 'Support')}</b>${m.internal ? ' · <b>internal note</b>' : ''} · ${when(m.created_at)}</p><p>${esc(m.body).replace(/\n/g, '<br>')}</p>${files[m.id] ? `<p><a href="${esc(files[m.id])}" target="_blank" rel="noopener">Attached file</a></p>` : ''}</div>`).join('')}
        <form class="hub-form card" data-reply><label>Reply<textarea name="body" rows="5" maxlength="4000" required></textarea></label><label>Start from an FAQ answer <small>(optional)</small><select data-faq><option value="">Choose a question...</option></select></label><label class="hub-check"><input type="checkbox" name="internal"> Internal note (only staff see it)</label><button class="btn btn-primary" type="submit">Send</button></form></div>
        <aside class="card adm-side"><label>Status<select data-k="status">${Object.entries(TK).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>Priority<select data-k="priority">${['low', 'normal', 'high', 'urgent'].map(p => `<option ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <p>${t.assignee ? 'Assigned to ' + esc(names.get(t.assignee) || '') : 'Unassigned'} ${t.assignee !== A.me.id ? '<button class="btn btn-ghost btn-sm" data-me>Assign to me</button>' : ''}</p>
          ${orders.length ? `<h3>Recent orders</h3>${orders.map(o => `<p><small>${esc(o.sku)} · ${esc(money(o.amount_cents, o.currency))} · ${esc(ORDER[o.status] || o.status)}${o.env !== 'live' ? ' (test)' : ''} · ${day(o.created_at)}</small></p>`).join('')}` : ''}</aside></div>`;
    const upd = async patch => { const { error } = await sb.from('support_tickets').update(patch).eq('id', id); if (error) err(error); else ticket(el, id); };
    for (const s of el.querySelectorAll('[data-k]')) s.onchange = () => upd({ [s.dataset.k]: s.value });
    const me = el.querySelector('[data-me]'); if (me) me.onclick = () => upd({ assignee: A.me.id });
    const f = el.querySelector('[data-reply]');
    sb.from('faq').select('id, question, answer, lang').eq('published', true).order('sort').limit(300).then(({ data: fq }) => { const sel = f.querySelector('[data-faq]'); if (!sel || !fq) return;
      sel.innerHTML += fq.filter(x => !x.lang || x.lang === 'en').map(x => `<option value="${x.id}">${esc(x.question.slice(0, 90))}</option>`).join('');
      sel.onchange = () => { const x = fq.find(y => y.id === +sel.value); if (!x) return; const ta = f.querySelector('textarea'); ta.value = (ta.value ? ta.value.trimEnd() + '\n\n' : '') + String(x.answer).replace(/<[^>]+>/g, ''); sel.value = ''; ta.focus(); }; });
    f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f);
      const { error } = await sb.from('ticket_messages').insert({ ticket_id: id, author: A.me.id, body: String(fd.get('body')).trim(), internal: !!fd.get('internal') }); if (error) say(f, error.message); else ticket(el, id); };
  }

  // ---------- reports and mutes ----------
  const pic = path => `${A.CFG.url}/storage/v1/object/public/community/${path}`;
  async function moderation(el) {
    const [{ data: reps }, { data: mutes }] = await Promise.all([sb.from('community_reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100), sb.from('mutes').select('*').gt('until', new Date().toISOString())]);
    await people([...(reps || []).map(r => r.reporter), ...(mutes || []).map(m => m.user_id)]);
    const link = r => r.post_id ? `community.html#/p/${r.post_id}` : r.message_id ? `community.html#/search/${encodeURIComponent('#' + r.message_id)}` : '#';
    const target = async r => { if (r.profile_id) { const { data } = await sb.rpc('keeper_page', { p_user: r.profile_id }); return Object.assign({ author: r.profile_id, profile: true }, data ? { body: [data.name, data.pronouns, data.bio].filter(Boolean).join(' · '), web_avatar: data.web_avatar, web_banner: data.web_banner } : { body: '(hidden profile)' }); } if (r.reply_id) { const { data } = await sb.from('community_replies').select('post_id, body, author').eq('id', r.reply_id).maybeSingle(); return data; } if (r.message_id) { const { data } = await sb.from('community_messages').select('channel, body, author').eq('id', r.message_id).maybeSingle(); return data; } const { data } = await sb.from('community_posts').select('title, body, author').eq('id', r.post_id).maybeSingle(); return data; };
    const what = await Promise.all((reps || []).map(target)); await people(what.filter(Boolean).map(w => w.author));
    el.innerHTML = head('Reports and mutes', 'Reports from the website community. In-game chat reports are handled in the game (Settings > Moderation).')
      + `<h3>Open reports</h3><div class="adm-table">${(reps || []).map((r, i) => { const w = what[i] || {}; return `<div class="adm-row"><span><b>${esc(r.reason)}</b>${r.details ? ': ' + esc(r.details) : ''}<br><small>by ${nm(r.reporter)} · ${ago(r.created_at)}</small></span>
        <span><small>${r.profile_id ? 'Profile of' : r.message_id ? 'Chat message in #' + esc(w.channel || '') + ' by' : r.reply_id ? 'Reply by' : 'Post by'} ${nm(w.author)}</small><br>${w.profile ? `<span class="adm-prof">${w.web_avatar ? `<img src="${esc(pic(w.web_avatar))}" alt="Profile picture" width="48" height="48">` : ''}${w.web_banner ? `<img src="${esc(pic(w.web_banner))}" alt="Banner" width="144" height="48">` : ''}</span>` : ''}"${esc(String(w.title || w.body || '(removed)').slice(0, 140))}"</span>
        <span class="adm-acts">${r.reply_id && w.post_id ? `<a class="btn btn-ghost btn-sm" href="community.html#/p/${w.post_id}" target="_blank">Open</a>` : r.post_id ? `<a class="btn btn-ghost btn-sm" href="${link(r)}" target="_blank">Open</a>` : ''}${w.author ? `<button class="btn btn-ghost btn-sm" data-mute="${w.author}">Mute author</button>` : ''}${r.message_id ? `<button class="btn btn-ghost btn-sm" data-hidemsg="${r.message_id}">Hide message</button>` : ''}${r.profile_id ? `<a class="btn btn-ghost btn-sm" href="community.html#/k/${r.profile_id}" target="_blank">Open</a>${w.web_avatar ? `<button class="btn btn-ghost btn-sm" data-clear="${r.profile_id}:avatar">Remove picture</button>` : ''}${w.web_banner ? `<button class="btn btn-ghost btn-sm" data-clear="${r.profile_id}:banner">Remove banner</button>` : ''}<button class="btn btn-ghost btn-sm" data-clear="${r.profile_id}:bio">Remove about text</button>` : ''}<label class="adm-pickrow"><input type="checkbox" data-rsel="${r.id}" aria-label="Select this report"></label><button class="btn btn-primary btn-sm" data-done="${r.id}">Handled</button></span></div>`; }).join('') || '<p class="muted">No open reports.</p>'}</div>
      ${(reps || []).length > 1 ? '<div class="adm-bulk" data-rbulk hidden><span data-rbulkn></span><button class="btn btn-primary btn-sm" data-rbulkok>Mark selected handled</button><button class="btn btn-ghost btn-sm" data-rbulkall>Select all</button></div>' : ''}
      <h3>Muted now</h3><div class="adm-table">${(mutes || []).map(m => `<div class="adm-row"><span>${nm(m.user_id)}<br><small>${esc(m.reason)}</small></span><span>until ${when(m.until)}</span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-unmute="${m.user_id}">Lift</button></span></div>`).join('') || '<p class="muted">Nobody is muted.</p>'}</div>`;
    for (const b of el.querySelectorAll('[data-done]')) b.onclick = () => call('community', { action: 'resolve', report: +b.dataset.done }).then(route, err);
    const rb = el.querySelector('[data-rbulk]'), rpicked = () => [...el.querySelectorAll('[data-rsel]:checked')].map(c => +c.dataset.rsel);
    const rshow = () => { if (rb) { rb.hidden = !rpicked().length; rb.querySelector('[data-rbulkn]').textContent = rpicked().length + ' selected'; } };
    for (const c of el.querySelectorAll('[data-rsel]')) c.onchange = rshow;
    if (rb) { rb.querySelector('[data-rbulkall]').onclick = () => { for (const c of el.querySelectorAll('[data-rsel]')) c.checked = true; rshow(); };
      rb.querySelector('[data-rbulkok]').onclick = () => { const ids = rpicked(); confirmBox(`Mark ${ids.length} reports handled?`, '<p>They leave the list of open reports. Nothing is hidden or muted by this: do that first where it is needed.</p>', async () => { for (const id of ids) await call('community', { action: 'resolve', report: id }); route(); }, `Mark ${ids.length} handled`); }; }
    // a profile: the picture, banner or about text is taken down, the file removed from storage, and the keeper told
    for (const b of el.querySelectorAll('[data-clear]')) b.onclick = async () => { const [user, what] = b.dataset.clear.split(':'); b.disabled = true;
      const { data, error } = await sb.rpc('mod_clear_profile', { p_user: user, p_what: what }); if (error) return err(error);
      if (data) await sb.storage.from('community').remove([data]); route(); };
    for (const b of el.querySelectorAll('[data-hidemsg]')) b.onclick = () => call('community', { action: 'message_moderate', message: +b.dataset.hidemsg, status: 'hidden' }).then(route, err);
    for (const b of el.querySelectorAll('[data-unmute]')) b.onclick = async () => { const { error } = await sb.from('mutes').delete().eq('user_id', b.dataset.unmute); if (error) err(error); else route(); };
    for (const b of el.querySelectorAll('[data-mute]')) b.onclick = () => muteBox(b.dataset.mute);
  }
  function muteBox(user) {
    modal(`<h2>Mute ${esc(names.get(user) || 'this keeper')}</h2><form class="hub-form"><label>For<select name="h"><option value="1">1 hour</option><option value="24" selected>1 day</option><option value="168">1 week</option><option value="720">30 days</option></select></label><label>Reason (they see it)<input name="reason" maxlength="200" required></label><button class="btn btn-primary" type="submit">Mute</button></form><p class="muted small">A muted keeper can read but not post, chat or reply, in the game and on the website.</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
        const { error } = await sb.from('mutes').upsert({ user_id: user, until: new Date(Date.now() + v.h * 36e5).toISOString(), reason: v.reason, by: A.me.id }); if (error) say(f, error.message); else { close(); route(); } }; });
  }

  // ---------- people and roles ----------
  async function peoplePage(el) {
    const q = sessionStorage.getItem('adm-q') || '';
    const { data, error } = await sb.rpc('admin_people', { p_q: q }); if (error) throw error;
    el.innerHTML = head('People and roles', 'Search by email, name or friend code. Passwords are never shown or set here: people reset their own from the sign-in screen.',
      `<form class="adm-filters" data-q><input name="q" placeholder="Email, name or friend code" value="${esc(q)}" aria-label="Search people"><button class="btn btn-ghost btn-sm">Search</button></form>`)
      + `<div class="adm-table">${(data || []).map(p => `<div class="adm-row"><span><b>${esc(p.name || '(no name)')}</b> ${A.roleChips(p.roles)}<br><small>${esc(p.email || '')} · joined ${day(p.created_at)}${p.last_seen ? ' · seen ' + ago(p.last_seen) : ''}</small></span>
        <span><small>${p.paid_orders} paid order${p.paid_orders === 1 ? '' : 's'}${p.club_until && Date.parse(p.club_until) > Date.now() ? ' · Club until ' + day(p.club_until) : ''}${p.muted_until && Date.parse(p.muted_until) > Date.now() ? ' · <b>muted</b>' : ''}${p.banned_until && Date.parse(p.banned_until) > Date.now() ? ' · <b>banned until ' + day(p.banned_until) + '</b>' : ''}</small></span>
        <span class="adm-acts"><button class="btn btn-ghost btn-sm" data-who="${p.id}">Details</button><button class="btn btn-ghost btn-sm" data-roles="${p.id}">Roles</button><button class="btn btn-ghost btn-sm" data-mute="${p.id}">Mute</button>${p.id !== A.me.id ? `<button class="btn btn-ghost btn-sm" data-ban="${p.id}">Ban</button>` : ''}</span></div>`).join('') || '<p class="muted">Nobody found.</p>'}</div>`;
    el.querySelector('[data-q]').onsubmit = e => { e.preventDefault(); sessionStorage.setItem('adm-q', new FormData(e.target).get('q').trim()); route(); };
    for (const p of data || []) names.set(p.id, p.name || p.email);
    for (const b of el.querySelectorAll('[data-mute]')) b.onclick = () => muteBox(b.dataset.mute);
    for (const b of el.querySelectorAll('[data-who]')) b.onclick = () => whoBox(data.find(x => x.id === b.dataset.who)).catch(err);
    for (const b of el.querySelectorAll('[data-ban]')) b.onclick = () => modal(`<h2>Ban ${esc(names.get(b.dataset.ban))}</h2><form class="hub-form"><label>Days (0 lifts a ban)<input name="days" type="number" min="0" max="3650" value="7"></label><button class="btn btn-primary" type="submit">Save</button></form><p class="muted small">A banned account can't sign in until then. Their purchases stay theirs.</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = e => { e.preventDefault(); call('admin', { action: 'ban', user: b.dataset.ban, days: +new FormData(f).get('days') }).then(() => { close(); route(); }, x => say(f, x.message)); }; });
    for (const b of el.querySelectorAll('[data-roles]')) b.onclick = () => rolesBox(data.find(x => x.id === b.dataset.roles)).catch(err);
  }

  // ---------- the dashboard as an app on this phone or computer, and its notifications ----------
  const b64key = k => { const p = '='.repeat((4 - k.length % 4) % 4), raw = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
  async function devicePage(el) {
    const within = (pr, ms, v) => Promise.race([Promise.resolve(pr).catch(() => v), new Promise(r => setTimeout(() => r(v), ms))]); // (a browser without a push service may never answer: the page still shows)
    const reg = await within(swReg, 4000, null), sub = reg && reg.pushManager ? await within(reg.pushManager.getSubscription(), 4000, null) : null;
    const key = await within(call('team-push', { action: 'key' }).then(r => r.key), 8000, null);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone, ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission, want = alertPrefs();
    const { data: mine } = await sb.from('team_push_subs').select('endpoint, kinds, device, last_ok, created_at').eq('user_id', A.me.id);
    el.innerHTML = head('Phone app and alerts', 'Put the dashboard on your phone\'s home screen (or your computer\'s), and be told when something waits for you. Each person chooses on each device; you only get what your permissions let you act on.')
      + `<div class="card adm-dev"><h3>The app</h3>${standalone ? '<p>This is the installed dashboard.</p>' : installEvt ? '<p><button class="btn btn-primary btn-sm" data-install>Install the dashboard</button></p>'
        : ios ? '<p>On an iPhone or iPad: open this page in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>. Notifications on iPhone need iOS 16.4 or newer and the dashboard opened from the home screen.</p>'
        : '<p>In Chrome or Edge: the menu (⋮), then <b>Install app</b> or <b>Add to Home screen</b>. Other browsers: bookmark this page.</p>'}</div>
      <div class="card adm-dev"><h3>Alerts on this device</h3>${ALERT_KINDS.length ? ALERT_KINDS.map(([k, l]) => `<label class="hub-check"><input type="checkbox" data-kind="${k}" ${want.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('') : '<p class="muted">Your permissions have no alerts.</p>'}
        <p class="muted small">${perm === 'unsupported' ? 'This browser can\'t show notifications.' : perm === 'denied' ? 'Notifications are blocked for this site in the browser\'s settings: allow them there first.' : sub ? 'On: alerts come even when the dashboard is closed.' : key ? 'Off on this device.' : 'While the dashboard is open (even in the background), alerts work now. When it is closed too: after the owner sets the push keys once (node tools/team-push-keys.js).'}</p>
        <p class="adm-acts">${perm !== 'unsupported' && perm !== 'denied' ? `<button class="btn btn-primary btn-sm" data-alerts-on>${sub ? 'Save the choices' : 'Turn alerts on'}</button>` : ''}${sub ? '<button class="btn btn-ghost btn-sm" data-alerts-off>Turn off on this device</button><button class="btn btn-ghost btn-sm" data-alerts-test>Send me a test</button>' : ''}</p></div>
      <div class="card adm-dev"><h3>Your devices with alerts</h3>${(mine || []).length ? `<ul class="adm-list">${mine.map(m => `<li>${esc(m.device || 'A device')} · ${esc((m.kinds || []).join(', '))} · since ${day(m.created_at)}${m.last_ok ? ' · last alert ' + ago(m.last_ok) : ''}${sub && sub.endpoint === m.endpoint ? ' · <b>this one</b>' : ''}</li>`).join('')}</ul>` : '<p class="muted">None yet.</p>'}</div>`;
    const ins = el.querySelector('[data-install]'); if (ins) ins.onclick = async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => null); installEvt = null; route(); };
    const kinds = () => [...el.querySelectorAll('[data-kind]:checked')].map(c => c.dataset.kind);
    const on = el.querySelector('[data-alerts-on]'); if (on) on.onclick = async () => {
      try { localStorage.setItem('adm-alerts', JSON.stringify(kinds())); } catch (e) { /* this visit */ }
      const p = await Notification.requestPermission(); if (p !== 'granted') return modal('<h2>Notifications are not allowed</h2><p>The browser said no. Allow notifications for this site in its settings, then try again.</p>');
      if (!key || !reg || !reg.pushManager) { say(el.querySelector('.adm-dev:nth-child(3)') || el, 'Alerts on while the dashboard is open.', true); return route(); }
      try { const s2 = sub || await within(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(key) }), 15000, null);
        if (!s2) { modal('<h2>Alerts on while the dashboard is open</h2><p>This browser has no push service, so alerts come only while the dashboard is open (even in the background).</p>'); return route(); }
        const j = s2.toJSON();
        const device = (/(iPhone|iPad|Android|Windows|Mac|Linux)/.exec(navigator.userAgent) || ['a device'])[0] + ' · ' + ((/(Edg|Chrome|Firefox|Safari)\//.exec(navigator.userAgent) || ['', 'a browser'])[1]).replace('Edg', 'Edge');
        const { error } = await sb.from('team_push_subs').upsert({ endpoint: j.endpoint, user_id: A.me.id, p256dh: j.keys.p256dh, auth: j.keys.auth, kinds: kinds(), device }); if (error) throw error;
        route(); } catch (e) { err(e); } };
    const off = el.querySelector('[data-alerts-off]'); if (off) off.onclick = async () => { await sb.from('team_push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe().catch(() => {}); route(); };
    const test = el.querySelector('[data-alerts-test]'); if (test) test.onclick = () => call('team-push', { action: 'test' }).then(r => modal(`<h2>${r.sent ? 'Sent' : 'Not sent'}</h2><p>${r.sent} of your ${r.devices} device${r.devices === 1 ? '' : 's'} got it.</p>`), err);
  }

  // ---------- the activity log: who did what, and when ----------
  const ACT = { 'payment.approved': 'approved a payment', 'payment.rejected': 'rejected a payment', 'payment.refunded': 'refunded a payment', 'gift.given': 'gave a gift', 'gift.revoked': 'took a gift back',
    'role.given': 'gave a role', 'role.taken': 'took a role', 'role.custom.insert': 'made a custom role', 'role.custom.update': 'renamed a custom role', 'role.custom.delete': 'deleted a custom role',
    'permission.allowed': 'allowed a permission', 'permission.taken': 'took a permission', 'permission.person.set': 'set one person\'s permission', 'permission.person.cleared': 'cleared one person\'s permission',
    'ban.set': 'banned', 'ban.lifted': 'lifted a ban', 'mute.set': 'muted', 'mute.lifted': 'lifted a mute', 'reward.given': 'gave a reward', 'reward.taken': 'took a reward back',
    'report.handled': 'handled a report', 'report.actioned': 'acted on a game report', 'report.dismissed': 'dismissed a game report', 'switch.changed': 'changed a game switch',
    'email.approved': 'approved an email', 'email.unapproved': 'stopped an email', 'email.edited': 'edited an email', 'prices.changed': 'changed prices', 'payment-details.changed': 'changed the payment details',
    'announcement.insert': 'posted an in-game announcement', 'announcement.update': 'changed an in-game announcement', 'announcement.delete': 'removed an in-game announcement',
    'faq.insert': 'added an FAQ answer', 'faq.update': 'changed an FAQ answer', 'faq.delete': 'removed an FAQ answer', 'translation.insert': 'added a translation', 'translation.update': 'changed a translation', 'translation.delete': 'removed a translation',
    'chat.slow': 'slowed a game chat channel', 'chat.lock': 'locked or opened a game chat channel', 'moderation.game-chat.removed': 'removed a game chat message' };
  const actName = a => ACT[a] || (a.startsWith('campaign.') ? 'email campaign: ' + a.slice(9) : a.startsWith('moderation.') ? 'moderated (' + a.slice(11).replace(/\./g, ' ') + ')' : a);
  const ACT_GROUPS = [['', 'Everything'], ['payment.,gift.', 'Payments and gifts'], ['role.,permission.', 'Roles and permissions'], ['ban.,mute.,moderation.,report.,chat.', 'Moderation'], ['switch.,announcement.', 'Game switches and announcements'], ['email.,campaign.', 'Emails'], ['prices.,payment-details.', 'Prices and payment details'], ['faq.,translation.', 'FAQ and translations']];
  async function activity(el) {
    const f = JSON.parse(sessionStorage.getItem('adm-act') || '{}'), limit = f.limit || 100;
    let q = sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
    if (f.group) q = q.or(f.group.split(',').map(g => `action.like.${g}*`).join(','));
    if (f.from) q = q.gte('at', new Date(f.from).toISOString()); if (f.to) q = q.lte('at', new Date(f.to + 'T23:59:59').toISOString());
    if (f.who) q = q.eq('actor', f.who);
    const { data, error } = await q; if (error) throw error;
    const ids = []; for (const x of data || []) { ids.push(x.actor); const m = /^user:(.+)$/.exec(x.target || ''); if (m) ids.push(m[1]); } await people(ids);
    const target = x => { const m = /^(user|order|role|switch|email|product|campaign|report|post|reply|message|chat|announcement|faq|translation|channel|game-report):(.+)$/.exec(x.target || ''); if (!m) return esc(x.target || '');
      return m[1] === 'user' ? nm(m[2]) : m[1] === 'post' ? `<a href="community.html#/p/${esc(m[2])}" target="_blank">post ${esc(m[2])}</a>` : m[1] === 'order' ? 'order #' + esc(m[2].slice(0, 8)) : esc(m[1] + ' ' + m[2]); };
    const detail = x => { const d = x.details || {}, bits = [];
      if (d.amount != null && d.currency) bits.push(money(d.amount, d.currency)); for (const k of ['sku', 'reference', 'payer', 'role', 'permission', 'reason', 'title', 'subject', 'question', 'text', 'message', 'reward', 'note'])
        if (d[k] != null && d[k] !== '') bits.push(`${k}: ${String(d[k]).slice(0, 100)}`);
      if ('on' in d) bits.push(d.on ? 'on' : 'OFF'); if ('allow' in d && d.allow != null) bits.push(d.allow ? 'allow' : 'deny'); if (d.days) bits.push(d.days + ' days'); if (d.until) bits.push('until ' + when(d.until));
      return esc(bits.join(' · ')); };
    el.innerHTML = head('Activity log', 'What the team did, who and when: payments, gifts, roles, permissions, bans, mutes, moderation, prices, payment details, switches, emails and announcements. It can\'t be changed. Website edits have their own history (Website).',
      `<form class="adm-filters" data-af><select name="group" aria-label="Kind">${ACT_GROUPS.map(([v, l]) => `<option value="${v}" ${(f.group || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="date" name="from" value="${esc(f.from || '')}" aria-label="From"><input type="date" name="to" value="${esc(f.to || '')}" aria-label="Until"><button class="btn btn-ghost btn-sm">Show</button>${f.who ? `<button class="btn btn-ghost btn-sm" type="button" data-allwho>Everyone (now: ${esc(names.get(f.who) || 'one person')})</button>` : ''}</form>`)
      + `<p class="adm-count">${(data || []).length} shown <button class="btn btn-ghost btn-sm" data-acsv>Export these (CSV)</button></p><div class="adm-table">${(data || []).map(x => `<div class="adm-row"><span><b>${x.actor ? `<button class="hub-link" data-who="${x.actor}">${esc(names.get(x.actor) || 'A team member')}</button>` : 'The system'}</b> ${esc(actName(x.action))}<br><small>${target(x)}</small></span><span><small>${detail(x)}</small></span><span><small>${when(x.at)}</small></span></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div>
      ${(data || []).length === limit ? '<p><button class="btn btn-ghost btn-sm" data-amore>Show more</button></p>' : ''}`;
    const save = () => sessionStorage.setItem('adm-act', JSON.stringify(f));
    el.querySelector('[data-af]').onsubmit = e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); Object.assign(f, { group: v.group, from: v.from, to: v.to, limit: 100 }); save(); route(); };
    const aw = el.querySelector('[data-allwho]'); if (aw) aw.onclick = () => { delete f.who; save(); route(); };
    for (const b of el.querySelectorAll('[data-who]')) b.onclick = () => { f.who = b.dataset.who; f.limit = 100; save(); route(); };
    const more = el.querySelector('[data-amore]'); if (more) more.onclick = () => { f.limit = limit + 200; save(); route(); };
    el.querySelector('[data-acsv]').onclick = () => { const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [['when', 'who', 'what', 'target', 'details'].join(',')].concat((data || []).map(x => [x.at, names.get(x.actor) || x.actor || 'system', actName(x.action), x.target, JSON.stringify(x.details)].map(cell).join(',')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' })); a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); };
  }

  // ---------- sales: by week or month, in each currency; the Supporter Club month by month ----------
  async function sales(el) {
    const f = JSON.parse(sessionStorage.getItem('adm-sales') || '{"by":"week"}');
    const since = new Date(Date.now() - (f.by === 'month' ? 365 : 7 * 26) * 864e5).toISOString();
    const [{ data: orders, error }, { data: prods }, { data: club }] = await Promise.all([
      sb.from('store_orders').select('sku, currency, amount_cents, paid_at, created_at, method, refunded_at, status').eq('env', 'live').neq('method', 'grant').in('status', ['paid', 'refunded']).gte('created_at', since).limit(20000),
      sb.from('store_products').select('sku, label'), can('subs.view') ? sb.from('club_members').select('since, until, status, months, env').eq('env', 'live').limit(20000) : { data: null }]); if (error) throw error;
    const label = sku => ((prods || []).find(p => p.sku === sku) || { label: sku }).label;
    const keyOf = d => { const x = new Date(d); if (f.by === 'month') return x.toISOString().slice(0, 7); const y = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - ((x.getUTCDay() + 6) % 7))); return y.toISOString().slice(0, 10); }; // (weeks start on Monday)
    const keys = []; { const n = f.by === 'month' ? 12 : 26; for (let i = n - 1; i >= 0; i--) { const d = new Date(); if (f.by === 'month') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); } else d.setUTCDate(d.getUTCDate() - 7 * i); keys.push(keyOf(d)); } }
    const curs = [...new Set((orders || []).map(o => o.currency))].sort(), cur = curs.includes(f.cur) ? f.cur : (curs.includes('PHP') ? 'PHP' : curs[0] || 'PHP');
    const per = Object.fromEntries(keys.map(k => [k, { sum: 0, n: 0, refunds: 0 }]));
    for (const o of orders || []) { if (o.currency !== cur) continue; const k = keyOf(o.paid_at || o.created_at); if (!per[k]) continue; per[k].n++; per[k].sum += o.amount_cents; if (o.status === 'refunded') per[k].refunds += o.amount_cents; }
    const top = {}; for (const o of orders || []) if (o.status === 'paid') { const t = top[o.sku] || (top[o.sku] = { n: 0, by: {} }); t.n++; t.by[o.currency] = (t.by[o.currency] || 0) + o.amount_cents; }
    const max = Math.max(1, ...keys.map(k => per[k].sum)), lbl = k => f.by === 'month' ? new Date(k + '-01T00:00:00Z').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : new Date(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const bars = (rows, val, fmt, cls) => `<div class="adm-chart" role="img" aria-label="${esc(rows.map(r => r.k + ': ' + fmt(val(r))).join(', '))}">${rows.map(r => `<div class="adm-bar ${cls || ''}" title="${esc(lbl(r.k) + ': ' + fmt(val(r)))}"><i style="height:${Math.round(val(r) / Math.max(1, ...rows.map(val)) * 100)}%"></i><span>${esc(lbl(r.k))}</span></div>`).join('')}</div>`;
    let clubHtml = '';
    if (club) { // new members by the month they joined; renewals by month (paid Club orders that weren't the first); stopped: cancelled memberships by the month their time ran out
      const months = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
      const cm = Object.fromEntries(months.map(m => [m, { joined: 0, paid: 0, stopped: 0 }]));
      for (const m of club) { const j = (m.since || '').slice(0, 7); if (cm[j]) cm[j].joined++; const e = (m.until || '').slice(0, 7); if (m.status !== 'active' && cm[e] && Date.parse(m.until) < Date.now()) cm[e].stopped++; }
      for (const o of orders || []) if (o.sku === 'lk.club.month' && o.status === 'paid') { const k = (o.paid_at || o.created_at).slice(0, 7); if (cm[k]) cm[k].paid++; }
      const active = club.filter(m => Date.parse(m.until) > Date.now()).length, renewing = club.filter(m => Date.parse(m.until) > Date.now() && m.status === 'active').length;
      clubHtml = `<h3>Supporter Club</h3><div class="adm-tiles"><div class="card adm-tile"><b>${active}</b><span>members now</span></div><div class="card adm-tile"><b>${renewing}</b><span>renewing</span></div><div class="card adm-tile"><b>${active - renewing}</b><span>cancelled, benefits until their date</span></div></div>
        <div class="adm-table"><div class="adm-row adm-head-row"><span><b>Month</b></span><span><b>Joined</b></span><span><b>Payments (first and renewals)</b></span><span><b>Stopped</b></span></div>${months.slice().reverse().map(m => `<div class="adm-row"><span>${esc(lbl(m))}</span><span>${cm[m].joined}</span><span>${cm[m].paid}${cm[m].paid > cm[m].joined ? ` <small>(${cm[m].paid - cm[m].joined} renewals)</small>` : ''}</span><span>${cm[m].stopped}</span></div>`).join('')}</div>`;
    }
    const rows = keys.map(k => Object.assign({ k }, per[k])), total = rows.reduce((a, r) => a + r.sum, 0), count = rows.reduce((a, r) => a + r.n, 0), refunds = rows.reduce((a, r) => a + r.refunds, 0);
    el.innerHTML = head('Sales', `Real payments only (no tests, no gifts), by the day they were paid (UTC). ${f.by === 'month' ? 'The last 12 months' : 'The last 26 weeks'}.`,
      `<div class="adm-filters"><select data-by aria-label="By"><option value="week" ${f.by !== 'month' ? 'selected' : ''}>By week</option><option value="month" ${f.by === 'month' ? 'selected' : ''}>By month</option></select>
        <select data-cur aria-label="Currency">${(curs.length ? curs : ['PHP']).map(c => `<option ${c === cur ? 'selected' : ''}>${c}</option>`).join('')}</select></div>`)
      + `<div class="adm-tiles"><div class="card adm-tile"><b>${esc(money(total, cur))}</b><span>paid in ${cur} in this time</span></div><div class="card adm-tile"><b>${count}</b><span>orders in ${cur}</span></div><div class="card adm-tile"><b>${esc(money(refunds, cur))}</b><span>of it refunded since</span></div></div>
      <h3>Paid in ${cur}, ${f.by === 'month' ? 'month by month' : 'week by week'}</h3>${bars(rows, r => r.sum, v => money(v, cur))}
      <h3>Orders, ${f.by === 'month' ? 'month by month' : 'week by week'}</h3>${bars(rows, r => r.n, v => v + ' order' + (v === 1 ? '' : 's'), 'adm-bar-n')}
      <h3>What sells</h3><div class="adm-table">${Object.entries(top).sort((a, b) => b[1].n - a[1].n).map(([sku, t]) => `<div class="adm-row"><span><b>${esc(label(sku))}</b></span><span>${t.n} sold</span><span><small>${Object.entries(t.by).map(([c, v]) => esc(money(v, c))).join(' · ')}</small></span></div>`).join('') || '<p class="muted">Nothing sold in this time.</p>'}</div>${clubHtml}`;
    const set = patch => { Object.assign(f, patch); sessionStorage.setItem('adm-sales', JSON.stringify(f)); route(); };
    el.querySelector('[data-by]').onchange = e => set({ by: e.target.value }); el.querySelector('[data-cur]').onchange = e => set({ cur: e.target.value });
  }

  // ---------- one person: orders, tickets, what they own, mutes ----------
  async function whoBox(p) {
    const [o, t, en, mu] = await Promise.all([can('payments.view') ? sb.from('store_orders').select('id, sku, status, method, amount_cents, currency, env, created_at').eq('user_id', p.id).order('created_at', { ascending: false }).limit(15) : { data: null },
      can('tickets.handle') ? sb.from('support_tickets').select('id, subject, status, updated_at').eq('user_id', p.id).order('updated_at', { ascending: false }).limit(10) : { data: null },
      sb.from('entitlements').select('sku, source, granted_at, revoked_at').eq('user_id', p.id).order('granted_at', { ascending: false }).limit(60), sb.from('mutes').select('until, reason').eq('user_id', p.id).maybeSingle()]);
    const list = (title, rows, fn) => rows ? `<h3>${title}</h3>${rows.length ? `<ul class="adm-list">${rows.map(fn).join('')}</ul>` : '<p class="muted small">None.</p>'}` : '';
    modal(`<h2>${esc(p.name || p.email || 'A keeper')}</h2><p class="muted small">${esc(p.email || '')} · joined ${day(p.created_at)}${p.last_seen ? ' · seen ' + ago(p.last_seen) : ''} · <a href="community.html#/k/${p.id}" target="_blank" rel="noopener">public page</a></p>
      ${mu.data && Date.parse(mu.data.until) > Date.now() ? `<p><b>Muted</b> until ${when(mu.data.until)}: ${esc(mu.data.reason || '')}</p>` : ''}
      ${list('Orders', o.data, x => `<li>${esc(x.sku)} · ${x.method === 'grant' ? 'gift' : esc(money(x.amount_cents, x.currency))} · ${esc(ORDER[x.status] || x.status)}${x.env !== 'live' ? ' (test)' : ''} · ${day(x.created_at)}</li>`)}
      ${list('Tickets', t.data, x => `<li><a href="#tickets/${x.id}" data-close>#${x.id} ${esc(x.subject)}</a> · ${esc(TK[x.status] || x.status)} · ${ago(x.updated_at)}</li>`)}
      ${list('What they own', en.data, x => `<li>${esc(x.sku)} · ${esc(x.source || '')} · ${day(x.granted_at)}${x.revoked_at ? ' · <b>taken back</b>' : ''}</li>`)}`, (d, close) => { for (const a of d.querySelectorAll('[data-close]')) a.addEventListener('click', close); });
  }

  // ---------- roles of one person, their own permissions ----------
  const BUILT = [['owner', 'Owner'], ['developer', 'Developer'], ['moderator', 'Moderator'], ['contributor', 'Contributor'], ['subscriber', 'Supporter Club'], ['supporter', 'Supporter'], ['veteran', 'Veteran'], ['player', 'Every keeper']];
  const GIVEN = { moderator: 'Moderator', contributor: 'Contributor', developer: 'Developer (owners only)', owner: 'Owner (owners only)' };
  async function rolesBox(p) {
    const pm = can('perms.manage'), none = Promise.resolve({ data: [] });
    const [{ data: custom }, { data: mine }, { data: cat }, { data: grid }, { data: over }] = await Promise.all([sb.from('custom_roles').select('*').order('name'), sb.from('user_roles').select('role').eq('user_id', p.id),
      pm ? sb.from('perm_catalog').select('*').order('sort') : none, pm ? sb.from('role_perms').select('*') : none, pm ? sb.from('user_perms').select('*').eq('user_id', p.id) : none]);
    const has = r => (p.roles || []).includes(r) || (mine || []).some(x => x.role === r), canRoles = can('people.roles');
    const fromRoles = k => has('owner') || (grid || []).some(g => g.perm === k && (has(g.role) || g.role === 'player'));
    const ov = k => { const o = (over || []).find(x => x.perm === k); return o ? (o.allow ? 'allow' : 'deny') : ''; };
    modal(`<h2>Roles: ${esc(p.name || p.email)}</h2><div class="adm-roles">${Object.entries(GIVEN).map(([r, txt]) => `<label class="hub-check"><input type="checkbox" data-r="${r}" ${has(r) ? 'checked' : ''} ${!canRoles || ((r === 'developer' || r === 'owner') && !owner) ? 'disabled' : ''}> ${txt}</label>`).join('')}
      ${(custom || []).map(c => `<label class="hub-check"><input type="checkbox" data-r="custom:${esc(c.key)}" ${has(c.key) ? 'checked' : ''} ${canRoles ? '' : 'disabled'}> ${esc(c.name)} <small class="muted">(custom role)</small></label>`).join('')}</div>
      <p class="muted small">Supporter, Club and Veteran come from purchases and play; they can't be set here. What each role may do is on the Permissions page.</p>
      ${pm ? `<details class="adm-own"><summary>This person's own permissions</summary><p class="muted small">"From their roles" follows the Permissions page. Allow or Deny here wins over their roles, for this person only.${has('owner') ? ' Owners can always do everything.' : ''}</p>
        <div class="adm-table">${(cat || []).map(c => `<div class="adm-row adm-permrow"><span><b>${esc(c.label)}</b><br><small>${esc(c.grp)}</small></span>
          <select data-ov="${esc(c.key)}" aria-label="${esc(c.label)}" ${has('owner') ? 'disabled' : ''}><option value="">From their roles (${fromRoles(c.key) ? 'yes' : 'no'})</option><option value="allow" ${ov(c.key) === 'allow' ? 'selected' : ''}>Allow</option><option value="deny" ${ov(c.key) === 'deny' ? 'selected' : ''}>Deny</option></select></div>`).join('')}</div></details>` : ''}`, d => {
      for (const c of d.querySelectorAll('[data-r]')) c.onchange = () => call('admin', { action: 'role', user: p.id, role: c.dataset.r, on: c.checked }).then(r => { p.roles = r.roles; say(d, 'Saved.', true); }, x => { c.checked = !c.checked; say(d, x.message); });
      for (const s of d.querySelectorAll('[data-ov]')) s.onchange = async () => { const k = s.dataset.ov, v = s.value;
        const { error: e2 } = v ? await sb.from('user_perms').upsert({ user_id: p.id, perm: k, allow: v === 'allow' }) : await sb.from('user_perms').delete().eq('user_id', p.id).eq('perm', k);
        if (e2) say(d, e2.message); else say(d, 'Saved.', true); }; });
  }

  // ---------- permissions: what every role may do; custom roles ----------
  async function permsPage(el) {
    const [{ data: cat, error }, { data: custom }, { data: grid }] = await Promise.all([sb.from('perm_catalog').select('*').order('sort'), sb.from('custom_roles').select('*').order('name'), sb.from('role_perms').select('*')]); if (error) throw error;
    const cols = [...BUILT, ...(custom || []).map(c => [c.key, c.name, true])], on = new Set((grid || []).map(g => g.role + '|' + g.perm)), want = new Set(on);
    const groups = [...new Set(cat.map(c => c.grp))];
    el.innerHTML = head('Permissions', 'What each role may see, change and do. Owners can always do everything, so nobody can lock the owners out. One person can also be allowed or denied something from People and roles.', `<span class="adm-acts"><button class="btn btn-ghost btn-sm" data-newrole>New role</button><button class="btn btn-primary btn-sm" data-review disabled>Review changes</button></span>`)
      + `<div class="adm-grid" role="region" aria-label="Permissions by role" tabindex="0"><table><thead><tr><th scope="col">Permission</th>${cols.map(([k, n, c]) => `<th scope="col">${esc(n)}${c ? `<br><button class="hub-link" data-rename="${esc(k)}">Rename</button> <button class="hub-link" data-delrole="${esc(k)}">Delete</button>` : ''}</th>`).join('')}</tr></thead><tbody>
        ${groups.map(g => `<tr class="adm-grp"><th colspan="${cols.length + 1}" scope="rowgroup">${esc(g)}</th></tr>${cat.filter(c => c.grp === g).map(c => `<tr><th scope="row"><b>${esc(c.label)}</b><small>${esc(c.description || '')}</small></th>${cols.map(([k, n]) => `<td><input type="checkbox" aria-label="${esc(n)}: ${esc(c.label)}" data-cell="${esc(k)}|${esc(c.key)}" ${k === 'owner' || on.has(k + '|' + c.key) ? 'checked' : ''} ${k === 'owner' ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}`).join('')}
      </tbody></table></div><p class="muted small">"Every keeper" is anyone signed in. Saved changes take effect straight away, everywhere; the server checks every permission again.</p>`;
    const rv = el.querySelector('[data-review]'), diff = () => ({ add: [...want].filter(x => !on.has(x)), del: [...on].filter(x => !want.has(x)) });
    for (const c of el.querySelectorAll('[data-cell]')) c.onchange = () => { c.checked ? want.add(c.dataset.cell) : want.delete(c.dataset.cell); c.closest('td').classList.toggle('adm-changed', c.checked !== on.has(c.dataset.cell));
      const x = diff(), n = x.add.length + x.del.length; rv.disabled = !n; rv.textContent = n ? `Review ${n} change${n === 1 ? '' : 's'}` : 'Review changes'; };
    const label = x => { const [r, k] = x.split('|'); return `${esc((cols.find(c => c[0] === r) || [r, r])[1])}: ${esc((cat.find(c => c.key === k) || {}).label || k)}`; };
    rv.onclick = () => { const x = diff(); confirmBox('Save these permission changes?', `${x.add.length ? `<p><b>Allowed</b></p><ul>${x.add.map(a => `<li>${label(a)}</li>`).join('')}</ul>` : ''}${x.del.length ? `<p><b>Taken away</b></p><ul>${x.del.map(a => `<li>${label(a)}</li>`).join('')}</ul>` : ''}<p class="muted small">Everyone with these roles gets the change straight away.</p>`, async () => {
      if (x.add.length) { const { error: e2 } = await sb.from('role_perms').insert(x.add.map(a => { const [role, perm] = a.split('|'); return { role, perm }; })); if (e2) throw e2; }
      for (const a of x.del) { const [role, perm] = a.split('|'); const { error: e2 } = await sb.from('role_perms').delete().eq('role', role).eq('perm', perm); if (e2) throw e2; }
      route(); }, 'Save'); };
    const roleForm = c => modal(`<h2>${c ? 'Rename role' : 'New role'}</h2><form class="hub-form"><label>Name<input name="name" minlength="2" maxlength="40" required value="${esc(c ? c.name : '')}" placeholder="For example: Editor, Support, Community helper"></label><button class="btn btn-primary" type="submit">Save</button></form><p class="muted small">${c ? '' : 'A new role can do nothing until you tick what it may do. Give it to people from People and roles.'}</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const name = new FormData(f).get('name').trim();
        let key = c ? c.key : name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26); if (!/^[a-z]/.test(key)) key = 'r-' + key; if (key.length < 2 || BUILT.some(x => x[0] === key)) key += '-role';
        const { error: e2 } = c ? await sb.from('custom_roles').update({ name }).eq('key', c.key) : await sb.from('custom_roles').insert({ key, name });
        if (e2) say(f, /duplicate/i.test(e2.message) ? 'A role with that name already exists.' : e2.message); else { close(); route(); } }; });
    el.querySelector('[data-newrole]').onclick = () => roleForm(null);
    for (const b of el.querySelectorAll('[data-rename]')) b.onclick = () => roleForm(custom.find(c => c.key === b.dataset.rename));
    for (const b of el.querySelectorAll('[data-delrole]')) b.onclick = () => { const c = custom.find(x => x.key === b.dataset.delrole); confirmBox(`Delete the role ${esc(c.name)}?`, '<p>Everyone who has it loses it, and what it allowed. People keep their other roles.</p>', async () => {
      await sb.from('role_perms').delete().eq('role', c.key); const { error: e2 } = await sb.from('custom_roles').delete().eq('key', c.key); if (e2) throw e2; route(); }, 'Delete'); };
  }

  // ---------- the website: edit any page in place, the site settings, every change with undo ----------
  const SITE_PAGES = [['index.html', 'Home'], ['news.html', 'News'], ['community.html', 'Community'], ['store.html', 'Store'], ['support.html', 'Support and FAQ'], ['downloads.html', 'Downloads'], ['press.html', 'Press kit'], ['pitch.html', 'Presentation'], ['account.html', 'Account'], ['privacy-policy.html', 'Privacy Policy'], ['terms.html', 'Terms of Service'], ['404.html', 'Page not found']];
  async function sitePage(el) {
    const [{ data: rows, error }, { data: log }] = await Promise.all([sb.from('site_edits').select('page, key, lang, kind, updated_at'), sb.from('site_edit_log').select('*').order('at', { ascending: false }).limit(30)]); if (error) throw error;
    const count = p => (rows || []).filter(r => r.page === p).length;
    await people((log || []).map(x => x.by));
    el.innerHTML = head('Website', 'Change any page without code: open a page in the editor, then click any text, link, button or picture. Sections can be moved, hidden, restyled or added. Every change can be undone.')
      + (can('site.edit') ? `<h3>Pages</h3><div class="adm-pages">${SITE_PAGES.map(([p, n]) => `<div class="card adm-tile"><b>${esc(n)}</b><span>${count(p) ? count(p) + ' change' + (count(p) === 1 ? '' : 's') : 'As designed'}</span><span class="adm-acts"><a class="btn btn-primary btn-sm" href="${p}?edit">Edit</a>${count(p) ? `<button class="btn btn-ghost btn-sm" data-wipe="${p}">Reset</button>` : ''}</span></div>`).join('')}</div>
        <p class="muted small">The header, menu and footer are the same on every page: change them on any page. ${count('*') - (rows || []).filter(r => r.page === '*' && r.kind === 'settings').length} change(s) there.</p>` : '')
      + (can('site.settings') ? '<h3>Site settings</h3><div class="card" data-settings><p class="muted">Loading...</p></div>' : '')
      + `<h3>Latest changes</h3><div class="adm-table adm-log">${(log || []).map((x, i) => `<div class="adm-row"><span><b>${esc(x.page === '*' ? 'Every page' : x.page)}</b> · ${esc(x.kind || '')}${x.lang ? ' · ' + esc(x.lang) : ''}<br><small>${esc(String((x.after || x.before || {}).html || (x.after || x.before || {}).src || x.key).replace(/<[^>]+>/g, '').slice(0, 120))}</small></span><span><small>${x.after ? (x.before ? 'Changed' : 'Added') : 'Removed'} by ${nm(x.by)}</small></span><span><small>${when(x.at)}</small></span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-undo="${x.id}">Undo</button></span></div>`.replace('<div class="adm-row">', `<div class="adm-row"${i >= 10 ? ' hidden data-more' : ''}>`)).join('') || '<p class="muted">No changes yet.</p>'}</div>${(log || []).length > 10 ? `<p><button class="btn btn-ghost btn-sm" data-showall>Show all ${(log || []).length}</button></p>` : ''}`;
    const sa = el.querySelector('[data-showall]'); if (sa) sa.onclick = () => { for (const r of el.querySelectorAll('[data-more]')) r.hidden = false; sa.remove(); };
    const box = el.querySelector('[data-settings]');
    if (box) { let tries = 0; const go = () => { // (assets/site-edit.js loads with the page: wait for it a little, then say what went wrong)
      if (!(window.LKSiteEdit && LKSiteEdit.settingsForm && LKSiteEdit.settings())) { if (++tries < 80) return setTimeout(go, 100); box.innerHTML = '<p>The site settings could not load. Reload the page; if it stays, the site editor script is missing.</p>'; return; }
      LKSiteEdit.reload().then(() => LKSiteEdit.settingsForm(box, sb, () => { say(box, 'Saved for every page.', true); })).catch(e => { box.innerHTML = `<p>The site settings could not load: ${esc(e.message || e)}</p>`; }); }; go(); }
    for (const b of el.querySelectorAll('[data-wipe]')) b.onclick = () => confirmBox(`Reset ${esc(b.dataset.wipe)}?`, '<p>Every change made on this page goes, and it looks as designed again. Each one stays in the history, so it can be brought back.</p>', async () => { const { error: e2 } = await sb.from('site_edits').delete().eq('page', b.dataset.wipe); if (e2) throw e2; route(); }, 'Reset');
    for (const b of el.querySelectorAll('[data-undo]')) b.onclick = () => { const x = log.find(y => y.id === +b.dataset.undo); confirmBox('Undo this change?', `<p>${x.before ? 'It goes back to what it was before.' : 'It is taken off again.'}</p>`, async () => {
      const q = x.before ? await sb.from('site_edits').upsert({ page: x.page, key: x.key, lang: x.lang, kind: x.kind, value: x.before }) : await sb.from('site_edits').delete().eq('page', x.page).eq('key', x.key).eq('lang', x.lang); if (q.error) throw q.error; route(); }, 'Undo'); };
  }

  // ---------- game switches: a part of the game off for a while, a message on every player's home screen ----------
  const SW_NAMES = { notice: 'Message on the home screen', coop: 'Co-op', pvp: 'PvP', bazaar: 'The Bazaar', store: 'The store (Lumens and packs)', trade: 'Trading' };
  async function switchesPage(el) {
    const { data, error } = await sb.from('game_switches').select('*'); if (error) throw error;
    const rows = ['notice', 'coop', 'pvp', 'bazaar', 'store', 'trade'].map(k => (data || []).find(s => s.key === k)).filter(Boolean);
    await people(rows.map(s => s.updated_by));
    el.innerHTML = head('Game switches', 'Turn a part of the game off for every player for a while (its button explains why), or show a short message on every home screen. Players see a change within five minutes; nothing already running is stopped. Works without a new release.')
      + `<div class="adm-table">${rows.map(s => `<div class="adm-row adm-permrow"><span><b>${esc(SW_NAMES[s.key])}</b><br><small>${s.updated_by ? 'changed ' + ago(s.updated_at) + ' by ' + nm(s.updated_by) : 'never changed'}</small>
        <input data-swmsg="${s.key}" maxlength="300" value="${esc(s.message || '')}" placeholder="${s.key === 'notice' ? 'The message, e.g. Maintenance at 22:00 (UTC), about 30 minutes' : 'Why it is off (optional)'}" aria-label="${esc(SW_NAMES[s.key])}: message" style="width:100%;margin-top:6px"></span>
        <label class="hub-check"><input type="checkbox" data-swon="${s.key}" ${s.on ? 'checked' : ''}> ${s.key === 'notice' ? 'Shown' : 'Available'}</label></div>`).join('')}</div>
      <p><button class="btn btn-primary btn-sm" data-swsave>Review and save</button></p>`;
    el.querySelector('[data-swsave]').onclick = () => {
      const next = rows.map(s => ({ key: s.key, on: el.querySelector(`[data-swon="${s.key}"]`).checked, message: el.querySelector(`[data-swmsg="${s.key}"]`).value.trim() }));
      const changed = next.filter(n => { const o = rows.find(s => s.key === n.key); return o.on !== n.on || (o.message || '') !== n.message; });
      if (!changed.length) return modal('<h2>Nothing changed</h2>');
      if (changed.some(n => n.key === 'notice' && n.on && !n.message)) return modal('<h2>The message needs its text</h2><p>Write what players should read on the home screen.</p>');
      confirmBox('Change this for every player?', `<ul>${changed.map(n => `<li><b>${esc(SW_NAMES[n.key])}</b>: ${n.key === 'notice' ? (n.on ? 'shown' : 'hidden') : (n.on ? 'available' : '<b>OFF</b>')}${n.message ? ` ("${esc(n.message)}")` : ''}</li>`).join('')}</ul>`, async () => {
        for (const n of changed) { const { error: e2 } = await sb.from('game_switches').update({ on: n.on, message: n.message }).eq('key', n.key); if (e2) throw e2; }
        route(); }, 'Change');
    };
  }

  // ---------- posts: news, devlogs (by version), events, giveaways; drafts and schedules ----------
  async function posts(el) {
    const { data, error } = await sb.from('community_posts').select('id, category, title, version, published, publish_at, starts_at, ends_at, prize, status, created_at, author').in('category', ['announcements', 'devlog', 'updates', 'roadmap', 'events', 'giveaways']).order('created_at', { ascending: false }).limit(100); if (error) throw error;
    const st = p => !p.published ? 'Draft' : p.publish_at && Date.parse(p.publish_at) > Date.now() ? 'Scheduled ' + when(p.publish_at) : p.status !== 'visible' ? 'Hidden' : 'Published';
    el.innerHTML = head('News, devlogs, events and giveaways', 'Written in the community with the team options (version, schedule, draft). Drafts are seen only by the team.', '<a class="btn btn-primary btn-sm" href="community.html#/new/announcements" target="_blank">New post</a>')
      + `<div class="adm-table">${(data || []).map(p => `<div class="adm-row"><span><b>${esc(p.title)}</b><br><small>${esc(p.category)}${p.version ? ' · v' + esc(p.version) : ''}${p.ends_at ? ' · until ' + when(p.ends_at) : ''}${p.prize ? ' · prize: ' + esc(p.prize) : ''} · ${day(p.created_at)}</small></span><span class="adm-state ${p.published && p.status === 'visible' ? 'st-paid' : 'st-review'}">${st(p)}</span>
        <span class="adm-acts"><a class="btn btn-ghost btn-sm" href="community.html#/p/${p.id}" target="_blank">Open</a>${!p.published ? `<button class="btn btn-primary btn-sm" data-pub="${p.id}">Publish now</button>` : ''}${p.category === 'giveaways' ? `<button class="btn btn-ghost btn-sm" data-draw="${p.id}">Entries</button>` : ''}</span></div>`).join('') || '<p class="muted">No posts yet.</p>'}</div>`;
    for (const b of el.querySelectorAll('[data-pub]')) b.onclick = () => confirmBox('Publish this post?', '<p>Everyone can see it in the community straight away.</p>', () => call('community', { action: 'moderate', post: +b.dataset.pub, published: true }).then(route), 'Publish');
    for (const b of el.querySelectorAll('[data-draw]')) b.onclick = async () => { const { data: en } = await sb.from('giveaway_entries').select('user_id, winner, created_at').eq('post_id', +b.dataset.draw); await people((en || []).map(e => e.user_id));
      modal(`<h2>Giveaway entries: ${(en || []).length}</h2><div class="adm-notes">${(en || []).map(e => `<p>${nm(e.user_id)} · ${day(e.created_at)}${e.winner ? ' · <b>winner</b>' : ''}</p>`).join('') || '<p class="muted">No entries yet.</p>'}</div><div class="hub-actions"><button class="btn btn-primary" data-pick>Draw a winner at random</button></div>`, d => {
        d.querySelector('[data-pick]').onclick = async () => { const left = (en || []).filter(e => !e.winner); if (!left.length) return say(d, 'Nobody left to draw.'); const a = new Uint32Array(1); crypto.getRandomValues(a); const w = left[a[0] % left.length];
          const { error: e2 } = await sb.from('giveaway_entries').update({ winner: true }).eq('post_id', +b.dataset.draw).eq('user_id', w.user_id); if (e2) say(d, e2.message); else say(d, `Winner: ${names.get(w.user_id)}. Give the prize from Rewards and gifts.`, true); }; }); };
  }

  // ---------- in-game announcements (the Notification Center) ----------
  async function announce(el) {
    const { data, error } = await sb.from('announcements').select('*').order('starts_at', { ascending: false }).limit(60); if (error) throw error;
    el.innerHTML = head('In-game announcements', 'Shown in the game\'s Notification Center, in their category, from the start time until the end time.', '<button class="btn btn-primary btn-sm" data-new>New announcement</button>')
      + `<div class="adm-table">${(data || []).map(a => `<div class="adm-row"><span><b>${esc(a.title)}</b><br><small>${esc(a.body.slice(0, 160))}</small></span><span><small>${esc(a.category)}</small></span><span><small>${when(a.starts_at)} → ${a.ends_at ? when(a.ends_at) : 'no end'}</small></span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-ed="${a.id}">Edit</button><button class="btn btn-ghost btn-sm" data-del="${a.id}">Delete</button></span></div>`).join('') || '<p class="muted">None yet.</p>'}</div>`;
    const edit = a => modal(`<h2>${a ? 'Edit' : 'New'} announcement</h2><form class="hub-form"><label>Category<select name="category">${['important', 'game', 'events', 'community', 'promotions'].map(c => `<option ${a && a.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>Title<input name="title" maxlength="80" required value="${esc(a ? a.title : '')}"></label><label>Text<textarea name="body" maxlength="600" rows="4">${esc(a ? a.body : '')}</textarea></label><label>Link <small>(optional, https://)</small><input name="link" maxlength="300" value="${esc(a && a.link || '')}"></label><div class="hub-row"><label>From<input type="datetime-local" name="starts_at" value="${local(a ? a.starts_at : new Date())}"></label><label>Until <small>(optional)</small><input type="datetime-local" name="ends_at" value="${local(a && a.ends_at)}"></label></div><button class="btn btn-primary" type="submit">Save</button></form><p class="muted small">Players see it as soon as the start time comes.</p>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const row = { category: v.category, title: v.title, body: v.body, link: v.link || null, starts_at: iso(v.starts_at) || new Date().toISOString(), ends_at: iso(v.ends_at) };
        const { error: e2 } = a ? await sb.from('announcements').update(row).eq('id', a.id) : await sb.from('announcements').insert(row); if (e2) say(f, e2.message); else { close(); route(); } }; });
    el.querySelector('[data-new]').onclick = () => edit(null);
    for (const b of el.querySelectorAll('[data-ed]')) b.onclick = () => edit(data.find(a => a.id === +b.dataset.ed));
    for (const b of el.querySelectorAll('[data-del]')) b.onclick = () => confirmBox('Delete this announcement?', '<p>It disappears from the game.</p>', async () => { const { error: e2 } = await sb.from('announcements').delete().eq('id', +b.dataset.del); if (e2) throw e2; route(); }, 'Delete');
  }

  // ---------- FAQ (the support chatbot answers from it) ----------
  const FAQ_CATS = ['account', 'login', 'payment', 'subscription', 'game', 'troubleshooting', 'website', 'general'];
  async function faq(el) {
    const { data, error } = await sb.from('faq').select('*').order('category').order('sort'); if (error) throw error;
    el.innerHTML = head('FAQ and the support chatbot', 'The chatbot on every page answers only from these questions (no AI). Keywords help it match how people ask.', '<button class="btn btn-primary btn-sm" data-new>Add a question</button>')
      + `<div class="adm-table">${(data || []).map(q => `<div class="adm-row"><span><b>${esc(q.question)}</b>${q.published ? '' : ' <span class="hub-test">Hidden</span>'}<br><small>${esc(q.answer.slice(0, 180))}</small></span><span><small>${esc(q.category)} · ${esc(q.lang)}</small></span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-ed="${q.id}">Edit</button><button class="btn btn-ghost btn-sm" data-del="${q.id}">Delete</button></span></div>`).join('') || '<p class="muted">No questions yet.</p>'}</div>`;
    const edit = q => modal(`<h2>${q ? 'Edit' : 'New'} question</h2><form class="hub-form"><div class="hub-row"><label>Category<select name="category">${FAQ_CATS.map(c => `<option ${q && q.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>Language<input name="lang" value="${esc(q ? q.lang : 'en')}" required></label></div>
      <label>Question<input name="question" maxlength="200" required value="${esc(q ? q.question : '')}"></label><label>Answer<textarea name="answer" rows="6" maxlength="2000" required>${esc(q ? q.answer : '')}</textarea></label>
      <label>Keywords <small>(comma separated: words people might use)</small><input name="keywords" value="${esc(q ? q.keywords.join(', ') : '')}"></label><label>Link <small>(optional: a page with more, e.g. support.html#refunds)</small><input name="link" maxlength="200" value="${esc(q && q.link || '')}"></label>
      <div class="hub-row"><label>Order<input name="sort" type="number" value="${q ? q.sort : 0}"></label><label class="hub-check"><input type="checkbox" name="published" ${!q || q.published ? 'checked' : ''}> Published</label></div><button class="btn btn-primary" type="submit">Save</button></form>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const row = { category: v.category, lang: v.lang, question: v.question, answer: v.answer, keywords: String(v.keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean), link: v.link || null, sort: +v.sort || 0, published: !!v.published, updated_at: new Date().toISOString() };
        const { error: e2 } = q ? await sb.from('faq').update(row).eq('id', q.id) : await sb.from('faq').insert(row); if (e2) say(f, e2.message); else { close(); route(); } }; });
    el.querySelector('[data-new]').onclick = () => edit(null);
    for (const b of el.querySelectorAll('[data-ed]')) b.onclick = () => edit(data.find(q => q.id === +b.dataset.ed));
    for (const b of el.querySelectorAll('[data-del]')) b.onclick = () => confirmBox('Delete this question?', '<p>The chatbot stops using it.</p>', async () => { const { error: e2 } = await sb.from('faq').delete().eq('id', +b.dataset.del); if (e2) throw e2; route(); }, 'Delete');
  }

  // ---------- products and prices; GCash and bank details ----------
  const MORE_CUR = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'MXN']; // (0.30.1: beside USD and PHP; prices in hundredths, the yen too)
  async function store(el) {
    const [{ data: prods, error }, { data: s }] = await Promise.all([sb.from('store_products').select('*').order('sort'), sb.from('store_settings').select('*').eq('id', 1).maybeSingle()]); if (error) throw error;
    el.innerHTML = head('Products and prices', 'Changes show on the website store at once. Orders already made keep what they paid; Club members already subscribed keep their price until they cancel.')
      + `<div class="adm-table">${prods.map(p => `<div class="adm-row"><span><b>${esc(p.label)}</b>${p.active ? '' : ' <span class="hub-test">Off</span>'}${p.offer ? ` <span class="hub-offer">${esc(p.offer)}</span>` : ''}<br><small>${esc(p.sku)} · ${esc(p.kind)}${p.lumens ? ' · ' + p.lumens + ' Lumens' : ''}</small></span><span>${esc(money(p.usd_cents, 'USD'))}<br>${esc(money(p.php_cents, 'PHP'))}<br><small>${MORE_CUR.filter(c => (p.prices || {})[c]).map(c => esc(money(p.prices[c], c))).join(' · ') || 'USD and PHP only'}</small></span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-ed="${esc(p.sku)}">Edit</button></span></div>`).join('')}</div>
      <h3>GCash and bank transfer</h3><form class="hub-form card" data-pay><label class="hub-check"><input type="checkbox" name="manual_on" ${s && s.manual_on ? 'checked' : ''}> Offer GCash and bank transfer</label>
        <div class="hub-row"><label>GCash account name <small>(as players see it: use Exenova if your account allows)</small><input name="gcash_name" maxlength="80" value="${esc(s && s.gcash_name || '')}"></label><label>GCash number<input name="gcash_number" maxlength="20" value="${esc(s && s.gcash_number || '')}"></label></div>
        <label>Bank details <small>(bank, account name, number)</small><textarea name="bank_details" rows="3" maxlength="400">${esc(s && s.bank_details || '')}</textarea></label>
        <label>GCash QR code <small>(PNG or JPEG from the GCash app: Receive > QR)</small><input type="file" name="qr" accept="image/png,image/jpeg,image/webp"></label>${s && s.gcash_qr ? `<img class="hub-qr" src="${esc(s.gcash_qr)}" alt="The current GCash QR code" width="160" height="160">` : '<p class="muted small">No QR code yet.</p>'}
        <button class="btn btn-primary" type="submit">Save</button></form>`;
    for (const b of el.querySelectorAll('[data-ed]')) b.onclick = () => { const p = prods.find(x => x.sku === b.dataset.ed);
      modal(`<h2>${esc(p.label)}</h2><form class="hub-form"><label>Name<input name="label" maxlength="60" value="${esc(p.label)}" required></label><label>Description<textarea name="blurb" rows="3" maxlength="300">${esc(p.blurb || '')}</textarea></label>
        <div class="hub-row"><label>Price in US dollars<input name="usd" type="number" step="0.01" min="0.5" value="${(p.usd_cents / 100).toFixed(2)}" required></label><label>Price in pesos<input name="php" type="number" step="1" min="20" value="${(p.php_cents / 100).toFixed(0)}" required></label></div>
        <details class="adm-more-cur" open><summary>Other currencies <small>(empty: shown and charged in US dollars)</small></summary><div class="adm-cur-grid">${MORE_CUR.map(c => `<label>${c}<input name="cur_${c}" type="number" step="${c === 'JPY' ? 1 : 0.01}" min="${c === 'JPY' ? 50 : c === 'MXN' ? 10 : 0.5}" value="${(p.prices || {})[c] ? (c === 'JPY' ? p.prices[c] / 100 : (p.prices[c] / 100).toFixed(2)) : ''}"></label>`).join('')}</div></details>
        <div class="hub-row"><label>Offer label <small>(optional, e.g. "Launch week")</small><input name="offer" maxlength="40" value="${esc(p.offer || '')}"></label><label>Offer ends<input name="offer_ends" type="datetime-local" value="${local(p.offer_ends)}"></label></div>
        <label class="hub-check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> On sale</label><button class="btn btn-primary" type="submit">Review the change</button></form>`, (d, close) => {
        const f = d.querySelector('form'); f.onsubmit = e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)), row = { label: v.label, blurb: v.blurb || '', usd_cents: Math.round(+v.usd * 100), php_cents: Math.round(+v.php * 100), offer: v.offer || null, offer_ends: iso(v.offer_ends), active: !!v.active, prices: {} };
          for (const c of MORE_CUR) if (v['cur_' + c]) row.prices[c] = Math.round(+v['cur_' + c] * 100);
          const diff = [['Name', p.label, row.label], ['Price (USD)', money(p.usd_cents, 'USD'), money(row.usd_cents, 'USD')], ['Price (PHP)', money(p.php_cents, 'PHP'), money(row.php_cents, 'PHP')], ...MORE_CUR.map(c => [`Price (${c})`, (p.prices || {})[c] ? money(p.prices[c], c) : '-', row.prices[c] ? money(row.prices[c], c) : '-']), ['Offer', p.offer || '-', row.offer || '-'], ['On sale', p.active ? 'yes' : 'no', row.active ? 'yes' : 'no']].filter(x => x[1] !== x[2]);
          if (!diff.length && row.blurb === (p.blurb || '')) { close(); return; } close();
          confirmBox('Confirm the change', `<table class="adm-diff"><tr><th></th><th>Now</th><th>After</th></tr>${diff.map(([k, a, b2]) => `<tr><td>${k}</td><td>${esc(a)}</td><td><b>${esc(b2)}</b></td></tr>`).join('')}</table>${row.blurb !== (p.blurb || '') ? '<p>The description changes too.</p>' : ''}<p class="muted small">Players see the new price on the website at once. Nobody is charged differently for what they already bought.</p>`, async () => { const { error: e2 } = await sb.from('store_products').update(row).eq('sku', p.sku); if (e2) throw e2; route(); }, 'Save the change'); }; }); };
    const f = el.querySelector('[data-pay]'); f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f), row = { manual_on: !!fd.get('manual_on'), gcash_name: fd.get('gcash_name') || null, gcash_number: fd.get('gcash_number') || null, bank_details: fd.get('bank_details') || null };
      try { const file = fd.get('qr'); if (file && file.size) { if (file.size > 2 * 1048576) throw new Error('Use a picture under 2 MB.'); const path = `gcash-qr-${Date.now()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`; const up = await sb.storage.from('store').upload(path, file, { contentType: file.type }); if (up.error) throw up.error; row.gcash_qr = sb.storage.from('store').getPublicUrl(path).data.publicUrl; }
        const { error: e2 } = await sb.from('store_settings').update(row).eq('id', 1); if (e2) throw e2; say(f, 'Saved.', true); } catch (x) { say(f, x.message || String(x)); } };
  }

  // ---------- email templates: edit, preview, approve (owners) ----------
  let mailMod = null; const mail = async () => mailMod || (mailMod = await Promise.all([import('./email/js/email-render.js'), import('./email/js/email-templates.js')]));
  async function emails(el, [key]) {
    const { data, error } = await sb.from('email_templates').select('*').order('grp').order('key'); if (error) throw error;
    if (key) return emailEdit(el, data.find(t => t.key === key));
    el.innerHTML = head('Email templates', `The automatic emails. Each one is sent only once an owner approves it; a change needs approving again.${can('emails.approve') ? '' : ' (Your account can not approve.)'}`)
      + `<div class="adm-table">${data.map(t => `<a class="adm-row adm-link" href="#emails/${esc(t.key)}"><span><b>${esc(t.name)}</b><br><small>${esc(t.subject)}</small></span><span><small>${esc(t.grp)}</small></span><span class="adm-state ${t.approved ? 'st-paid' : 'st-review'}">${t.approved ? 'Approved' : 'Not approved: not sent'}</span><span><small>${ago(t.updated_at)}</small></span></a>`).join('')}</div>`
      + (can('emails.approve') ? `<p><button class="btn btn-ghost btn-sm" data-all>Approve every template</button></p>` : '');
    const all = el.querySelector('[data-all]'); if (all) all.onclick = () => confirmBox('Approve every email?', `<p>${data.filter(t => !t.approved).length} templates start being sent when what they are for happens (a payment, a ticket...).</p>`, async () => { const { error: e2 } = await sb.from('email_templates').update({ approved: true }).eq('approved', false); if (e2) throw e2; route(); }, 'Approve all');
  }
  async function emailEdit(el, t) {
    if (!t) { el.innerHTML = '<p>No such template.</p>'; return; }
    const [{ renderEmail }, { EMAIL_SAMPLES }] = await mail();
    const fields = [...new Set((t.subject + t.preheader + t.heading + t.body + (t.button_link || '')).match(/\{\{(\w+)\}\}/g) || [])].join(' ');
    el.innerHTML = `<p><a href="#emails">&larr; All templates</a></p>` + head(esc(t.name), `${t.approved ? 'Approved' : '<b>Not approved</b>: this email is not sent'} · fields you can use: ${esc(fields || 'none')}`)
      + `<div class="adm-split"><form class="hub-form card" data-tpl><label>Subject<input name="subject" maxlength="140" value="${esc(t.subject)}" required></label><label>Preview line <small>(after the subject in the inbox)</small><input name="preheader" maxlength="160" value="${esc(t.preheader)}"></label>
        <label>Heading<input name="heading" maxlength="140" value="${esc(t.heading)}"></label><label>Text <small>(a blank line starts a paragraph; lines like "Amount: {{amount}}" become the details card; "• " lines a list)</small><textarea name="body" rows="12" maxlength="6000">${esc(t.body)}</textarea></label>
        <div class="hub-row"><label>Button text<input name="button_label" maxlength="40" value="${esc(t.button_label || '')}"></label><label>Button link<input name="button_link" maxlength="300" value="${esc(t.button_link || '')}"></label></div>
        <label>Colour<select name="tone">${['info', 'success', 'warning', 'danger'].map(x => `<option ${t.tone === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <div class="hub-actions"><button class="btn btn-primary" type="submit">Save</button>${can('emails.approve') && !t.approved ? '<button class="btn btn-ghost" type="button" data-approve>Approve: start sending</button>' : ''}${can('emails.approve') && t.approved ? '<button class="btn btn-ghost" type="button" data-unapprove>Stop sending</button>' : ''}</div></form>
        <div><p class="muted small">Preview with sample values</p><iframe class="adm-mail" title="Email preview"></iframe></div></div>`;
    const f = el.querySelector('[data-tpl]'), frame = el.querySelector('iframe');
    const draw = () => { const v = Object.fromEntries(new FormData(f)), r = renderEmail(Object.assign({}, t, v), EMAIL_SAMPLES, { unsubLink: '#' }); frame.srcdoc = r.html; };
    f.addEventListener('input', draw); draw();
    f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const { error } = await sb.from('email_templates').update({ subject: v.subject, preheader: v.preheader, heading: v.heading, body: v.body, button_label: v.button_label || null, button_link: v.button_link || null, tone: v.tone }).eq('key', t.key); if (error) say(f, error.message); else { say(f, t.approved ? 'Saved. It needs approving again before it is sent.' : 'Saved.', true); setTimeout(route, 900); } };
    const ap = el.querySelector('[data-approve]'); if (ap) ap.onclick = () => confirmBox('Approve this email?', `<p>"${esc(t.name)}" is sent from now on, whenever what it is for happens.</p>`, async () => { const { error } = await sb.from('email_templates').update({ approved: true }).eq('key', t.key); if (error) throw error; route(); }, 'Approve');
    const un = el.querySelector('[data-unapprove]'); if (un) un.onclick = async () => { const { error } = await sb.from('email_templates').update({ approved: false }).eq('key', t.key); if (error) err(error); else route(); };
  }

  // ---------- email campaigns (updates, events, offers: only to players who chose them) ----------
  async function campaigns(el) {
    const { data, error } = await sb.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(50); if (error) throw error;
    el.innerHTML = head('Email campaigns', 'Sent only to players who turned that kind of email on, with a one-click unsubscribe. Send yourself a test first.', '<button class="btn btn-primary btn-sm" data-new>New campaign</button>')
      + `<div class="adm-table">${(data || []).map(c => `<div class="adm-row"><span><b>${esc(c.subject)}</b><br><small>${esc(c.kind)} · ${day(c.created_at)}</small></span><span class="adm-state st-${c.status === 'sent' ? 'paid' : c.status === 'cancelled' ? 'cancelled' : 'review'}">${esc(c.status)}${c.status === 'scheduled' ? ' ' + when(c.send_at) : ''}</span><span><small>${c.sent}/${c.audience} sent${c.failed ? ', ' + c.failed + ' failed' : ''}</small></span>
        <span class="adm-acts">${c.status === 'draft' ? `<button class="btn btn-ghost btn-sm" data-ed="${c.id}">Edit</button><button class="btn btn-ghost btn-sm" data-test="${c.id}">Send me a test</button><button class="btn btn-primary btn-sm" data-send="${c.id}">Send or schedule</button>` : ''}${['scheduled', 'sending'].includes(c.status) ? `<button class="btn btn-ghost btn-sm" data-stop="${c.id}">Cancel</button>` : ''}</span></div>`).join('') || '<p class="muted">No campaigns yet.</p>'}</div>`;
    const edit = c => modal(`<h2>${c ? 'Edit' : 'New'} campaign</h2><form class="hub-form"><label>Kind<select name="kind">${[['updates', 'Updates and patch notes'], ['events', 'Events'], ['promos', 'Offers']].map(([k, l]) => `<option value="${k}" ${c && c.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Subject<input name="subject" maxlength="120" required value="${esc(c ? c.subject : '')}"></label><label>Preview line<input name="preheader" maxlength="140" value="${esc(c ? c.preheader : '')}"></label><label>Headline<input name="headline" maxlength="120" value="${esc(c ? c.headline : '')}"></label>
      <label>Text <small>(a blank line starts a paragraph)</small><textarea name="body" rows="8" maxlength="6000">${esc(c ? c.body : '')}</textarea></label><div class="hub-row"><label>Button text<input name="button_label" maxlength="40" value="${esc(c && c.button_label || '')}"></label><label>Button link <small>(https://)</small><input name="button_link" maxlength="300" value="${esc(c && c.button_link || '')}"></label></div><button class="btn btn-primary" type="submit">Save the draft</button></form>`, (d, close) => {
      const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)), row = Object.assign(v, { button_label: v.button_label || null, button_link: v.button_link || null });
        const { error: e2 } = c ? await sb.from('email_campaigns').update(row).eq('id', c.id) : await sb.from('email_campaigns').insert(row); if (e2) say(f, e2.message); else { close(); route(); } }; });
    el.querySelector('[data-new]').onclick = () => edit(null);
    for (const b of el.querySelectorAll('[data-ed]')) b.onclick = () => edit(data.find(c => c.id === +b.dataset.ed));
    for (const b of el.querySelectorAll('[data-test]')) b.onclick = () => call('send-emails', { action: 'test', id: +b.dataset.test }).then(r => modal(`<h2>Test sent</h2><p>Sent to ${esc(r.to)}.</p>`), err);
    for (const b of el.querySelectorAll('[data-stop]')) b.onclick = () => call('send-emails', { action: 'cancel', id: +b.dataset.stop }).then(route, err);
    for (const b of el.querySelectorAll('[data-send]')) b.onclick = () => { const c = data.find(x => x.id === +b.dataset.send);
      modal(`<h2>Send "${esc(c.subject)}"</h2><form class="hub-form"><label>When<input type="datetime-local" name="at"> <small>(empty: now)</small></label><label>Type SEND to confirm<input name="confirm" autocomplete="off" required></label><button class="btn btn-primary" type="submit">Send</button></form><p class="muted small">It goes to every player who chose ${esc(c.kind)} emails. This can't be undone once sent.</p>`, (d, close) => {
        const f = d.querySelector('form'); f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
          try { if (v.at) { const { error: e2 } = await sb.from('email_campaigns').update({ send_at: iso(v.at) }).eq('id', c.id); if (e2) throw e2; } const r = await call('send-emails', { action: 'start', id: c.id, confirm: v.confirm }); close(); modal(`<h2>${r.scheduled ? 'Scheduled' : 'Sending'}</h2><p>${r.audience} player${r.audience === 1 ? '' : 's'}.</p>`); route(); } catch (x) { say(f, x.message); } }; }); };
  }

  // ---------- translations (website and game; override the shipped language files) ----------
  async function translations(el) {
    const lang = sessionStorage.getItem('adm-lang') || 'fil';
    const [{ data, error }, base] = await Promise.all([sb.from('translations').select('*').eq('lang', lang).order('key'), fetch('assets/i18n/' + lang + '.json').then(r => r.ok ? r.json() : {}, () => ({}))]); if (error) throw error;
    const LANGS = window.LK_LANGS || [['fil', 'Filipino'], ['es', 'Español'], ['pt-BR', 'Português (Brasil)'], ['id', 'Bahasa Indonesia'], ['ja', '日本語'], ['ko', '한국어'], ['zh-CN', '简体中文']];
    el.innerHTML = head('Translations', 'The website and the game ship with these languages. Changes here replace the shipped text for that language as soon as the page or the game loads again.',
      `<div class="adm-filters"><select data-lang aria-label="Language">${LANGS.map(([c, n]) => `<option value="${c}" ${c === lang ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn btn-primary btn-sm" data-new>Change a text</button></div>`)
      + `<p class="muted small">${Object.keys(base).length} texts shipped for this language; ${(data || []).length} changed here.</p><div class="adm-table">${(data || []).map(t => `<div class="adm-row"><span><small>${esc(t.key)}</small><br><b>${esc(t.value)}</b></span><span><small>${ago(t.updated_at)}</small></span><span class="adm-acts"><button class="btn btn-ghost btn-sm" data-del="${esc(t.key)}">Undo</button></span></div>`).join('')}</div>`;
    el.querySelector('[data-lang]').onchange = e => { sessionStorage.setItem('adm-lang', e.target.value); route(); };
    el.querySelector('[data-new]').onclick = () => modal(`<h2>Change a text</h2><form class="hub-form"><label>English text <small>(start typing to find it)</small><input name="key" list="admKeys" required></label><datalist id="admKeys">${Object.keys(base).slice(0, 3000).map(k => `<option value="${esc(k)}">`).join('')}</datalist><label>Translation<textarea name="value" rows="3" maxlength="2000" required></textarea></label><button class="btn btn-primary" type="submit">Save</button></form>`, (d, close) => {
      const f = d.querySelector('form'), k = f.querySelector('[name=key]'); k.onchange = () => { const cur = (data || []).find(x => x.key === k.value); f.querySelector('textarea').value = cur ? cur.value : base[k.value] || ''; };
      f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const { error: e2 } = await sb.from('translations').upsert({ lang, key: v.key, value: v.value, updated_at: new Date().toISOString() }); if (e2) say(f, e2.message); else { close(); route(); } }; });
    for (const b of el.querySelectorAll('[data-del]')) b.onclick = async () => { const { error: e2 } = await sb.from('translations').delete().eq('lang', lang).eq('key', b.dataset.del); if (e2) err(e2); else route(); };
  }

  // ---------- rewards and gifts ----------
  async function rewards(el) {
    const [{ data: prods }, { count: cf }, { count: sp }] = await Promise.all([sb.from('store_products').select('sku, label').order('sort'),
      sb.from('entitlements').select('user_id', { count: 'exact', head: true }).eq('sku', 'lk.event.community-founder').is('revoked_at', null), sb.from('entitlements').select('user_id', { count: 'exact', head: true }).eq('sku', 'lk.event.spotlight-2026').is('revoked_at', null)]);
    el.innerHTML = head('Rewards and gifts', 'Give an event reward or a product to one account: for contest winners, a refund in kind, or a mistake put right.')
      + `<form class="adm-filters card" data-find><input name="q" placeholder="Email, name or friend code" aria-label="Find an account" required><button class="btn btn-ghost btn-sm">Find</button></form><div data-found></div>
      <p class="muted small">Show Us Your Lighthouse: ${cf || 0} Community Founder badge${cf === 1 ? '' : 's'} given automatically; ${sp || 0} of 3 winners rewarded.</p>`;
    const box = el.querySelector('[data-found]');
    el.querySelector('[data-find]').onsubmit = async e => { e.preventDefault(); try { const r = await call('store', { action: 'find', q: new FormData(e.target).get('q') });
      box.innerHTML = (r.accounts || []).map(a => `<div class="adm-row"><span><b>${esc(a.name || a.email || a.id)}</b><br><small>${esc(a.email || '')} ${esc(a.code || '')}</small></span><span class="adm-acts"><button class="btn btn-primary btn-sm" data-win="${a.id}">Contest winner (Spotlight + 250 Lumens)</button><button class="btn btn-ghost btn-sm" data-cf="${a.id}">Community Founder badge</button><button class="btn btn-ghost btn-sm" data-gift="${a.id}">Give a product</button></span></div>`).join('') || '<p class="muted">Nobody found.</p>';
      for (const a of r.accounts || []) names.set(a.id, a.name || a.email);
      for (const b of box.querySelectorAll('[data-win]')) b.onclick = () => confirmBox('Reward a contest winner?', `<p>${esc(names.get(b.dataset.win))} gets the Spotlight lantern, the Featured Keeper title and 250 Lumens.</p>`, () => call('admin', { action: 'reward', user: b.dataset.win, reward: 'spotlight' }).then(x => modal(`<h2>${x.already ? 'Already given' : 'Given'}</h2>`)), 'Give');
      for (const b of box.querySelectorAll('[data-cf]')) b.onclick = () => call('admin', { action: 'reward', user: b.dataset.cf, reward: 'commfounder' }).then(x => modal(`<h2>${x.already ? 'Already given' : 'Given'}</h2>`), err);
      for (const b of box.querySelectorAll('[data-gift]')) b.onclick = () => modal(`<h2>Give a product to ${esc(names.get(b.dataset.gift))}</h2><form class="hub-form"><label>Product<select name="sku">${(prods || []).map(p => `<option value="${esc(p.sku)}">${esc(p.label)}</option>`).join('')}</select></label><label>Why <small>(kept with the order)</small><input name="note" maxlength="200" required></label><button class="btn btn-primary" type="submit">Give</button></form><p class="muted small">It shows in their purchases as a gift from the team; no money is involved.</p>`, (d, close) => {
        const f = d.querySelector('form'); f.onsubmit = e2 => { e2.preventDefault(); const v = Object.fromEntries(new FormData(f)); call('store', { action: 'grant', user: b.dataset.gift, sku: v.sku, note: v.note }).then(() => { close(); modal('<h2>Given</h2>'); }, x => say(f, x.message)); }; });
    } catch (x) { box.innerHTML = `<p>${esc(x.message)}</p>`; } };
  }
};
