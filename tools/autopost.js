#!/usr/bin/env node
// Social autopilot (0.31): posts what social/schedule.json says, when it says, to the Facebook Page, Instagram and TikTok.
// Run by .github/workflows/autopost.yml every 30 minutes (free: this repository is public), or by hand:
//   node tools/autopost.js --dry        what would be posted now (no requests, no secrets needed)
//   node tools/autopost.js              post what is due; record it in social/posted.json (the workflow commits it)
//   node tools/autopost.js --list       the whole schedule with its state
// A post: { id, at: "2026-10-17T19:00:00+08:00", kind: "image" | "carousel" | "video" | "story", media: ["social/media/x.mp4"],
//           to: ["facebook", "instagram", "tiktok"], caption: { default, facebook?, instagram?, tiktok? } }
// Media files live in this repository under social/media/ and are served by the website, because Meta fetches them by
// address. TikTok: the video goes to the account's TikTok inbox (drafts) and is published there with one tap, until
// TikTok audits the app (unaudited apps can't post publicly). Images are not sent to TikTok (photo posts need a verified
// domain); post those from the phone.
// Secrets (repository settings, set by tools/autopost-auth.js, never printed): META_PAGE_TOKEN, TIKTOK_CLIENT_KEY,
// TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN. Variables: META_PAGE_ID, META_IG_ID. A platform without them is skipped.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SCHED = path.join(ROOT, 'social', 'schedule.json'), STATE = path.join(ROOT, 'social', 'posted.json');
const SITE = process.env.LK_SITE_URL || 'https://lk.exenova.is-local.host', GRAPH = 'https://graph.facebook.com/v26.0', RUPLOAD = 'https://rupload.facebook.com/video-upload/v26.0';
const args = process.argv.slice(2), DRY = args.includes('--dry'), LIST = args.includes('--list'), now = Date.now();
const env = k => (process.env[k] || '').trim();
const sched = JSON.parse(fs.readFileSync(SCHED, 'utf8')), state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const caption = (p, plat) => (p.caption && (p.caption[plat] || p.caption.default)) || '';
const url = f => SITE.replace(/\/$/, '') + '/' + f.replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
const MAX_TRIES = 3, LATE_MS = 864e5; // (a post more than a day overdue is not sent: it is marked missed instead, so a fixed sign-in never floods the feed)
// a sign-in the platform no longer accepts (expired, the app's secret reset, the app removed from the account): every post
// there would fail the same way, so the run stops trying that platform, keeps the posts' tries, and says what to do
const AUTH = /Cannot call API for app|Error validating access token|Session has expired|has not authorized application|invalid OAuth|OAuthException|access token.*(expired|invalid)|TikTok sign-in/i;
const FIX = { facebook: 'node tools/autopost-auth.js meta', instagram: 'node tools/autopost-auth.js meta', tiktok: 'node tools/autopost-auth.js tiktok' };

// ---- the schedule's own checks (also run by --dry, so a broken schedule fails before anything is posted) ----
const PLATS = ['facebook', 'instagram', 'tiktok'], KINDS = ['image', 'carousel', 'video', 'story'], problems = [];
const ids = new Set();
for (const p of sched.posts) {
  const where = `post ${p.id || '(no id)'}`;
  if (!p.id || ids.has(p.id)) problems.push(`${where}: a missing or repeated id`); ids.add(p.id);
  if (isNaN(Date.parse(p.at)) || !/[+-]\d\d:\d\d$|Z$/.test(p.at)) problems.push(`${where}: "at" needs a date, a time and a time zone`);
  if (!KINDS.includes(p.kind)) problems.push(`${where}: kind must be one of ${KINDS.join(', ')}`);
  if (!(p.to || []).length || p.to.some(t => !PLATS.includes(t))) problems.push(`${where}: "to" must list some of ${PLATS.join(', ')}`);
  for (const m of p.media || []) if (!fs.existsSync(path.join(ROOT, m))) problems.push(`${where}: ${m} is not in the repository`);
  if (!(p.media || []).length) problems.push(`${where}: no media`);
  if (p.kind === 'carousel' && (p.media.length < 2 || p.media.length > 10)) problems.push(`${where}: a carousel has 2 to 10 pictures`);
  if ((p.kind === 'image' || p.kind === 'video' || p.kind === 'story') && p.media.length !== 1) problems.push(`${where}: a ${p.kind} has one file`);
  if (p.kind === 'video' && !/\.mp4$/i.test(p.media[0])) problems.push(`${where}: videos are .mp4`);
  if ((p.kind === 'image' || p.kind === 'carousel') && p.media.some(m => !/\.(jpe?g|png)$/i.test(m))) problems.push(`${where}: pictures are .jpg or .png`);
  if (caption(p, 'instagram').length > 2200) problems.push(`${where}: the Instagram caption is over 2,200 characters`);
  if ((caption(p, 'instagram').match(/#/g) || []).length > 30) problems.push(`${where}: Instagram allows 30 hashtags`);
  if (caption(p, 'tiktok').length > 2200) problems.push(`${where}: the TikTok caption is over 2,200 characters`);
}
if (problems.length) { console.error('The schedule has problems:\n  ' + problems.join('\n  ')); process.exit(1); }

if (LIST) {
  for (const p of [...sched.posts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) console.log(`${p.at}  ${p.id.padEnd(30)} ${p.kind.padEnd(8)} ` + p.to.map(t => `${t}:${(state[p.id] || {})[t] ? (state[p.id][t].id ? 'done' : state[p.id][t].missed ? 'missed' : state[p.id][t].skipped ? 'skipped' : 'error') : Date.parse(p.at) > now ? 'later' : 'due'}`).join(' '));
  process.exit(0);
}

// ---- Facebook and Instagram (Graph API) ----
const META = { page: env('META_PAGE_ID'), ig: env('META_IG_ID'), token: env('META_PAGE_TOKEN') };
async function graph(method, p, params = {}) {
  const body = new URLSearchParams(); for (const [k, v] of Object.entries(params)) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  body.set('access_token', META.token);
  const r = await fetch(GRAPH + p + (method === 'GET' ? '?' + body : ''), method === 'GET' ? {} : { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Graph ${p}: ${(j.error && (j.error.error_user_msg || j.error.message)) || r.status}`);
  return j;
}
async function facebook(p) {
  const text = caption(p, 'facebook'), m = p.media;
  if (p.kind === 'image') return (await graph('POST', `/${META.page}/photos`, { url: url(m[0]), message: text })).post_id;
  if (p.kind === 'carousel') {
    const ids = []; for (const f of m) ids.push((await graph('POST', `/${META.page}/photos`, { url: url(f), published: 'false' })).id);
    const params = { message: text }; ids.forEach((id, i) => { params[`attached_media[${i}]`] = { media_fbid: id }; });
    return (await graph('POST', `/${META.page}/feed`, params)).id;
  }
  if (p.kind === 'video') { // a Reel: start, let Facebook fetch the file, finish (published)
    const s = await graph('POST', `/${META.page}/video_reels`, { upload_phase: 'start' });
    const up = await fetch(`${RUPLOAD}/${s.video_id}`, { method: 'POST', headers: { Authorization: `OAuth ${META.token}`, file_url: url(m[0]) } });
    const uj = await up.json().catch(() => ({})); if (!up.ok || !uj.success) throw new Error('Facebook Reel upload: ' + JSON.stringify(uj).slice(0, 200));
    await graph('POST', `/${META.page}/video_reels`, { upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: text });
    return s.video_id;
  }
  if (p.kind === 'story') {
    if (/\.mp4$/i.test(m[0])) { const s = await graph('POST', `/${META.page}/video_stories`, { upload_phase: 'start' });
      const up = await fetch(`${RUPLOAD}/${s.video_id}`, { method: 'POST', headers: { Authorization: `OAuth ${META.token}`, file_url: url(m[0]) } }); if (!up.ok) throw new Error('Facebook story upload failed');
      return (await graph('POST', `/${META.page}/video_stories`, { upload_phase: 'finish', video_id: s.video_id })).post_id || s.video_id; }
    const photo = await graph('POST', `/${META.page}/photos`, { url: url(m[0]), published: 'false' });
    return (await graph('POST', `/${META.page}/photo_stories`, { photo_id: photo.id })).post_id;
  }
}
async function igWait(id) { // a container must be FINISHED before it can be published (videos take a while)
  for (let i = 0; i < 40; i++) { const s = await graph('GET', `/${id}`, { fields: 'status_code' }); if (s.status_code === 'FINISHED') return; if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram could not process the media (' + s.status_code + ')'); await sleep(15000); }
  throw new Error('Instagram took more than 10 minutes to process the media');
}
async function instagram(p) {
  const text = caption(p, 'instagram'), m = p.media, ig = META.ig, isVid = f => /\.mp4$/i.test(f);
  let c;
  if (p.kind === 'image') c = await graph('POST', `/${ig}/media`, { image_url: url(m[0]), caption: text });
  if (p.kind === 'carousel') { const kids = []; for (const f of m) kids.push((await graph('POST', `/${ig}/media`, { image_url: url(f), is_carousel_item: 'true' })).id);
    c = await graph('POST', `/${ig}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: text }); }
  if (p.kind === 'video') c = await graph('POST', `/${ig}/media`, { media_type: 'REELS', video_url: url(m[0]), caption: text, share_to_feed: 'true' });
  if (p.kind === 'story') c = await graph('POST', `/${ig}/media`, isVid(m[0]) ? { media_type: 'STORIES', video_url: url(m[0]) } : { media_type: 'STORIES', image_url: url(m[0]) });
  await igWait(c.id);
  return (await graph('POST', `/${ig}/media_publish`, { creation_id: c.id })).id;
}

// ---- TikTok (Content Posting API: upload to the creator's inbox) ----
let tiktokToken = null;
async function tiktokAuth() {
  if (tiktokToken) return tiktokToken;
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), grant_type: 'refresh_token', refresh_token: env('TIKTOK_REFRESH_TOKEN') }) });
  const j = await r.json().catch(() => ({})); if (!j.access_token) throw new Error('TikTok sign-in: ' + (j.error_description || j.error || r.status) + ' (run tools/autopost-auth.js tiktok again)');
  return (tiktokToken = j.access_token);
}
async function tiktok(p) {
  if (p.kind !== 'video') return { skipped: 'TikTok gets videos only: post pictures from the phone' };
  const file = fs.readFileSync(path.join(ROOT, p.media[0])), tok = await tiktokAuth();
  const init = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: file.length, chunk_size: file.length, total_chunk_count: 1 } }) });
  const ij = await init.json().catch(() => ({})); if (!ij.data || !ij.data.upload_url) throw new Error('TikTok upload start: ' + JSON.stringify(ij.error || ij).slice(0, 200));
  const put = await fetch(ij.data.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(file.length), 'Content-Range': `bytes 0-${file.length - 1}/${file.length}` }, body: file });
  if (!put.ok && put.status !== 201) throw new Error('TikTok upload: HTTP ' + put.status);
  return { id: ij.data.publish_id, note: 'in the TikTok inbox: open TikTok, tap the notification, paste the caption, post' };
}

// ---- the run ----
(async () => {
  const ready = { facebook: !!(META.page && META.token), instagram: !!(META.ig && META.token), tiktok: !!(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET') && env('TIKTOK_REFRESH_TOKEN')) };
  const due = sched.posts.filter(p => Date.parse(p.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let posted = 0, failed = 0; const done = new Set(), down = new Set(); // (one post a platform a run: a backlog goes out half an hour apart)
  for (const p of due) {
    const st = state[p.id] = state[p.id] || {};
    for (const plat of p.to) {
      const s = st[plat]; if (s && (s.id || s.skipped || s.missed || (s.tries || 0) >= MAX_TRIES)) continue;
      if (now - Date.parse(p.at) > LATE_MS) { st[plat] = { missed: true, at: new Date().toISOString() }; console.log(`missed: ${p.id} on ${plat} (over a day late)`); continue; }
      if (down.has(plat) || done.has(plat)) continue;
      if (!ready[plat]) { if (!DRY) console.log(`not set up: ${plat} (skipping ${p.id} there for now)`); else console.log(`would post ${p.id} (${p.kind}) to ${plat}, but ${plat} is not set up`); continue; }
      if (DRY) { console.log(`would post ${p.id} (${p.kind}) to ${plat}: ${caption(p, plat).slice(0, 60).replace(/\n/g, ' ')}...`); continue; }
      try {
        if (plat !== 'tiktok') { // Meta fetches the files from the website: make sure they are there
          for (const m of p.media) { const h = await fetch(url(m), { method: 'HEAD' }).catch(() => ({ ok: false })); if (!h.ok) throw new Error(`${url(m)} is not on the website yet (wait for the site to publish)`); }
        }
        const r = plat === 'facebook' ? await facebook(p) : plat === 'instagram' ? await instagram(p) : await tiktok(p);
        st[plat] = typeof r === 'object' ? { ...r, at: new Date().toISOString() } : { id: r, at: new Date().toISOString() };
        console.log(`${st[plat].skipped ? 'skipped' : 'posted'}: ${p.id} on ${plat}${st[plat].note ? ' (' + st[plat].note + ')' : ''}`); posted++; if (!st[plat].skipped) done.add(plat);
        // TikTok's inbox upload carries no caption: put it on the run's summary page, to copy from the phone
        if (plat === 'tiktok' && !st[plat].skipped && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### TikTok inbox: ${p.id}\nOpen TikTok, tap the notification, paste this caption, post:\n\n\`\`\`\n${caption(p, 'tiktok')}\n\`\`\`\n\n`);
      } catch (e) {
        const msg = String(e.message || e).slice(0, 300);
        if (AUTH.test(msg)) { // (Facebook and Instagram share one sign-in)
          for (const x of plat === 'tiktok' ? ['tiktok'] : ['facebook', 'instagram']) down.add(x);
          st[plat] = { tries: (s && s.tries) || 0, error: msg, at: new Date().toISOString() }; failed++;
          console.error(`SIGN-IN NEEDED for ${plat}: ${msg}\n  Fix: on the owner's computer, in lantern-keeper-site, run: ${FIX[plat]}\n  (posts wait and go out once it works; ones more than a day late are skipped)`);
          if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Sign-in needed: ${plat}\n${msg}\n\nOn your computer, in lantern-keeper-site: \`${FIX[plat]}\`\n\n`);
          save(); continue;
        }
        st[plat] = { tries: ((s && s.tries) || 0) + 1, error: String(e.message || e).slice(0, 300), at: new Date().toISOString() }; failed++;
        console.error(`failed (try ${st[plat].tries} of ${MAX_TRIES}): ${p.id} on ${plat}: ${st[plat].error}`);
      }
      save();
    }
  }
  if (!DRY) save();
  console.log(DRY ? 'dry run: nothing was sent' : `done: ${posted} posted, ${failed} failed`);
  if (failed) process.exitCode = 1; // (the workflow run shows red and GitHub emails the owner)
})().catch(e => { console.error(e.message || e); process.exit(1); });
