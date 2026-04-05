// Send next 7 days of Hivemind prompts for review via email
// Usage: RESEND_API_KEY=re_xxx node send-preview.js
//
// Requires: npm install resend

import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = 'kmurali.me@outlook.com';

if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY environment variable');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// Get next 7 days in Pacific Time
function getPTDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Load prompts
const prompts = JSON.parse(readFileSync(join(__dirname, 'prompts.json'), 'utf8'));

// Find Monday through Sunday of the upcoming week
const pt = getPTDate();
const todayStr = pt.getFullYear() + '-' + String(pt.getMonth() + 1).padStart(2, '0') + '-' + String(pt.getDate()).padStart(2, '0');

// If today is Sunday, the week ahead starts tomorrow (Monday)
const upcoming = [];
for (let i = 1; i <= 7; i++) {
  const dateStr = addDays(todayStr, i);
  const prompt = prompts.find(p => p.gameId === dateStr);
  if (prompt) upcoming.push(prompt);
}

if (upcoming.length === 0) {
  console.error('No prompts found for the next 7 days. Run generate-prompts.js first.');
  process.exit(1);
}

// Build HTML email
function buildEmail(prompts) {
  const rows = prompts.map(p => {
    const categories = p.rows.map(r => `
      <tr>
        <td style="padding: 4px 8px; font-weight: 600; font-size: 13px; white-space: nowrap;">${r.icon} ${r.label}</td>
        ${r.items.map((item, i) => `<td style="padding: 4px 6px; font-size: 12px; text-align: center; background: ${i === 0 ? '#f0f0f0' : '#fff'}; border: 1px solid #eee; border-radius: 4px;">${item}<br><span style="color: #999; font-size: 10px;">$${5 - i}</span></td>`).join('')}
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 28px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background: #faf5e8; padding: 14px 16px; border-bottom: 1px solid rgba(212,168,67,0.2);">
          <div style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.08em;">${formatDate(p.gameId)} &middot; Game #${p.number}</div>
          <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${p.prompt}</div>
        </div>
        <div style="padding: 12px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 3px;">
            ${categories}
          </table>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #1a1a1a;">Hivemind</div>
        <div style="font-size: 22px; font-weight: 700; margin-top: 4px;">Upcoming Week Preview</div>
        <div style="font-size: 13px; color: #999; margin-top: 4px;">${upcoming.length} days &middot; ${formatDate(upcoming[0].gameId)} to ${formatDate(upcoming[upcoming.length - 1].gameId)}</div>
      </div>
      ${rows}
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
        Open Claude Code to request any changes.
      </div>
    </div>
  `;
}

const html = buildEmail(upcoming);

console.log(`Sending preview of ${upcoming.length} prompts to ${TO_EMAIL}...`);

const { data, error } = await resend.emails.send({
  from: 'Hivemind <onboarding@resend.dev>',
  to: TO_EMAIL,
  subject: `Hivemind Preview: ${formatDate(upcoming[0].gameId)} - ${formatDate(upcoming[upcoming.length - 1].gameId)}`,
  html
});

if (error) {
  console.error('Failed to send:', error);
  process.exit(1);
}

console.log('Email sent successfully! ID:', data.id);
