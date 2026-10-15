#!/usr/bin/env node
// One-time setup for the social autopilot (tools/autopost.js). The OWNER runs this in their own terminal; it turns a
// sign-in into long-lasting tokens and stores them straight into this repository's GitHub secrets with the gh CLI.
// Tokens are never printed or written to a file.
//   node tools/autopost-auth.js meta     Facebook Page + Instagram (needs META_APP_ID and META_APP_SECRET set in this terminal)
//   node tools/autopost-auth.js tiktok   TikTok inbox uploads (needs TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET set in this terminal)
//   node tools/autopost-auth.js check    which secrets and variables are set (names only)
// Steps for each are in social/README.md.
'use strict';
const { execFileSync } = require('child_process'), readline = require('readline'), crypto = require('crypto');
const REPO = process.env.LK_SITE_REPO || 'ExtremeKnight/lantern-keeper-site', GRAPH = 'https://graph.facebook.com/v26.0';
const REDIRECT = 'https://lk.exenova.is-local.host/social/tiktok-auth.html';
const env = k => (process.env[k] || '').trim().replace(/^["']|["']$/g, ''), need = (...ks) => { const miss = ks.filter(k => !env(k)); if (miss.length) { console.error(`Set ${miss.join(' and ')} in this terminal first (see social/README.md).`); process.exit(1); } };
const secret = (name, value) => { execFileSync('gh', ['secret', 'set', name, '-R', REPO], { input: value, stdio: ['pipe', 'ignore', 'inherit'] }); console.log(`  saved secret ${name}`); };
const variable = (name, value) => { execFileSync('gh', ['variable', 'set', name, '-R', REPO, '--body', String(value)], { stdio: ['ignore', 'ignore', 'inherit'] }); console.log(`  saved variable ${name} = ${value}`); };
// ask for a line; hidden: don't echo it (for tokens)
const ask = (q, hidden) => new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) { rl._writeToOutput = s => { if (/\r?\n/.test(s) || s === q) rl.output.write(s.includes(q) ? q : '\n'); }; }
  rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a.trim()); }); });
const getJSON = async (u, o) => { const r = await fetch(u, o), j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error((j.error && (j.error.message || j.error_description || j.error)) || j.error_description || r.status); return j; };

// a value from the terminal's environment, or asked for (hidden for secrets); kept in this process only
// (an ID that isn't a number, like a placeholder left over from an example, is asked for again)
async function setting(k, q, hidden) { const bad = () => !env(k) || (/_ID$/.test(k) && !/^\d{5,}$/.test(env(k))); if (bad()) process.env[k] = await ask(q, hidden); if (bad()) throw new Error(`${k} must be the number from App settings > Basic.`); }
async function meta() {
  await setting('META_APP_ID', 'Meta App ID (App settings > Basic; the main app, not the Instagram or Threads one): ');
  await setting('META_APP_SECRET', 'Meta App secret (it will not show as you paste): ', true);
  console.log('Paste the user access token from the Graph API Explorer (it will not show as you paste):');
  const short = await ask('token: ', true); if (!short) throw new Error('No token pasted.');
  // which app made this token? (a user token can describe itself) It must be the same app as META_APP_ID
  const self = await getJSON(`${GRAPH}/debug_token?` + new URLSearchParams({ input_token: short, access_token: short })).catch(e => { throw new Error('Facebook did not accept the pasted token (' + e.message + '). Generate a new one in the Graph API Explorer and paste it whole.'); });
  const tokApp = String(self.data && self.data.app_id || ''), tokApp2 = self.data && self.data.application;
  console.log(`  The token was made in the app "${tokApp2 || '?'}" (App ID ${tokApp}), and has: ${(self.data && self.data.scopes || []).join(', ') || 'no permissions'}`);
  if (tokApp && tokApp !== env('META_APP_ID')) throw new Error(`META_APP_ID is ${env('META_APP_ID') || '(empty)'}, but the token is from App ID ${tokApp}. Set META_APP_ID (and META_APP_SECRET) to that app's own values from App settings > Basic (not the Instagram or Threads ones), or pick the right app in the Explorer.`);
  const long = await getJSON(`${GRAPH}/oauth/access_token?` + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: short }))
    .catch(e => { throw new Error(`${e.message}. Check META_APP_SECRET: it must be the secret of App ID ${env('META_APP_ID')} (App settings > Basic > App secret > Show), with no spaces or quotes.`); });
  const pages = (await getJSON(`${GRAPH}/me/accounts?` + new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: long.access_token }))).data || [];
  if (!pages.length) throw new Error('This sign-in manages no Facebook Page. In the Explorer, tick pages_show_list and choose the Lantern Keeper Page when Facebook asks.');
  let page = pages.find(p => /lantern keeper/i.test(p.name));
  if (!page || pages.filter(p => /lantern keeper/i.test(p.name)).length > 1) { pages.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.id})`)); page = pages[(+await ask('Which Page? number: ')) - 1]; }
  if (!page) throw new Error('No Page chosen.');
  const ig = page.instagram_business_account;
  console.log(`Page: ${page.name} (${page.id})` + (ig ? `, Instagram: @${ig.username} (${ig.id})` : ', no Instagram professional account linked to it'));
  // a Page token made from a long-lived user token does not expire (until the password changes or access is removed)
  const dbg = await getJSON(`${GRAPH}/debug_token?` + new URLSearchParams({ input_token: page.access_token, access_token: `${env('META_APP_ID')}|${env('META_APP_SECRET')}` }));
  console.log(`  Page token: expires ${dbg.data && dbg.data.expires_at ? new Date(dbg.data.expires_at * 1000).toISOString() : 'never'}; permissions: ${(dbg.data && dbg.data.scopes || []).join(', ')}`);
  const want = ['pages_manage_posts', 'pages_read_engagement'].concat(ig ? ['instagram_basic', 'instagram_content_publish'] : []), missing = want.filter(s => !(dbg.data && dbg.data.scopes || []).includes(s));
  if (missing.length) console.log(`  Missing permissions: ${missing.join(', ')}. Tick them in the Explorer and run this again.`);
  secret('META_PAGE_TOKEN', page.access_token); variable('META_PAGE_ID', page.id); if (ig) variable('META_IG_ID', ig.id);
  console.log('Facebook' + (ig ? ' and Instagram are' : ' is') + ' ready. Try: Actions > Social autopilot > Run workflow (dry run).');
}

async function tiktok() {
  await setting('TIKTOK_CLIENT_KEY', 'TikTok Client key: '); await setting('TIKTOK_CLIENT_SECRET', 'TikTok Client secret (it will not show as you paste): ', true);
  const st = crypto.randomBytes(12).toString('hex');
  const auth = 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), scope: 'user.info.basic,video.upload', response_type: 'code', redirect_uri: REDIRECT, state: st });
  console.log('1. Open this address, signed in to TikTok as @l4nternkeeper, and allow it:\n\n' + auth + '\n\n2. The page it lands on shows a code. Paste it here.');
  let code = await ask('code: ', true); try { code = decodeURIComponent(code); } catch (e) { /* already plain */ }
  const t = await getJSON('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), code, grant_type: 'authorization_code', redirect_uri: REDIRECT }) });
  if (!t.refresh_token) throw new Error('TikTok did not return a token: ' + (t.error_description || t.error || 'unknown'));
  console.log(`  Signed in; scopes: ${t.scope}; the sign-in lasts until ${new Date(Date.now() + (t.refresh_expires_in || 0) * 1000).toISOString().slice(0, 10)} (run this again before then).`);
  secret('TIKTOK_CLIENT_KEY', env('TIKTOK_CLIENT_KEY')); secret('TIKTOK_CLIENT_SECRET', env('TIKTOK_CLIENT_SECRET')); secret('TIKTOK_REFRESH_TOKEN', t.refresh_token);
  console.log('TikTok is ready: videos will arrive in the TikTok app\'s inbox, ready to post with one tap.');
}

function check() {
  const s = execFileSync('gh', ['secret', 'list', '-R', REPO]).toString(), v = execFileSync('gh', ['variable', 'list', '-R', REPO]).toString();
  for (const k of ['META_PAGE_TOKEN', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN']) console.log(`${s.includes(k) ? 'set    ' : 'missing'} secret ${k}`);
  for (const k of ['META_PAGE_ID', 'META_IG_ID']) console.log(`${v.includes(k) ? 'set    ' : 'missing'} variable ${k}`);
}

const cmd = process.argv[2];
(cmd === 'meta' ? meta() : cmd === 'tiktok' ? tiktok() : cmd === 'check' ? Promise.resolve(check()) : Promise.reject(new Error('Use: node tools/autopost-auth.js meta | tiktok | check')))
  .catch(e => { console.error('Stopped: ' + (e.message || e)); process.exitCode = 1; }); // (not process.exit: on Windows it can crash while the terminal input is still closing)
