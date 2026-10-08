/* The events page (0.31): the game's events (scheduled from the dashboard: public.game_events) and the community's
   event posts, in the visitor's own time zone, each with a calendar file (.ics) and a Google Calendar link. */
(function () {
  'use strict';
  const CFG = { url: 'https://odnjaegbkudwsfrwnjiy.supabase.co', key: 'sb_publishable_IUdpT3MRtokyJD3SsNNF0Q_eZAovpor' };
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.LK_HUB_CFG) Object.assign(CFG, window.LK_HUB_CFG); // (tests)
  const next = document.querySelector('[data-events="next"]'), past = document.querySelector('[data-events="past"]'); if (!next) return;
  const t = s => (window.LKI18N ? LKI18N.t(s) : s), esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const get = path => fetch(`${CFG.url}/rest/v1/${path}`, { headers: { apikey: CFG.key } }).then(r => r.ok ? r.json() : []).catch(() => []);
  const fmt = d => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // (20261010T160000Z)
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
  function ics(e) {
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Exenova//Lantern Keeper//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${e.uid}@lk.exenova.is-local.host`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
      `SUMMARY:${icsEsc('Lantern Keeper: ' + e.name)}`, `DESCRIPTION:${icsEsc(e.text + (e.link ? '\n' + e.link : ''))}`, `URL:${e.link || 'https://lk.exenova.is-local.host/events.html'}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.name)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  }
  const gcal = e => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Lantern Keeper: ' + e.name) + '&dates=' + stamp(e.start) + '/' + stamp(e.end) + '&details=' + encodeURIComponent(e.text + (e.link ? '\n' + e.link : ''));
  const card = e => { const now = Date.now(), live = e.start <= now && e.end > now;
    return `<article class="card ev${live ? ' ev-live' : ''}"><p class="ev-when">${live ? `<b>${esc(t('Happening now'))}</b> · ` : ''}${esc(fmt(e.start))} → ${esc(fmt(e.end))}</p><h3>${esc(e.name)}</h3>${e.bonus ? `<p class="ev-bonus">${esc(e.bonus)}</p>` : ''}<p class="muted">${esc(e.text)}</p>
      <p class="ev-acts">${e.end > now ? `<a class="btn btn-ghost btn-sm" href="${ics(e)}" download="lantern-keeper-${esc(e.uid)}.ics">${esc(t('Add to calendar'))}</a><a class="btn btn-ghost btn-sm" href="${gcal(e)}" target="_blank" rel="noopener">${esc(t('Google Calendar'))}</a>` : ''}${e.link ? `<a class="btn btn-ghost btn-sm" href="${esc(e.link)}">${esc(t('Read more'))}</a>` : ''}</p></article>`; };
  (async () => {
    const since = new Date(Date.now() - 45 * 864e5).toISOString();
    const [games, posts] = await Promise.all([
      get(`game_events?select=id,name,text,starts_at,ends_at,embers&published=eq.true&ends_at=gt.${encodeURIComponent(since)}&order=starts_at.asc&limit=40`),
      get(`community_posts?select=id,title,body,starts_at,ends_at&category=eq.events&published=eq.true&status=eq.visible&starts_at=not.is.null&order=starts_at.asc&limit=40`)]);
    const all = (Array.isArray(games) ? games : []).map(g => ({ uid: 'game-' + g.id, name: g.name, text: g.text || '', start: Date.parse(g.starts_at), end: Date.parse(g.ends_at), bonus: g.embers > 1 ? t('In the game: +{a}% embers from nights against the fog').replace('{a}', Math.round((g.embers - 1) * 100)) : '', link: '' }))
      .concat((Array.isArray(posts) ? posts : []).map(p => ({ uid: 'post-' + p.id, name: p.title, text: String(p.body || '').replace(/\s+/g, ' ').slice(0, 220), start: Date.parse(p.starts_at), end: p.ends_at ? Date.parse(p.ends_at) : Date.parse(p.starts_at) + 2 * 36e5, link: 'community.html#/p/' + p.id })))
      .filter(e => e.start && e.end).sort((a, b) => a.start - b.start), now = Date.now();
    const up = all.filter(e => e.end > now), done = all.filter(e => e.end <= now && e.end > now - 45 * 864e5).reverse();
    next.innerHTML = up.length ? up.map(card).join('') : `<p class="muted">${esc(t('Nothing scheduled right now. Follow the News and the community for what comes next.'))}</p>`;
    past.innerHTML = done.length ? done.map(card).join('') : `<p class="muted">${esc(t('No events in the last weeks.'))}</p>`;
  })();
})();
