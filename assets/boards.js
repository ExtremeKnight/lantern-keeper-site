/* The leaderboards page (0.31): the daily challenge and the Endless night, read from the leaderboards function (the
   same boards as in the game: Challenges > Leaderboards). Hidden profiles are "A keeper"; shown ones link to their page. */
(function () {
  'use strict';
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor' };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests)
  const root = document.querySelector('[data-boards]'); if (!root) return;
  const t = s => (window.LKI18N ? LKI18N.t(s) : s), esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ymd = d => d.toISOString().slice(0, 10);
  const isoWeek = d => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
    const y = x.getUTCFullYear(), w = Math.ceil(((x - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`; };
  const boardOf = k => { const now = new Date(); return k === 'daily' ? 'daily:' + ymd(now) : k === 'daily-1' ? 'daily:' + ymd(new Date(now - 864e5)) : k === 'endless' ? 'endless:' + isoWeek(now) : 'endless:' + isoWeek(new Date(now - 7 * 864e5)); };
  const list = root.querySelector('[data-board-list]'), note = root.querySelector('[data-board-note]');
  let cur = (location.hash.match(/^#(daily(-1)?|endless(-1)?)$/) || [])[1] || 'daily', seq = 0;
  async function show(k) {
    cur = k; const my = ++seq;
    for (const b of root.querySelectorAll('[data-board]')) b.setAttribute('aria-selected', String(b.dataset.board === k));
    if (history.replaceState) history.replaceState(null, '', '#' + k);
    const board = boardOf(k); note.textContent = board.startsWith('daily:') ? t('Daily challenge of') + ' ' + board.slice(6) : t('Endless night, week') + ' ' + board.slice(8);
    list.innerHTML = `<p class="muted">${esc(t('Loading the leaderboard…'))}</p>`;
    try {
      const r = await fetch(`${CFG.url}/functions/v1/leaderboards`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + CFG.key }, body: JSON.stringify({ action: 'top', board, limit: 100 }) });
      const b = await r.json(); if (my !== seq) return; if (!r.ok) throw new Error(b.error || r.status);
      const rows = b.rows || [];
      list.innerHTML = rows.length ? `<table><thead><tr><th scope="col">${esc(t('Rank'))}</th><th scope="col">${esc(t('Keeper'))}</th><th scope="col">${esc(t('Result'))}</th><th scope="col" class="hide-sm">${esc(t('Creatures defeated'))}</th></tr></thead><tbody>${rows.map(x => `<tr class="${x.rank <= 3 ? 'top' + x.rank : ''}"><td><b>#${x.rank}</b></td><td translate="no">${x.user_id ? `<a href="community.html#/k/${esc(x.user_id)}">${esc(x.name)}</a>` : esc(x.name)}</td><td>${x.stage ? esc(t('Stage')) + ' ' + x.stage + (x.win ? ' ✓' : '') : esc(t('Wave')) + ' ' + x.wave}</td><td class="hide-sm">${Number(x.kills).toLocaleString()}</td></tr>`).join('')}</tbody></table>`
        : `<p class="muted">${esc(t('No results on this board yet. Play signed in to be the first.'))}</p>`;
    } catch (e) { if (my === seq) list.innerHTML = `<p class="muted">${esc(t('The leaderboard could not load. Try again in a moment.'))}</p>`; }
  }
  root.addEventListener('click', e => { const b = e.target.closest('[data-board]'); if (b) show(b.dataset.board); });
  root.querySelector('[role=tablist]').addEventListener('keydown', e => { if (!/^Arrow(Left|Right)$/.test(e.key)) return; const tabs = [...root.querySelectorAll('[data-board]')], i = tabs.findIndex(b => b.dataset.board === cur), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); show(n.dataset.board); });
  show(cur);
})();
