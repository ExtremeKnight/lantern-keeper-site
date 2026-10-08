// Lantern Keeper's email design (0.29; redesigned in 0.30.1): plain JavaScript used by tools/emails.js (Node: the account
// emails Supabase sends, and previews), by email-render.js and by the send-emails function (Deno), so every email looks
// the same. Built for email programs, not browsers: tables for layout, every style inline, 600px wide at most, images
// hosted on the website (JPEG and PNG, drawn by tools/email-art.js), near-black colours instead of pure black so dark
// mode doesn't invert them, and a bright filled button that reads in light and dark mode.
// The look: the pixel wordmark, a banner of the lighthouse at night chosen by the kind of email, a status label, the
// heading in the game's pixel font where the email program can show it (Arial elsewhere), a lantern divider, a
// receipt-style details card, and a sign-off from the team.
export const SITE = 'https://lk.exenova.is-local.host/';
export const C = { bg: '#0a0f24', card: '#121a3a', card2: '#0e1533', line: '#26305a', line2: '#34407a', gold: '#ffcf66', gold2: '#ffb938', text: '#e8eaf6', mute: '#aab0d0', dim: '#7c84ab', ink: '#1d1405' };
export const BANNERS = ['welcome', 'payment', 'club', 'support', 'security', 'community', 'update', 'event', 'giveaway', 'notice', 'maintenance'];
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = 'Arial,Helvetica,sans-serif', PIXEL = `'Jersey 10',${F}`;

// ---------- the parts ----------
export const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto 6px"><tr><td align="center" bgcolor="${C.gold}" style="border-radius:14px;background:${C.gold};background-image:linear-gradient(180deg,${C.gold},${C.gold2});box-shadow:0 6px 22px rgba(255,185,56,.35)">
  <a href="${href}" style="display:inline-block;padding:15px 34px;font:700 17px/1.2 ${F};color:${C.ink};text-decoration:none;border-radius:14px;letter-spacing:.2px">${label}&nbsp;&rarr;</a></td></tr></table>`;
export const code = token => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr><td align="center" bgcolor="${C.card2}" style="background:${C.card2};border:1px dashed ${C.gold};border-radius:16px;padding:20px 10px">
  <div style="font:700 12px/1 ${F};letter-spacing:3px;text-transform:uppercase;color:${C.dim};margin:0 0 12px">Your code</div>
  <div style="font:700 40px/1 'Courier New',Courier,monospace;letter-spacing:12px;color:${C.gold}">${token}</div></td></tr></table>`;
export const p = (t, size = 16, color = C.text) => `<p style="margin:0 0 14px;font:${size}px/1.6 ${F};color:${color}">${t}</p>`;
export const h1 = t => `<h1 style="margin:0 0 14px;font:400 34px/1.1 ${PIXEL};color:#ffffff;letter-spacing:.5px">${t}</h1>`;
export const divider = () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr>
  <td width="45%" style="border-bottom:1px solid ${C.line};font-size:0;line-height:0">&nbsp;</td><td align="center" style="padding:0 10px;font:14px/1 ${F};color:${C.gold};white-space:nowrap">&#10022;</td><td width="45%" style="border-bottom:1px solid ${C.line};font-size:0;line-height:0">&nbsp;</td></tr></table>`;
// a receipt: [label, value] rows; the rows matching `big` (Amount, Price, Refund) stand out in gold
export function receipt(rows, title = 'Details', big = /^(Amount|Price|Refund)$/) {
  const td = (i, s) => `padding:11px 18px;${i ? `border-top:1px solid ${C.line};` : ''}${s}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card2}" style="margin:4px 0 20px;background:${C.card2};border:1px solid ${C.line};border-radius:16px;border-collapse:separate">
  <tr><td colspan="2" style="padding:12px 18px;border-bottom:1px dashed ${C.line2};font:700 11px/1 ${F};letter-spacing:2.5px;text-transform:uppercase;color:${C.gold}">&#10022;&nbsp; ${esc(title)}</td></tr>
  ${rows.map(([k, v], i) => big.test(k)
    ? `<tr><td style="${td(i, `font:14px/1.4 ${F};color:${C.mute};width:40%`)}">${esc(k)}</td><td style="${td(i, `font:700 22px/1.2 ${F};color:${C.gold}`)}">${esc(v)}</td></tr>`
    : `<tr><td style="${td(i, `font:14px/1.4 ${F};color:${C.dim};width:40%`)}">${esc(k)}</td><td style="${td(i, `font:700 15px/1.4 ${F};color:${C.text}`)}">${esc(v)}</td></tr>`).join('')}</table>`;
}
export const label = (text, color = '#8fd3ff', fill = 'rgba(143,211,255,.12)') => `<p style="margin:0 0 12px"><span style="display:inline-block;padding:5px 12px;border-radius:999px;border:1px solid ${color};background:${fill};font:700 11px/1.4 ${F};letter-spacing:1.5px;text-transform:uppercase;color:${color}">${esc(text)}</span></p>`;
const signoff = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0"><tr>
  <td valign="middle" style="padding-right:12px"><img src="${SITE}assets/img/icon-64.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
  <td valign="middle" style="font:14px/1.45 ${F};color:${C.mute}">Keep the light burning,<br><b style="color:${C.text}">The Lantern Keeper team</b></td></tr></table>`;

// hero: one of BANNERS (or none); sign: the team's sign-off
export function layout({ preheader, body, footer, hero = '', sign = false }) {
  const banner = BANNERS.includes(hero) ? `<tr><td style="padding:0;font-size:0;line-height:0"><img src="${SITE}assets/email/banner-${hero}.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:20px 20px 0 0"></td></tr>` : '';
  const link = (href, t) => `<a href="${SITE}${href}" style="color:${C.mute};text-decoration:none;font-weight:700">${t}</a>`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>Lantern Keeper</title>
<link href="https://fonts.googleapis.com/css2?family=Jersey+10&amp;display=swap" rel="stylesheet">
<style>@media (max-width:620px){.card{border-radius:0!important}.card img{border-radius:0!important}.pad{padding:22px 20px 26px!important}.mark{width:220px!important}}a{color:${C.gold}}</style></head>
<body style="margin:0;padding:0;background:${C.bg}" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${preheader}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}"><tr><td align="center" style="padding:22px 0 28px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
    <tr><td align="center" style="padding:0 20px 16px"><a href="${SITE}" style="text-decoration:none"><img class="mark" src="${SITE}assets/email/wordmark.png" width="260" alt="Lantern Keeper" style="display:block;width:260px;max-width:70%;height:auto;border:0;font:700 24px ${F};color:${C.gold}"></a></td></tr>
    <tr><td class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${banner}<tr><td class="pad" style="padding:${banner ? '6px' : '30px'} 36px 32px">
${body}${sign ? signoff : ''}
      </td></tr></table></td></tr>
    <tr><td align="center" style="padding:22px 24px 4px">
      <p style="margin:0 0 14px;font:13px/1.6 ${F};color:${C.mute}">${link('play/', 'Play')} &nbsp;&middot;&nbsp; ${link('community.html', 'Community')} &nbsp;&middot;&nbsp; ${link('store.html', 'Store')} &nbsp;&middot;&nbsp; ${link('support.html', 'Help')}</p>
      <p style="margin:0 0 10px;font:12px/1.6 ${F};color:${C.dim}">${footer}</p>
      <p style="margin:0;font:12px/1.6 ${F};color:${C.dim}">Exenova &middot; Lantern Keeper &middot; <a href="mailto:l4nternkeeper@gmail.com" style="color:${C.dim}">l4nternkeeper@gmail.com</a> &middot; <a href="${SITE}privacy-policy.html" style="color:${C.dim}">Privacy</a></p>
    </td></tr>
  </table></td></tr></table>
</body></html>
`;
}
