// Turns an email template (email-templates.js, or its live copy in email_templates) into the email itself (0.30.1):
// the Lantern Keeper design (email-layout.js), a status label in the template's colour, the body's paragraphs, lines
// like "Amount: ₱559.00" as a tidy table (receipts, tickets, subscriptions), a button, and the footer each kind of email
// needs. Fields ({{name}}) are escaped. Used by the send-emails function and by tools/email-previews.js.
import { C, esc, button, p, h1, layout, receipt, label as pill, divider } from './email-layout.js';

const TONE = { info: ['#8fd3ff', 'rgba(143,211,255,.12)'], success: ['#7be0b0', 'rgba(123,224,176,.12)'], warning: ['#ffcf66', 'rgba(255,207,102,.12)'], danger: ['#ff8a7a', 'rgba(255,138,122,.12)'] };
const LABEL = { welcome: 'Welcome', security_alert: 'Security', payment_success: 'Payment successful', payment_pending: 'Payment pending', payment_failed: 'Payment not confirmed',
  payment_refunded: 'Refund', sub_started: 'Subscription started', sub_renewed: 'Subscription renewed', sub_reminder: 'Renewal reminder', sub_cancelled: 'Subscription cancelled',
  sub_expired: 'Subscription ended', ticket_created: 'Support', ticket_reply: 'Support', ticket_closed: 'Support', community_digest: 'Community', update_release: 'Update',
  event_announcement: 'Event', giveaway: 'Giveaway', important_announcement: 'Important', maintenance: 'Maintenance' };
const fill = (s, v, html) => String(s || '').replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] == null ? '' : html ? esc(String(v[k])) : String(v[k]));
// the banner each email gets (tools/email-art.js draws them)
const HERO = k => k === 'welcome' ? 'welcome' : k === 'security_alert' ? 'security' : k.startsWith('payment_') ? 'payment' : k.startsWith('sub_') ? 'club' : k.startsWith('ticket_') ? 'support'
  : ({ community_digest: 'community', update_release: 'update', event_announcement: 'event', giveaway: 'giveaway', important_announcement: 'notice', maintenance: 'maintenance' })[k] || 'welcome';
const RECEIPT = k => k.startsWith('payment_') ? 'Receipt' : k.startsWith('sub_') ? 'Your membership' : k.startsWith('ticket_') ? 'Your ticket' : 'Details';
const isRow = l => /^[A-Z][A-Za-z ]{1,20}: \S/.test(l);

export function renderEmail(t, vars = {}, opts = {}) {
  const v = Object.assign({}, vars), tone = TONE[t.tone] || TONE.info;
  const subject = fill(t.subject, v, false), heading = fill(t.heading, v, true), pre = fill(t.preheader, v, true);
  // the body: paragraphs; a run of "Label: value" lines becomes a details table; "• " lines a list
  const blocks = fill(t.body, v, false).replace(/\r\n/g, '\n').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const html = blocks.map(b => {
    const lines = b.split('\n');
    if (lines.every(isRow)) return receipt(lines.map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]), RECEIPT(t.key));
    if (lines.every(l => l.startsWith('• '))) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">${lines.map(l => `<tr><td valign="top" width="22" style="padding:4px 0;font:13px/1.6 Arial,Helvetica,sans-serif;color:${C.gold}">&#10022;</td><td style="padding:4px 0;font:15px/1.55 Arial,Helvetica,sans-serif;color:${C.text}">${esc(l.slice(2))}</td></tr>`).join('')}</table>`;
    return p(lines.map(esc).join('<br>'));
  }).join('');
  const label = pill(LABEL[t.key] || 'Lantern Keeper', tone[0], tone[1]);
  const btn = t.button_label && t.button_link ? divider() + button(esc(fill(t.button_link, v, false)), esc(fill(t.button_label, v, false))) : '';
  const always = 'You get this email because of your Lantern Keeper account: account, payment, subscription and support emails are always sent.';
  const optional = opts.unsubLink ? `You get this because you chose these emails in Lantern Keeper. <a href="${esc(opts.unsubLink)}" style="color:${C.dim}">Stop these emails</a> (one click), or choose in the game: Settings &gt; Account &gt; Emails.` : 'You get this because you chose these emails in Lantern Keeper. Choose in the game: Settings &gt; Account &gt; Emails.';
  const footer = (['community', 'announcement'].includes(t.grp) ? optional : always) + ' Questions? Just reply to this email.';
  const text = [heading ? fill(t.heading, v, false) : '', fill(t.body, v, false), t.button_label && t.button_link ? `${fill(t.button_label, v, false)}: ${fill(t.button_link, v, false)}` : '', '', 'Exenova · Lantern Keeper · l4nternkeeper@gmail.com'].filter(x => x !== '').join('\n\n');
  return { subject, html: layout({ preheader: pre, body: label + (heading ? h1(heading) : '') + html + btn, footer, hero: HERO(t.key), sign: true }), text };
}
