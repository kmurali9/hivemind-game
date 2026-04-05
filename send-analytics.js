// Send daily Hivemind analytics email for yesterday's game
// Usage: RESEND_API_KEY=re_xxx node send-analytics.js
//
// Requires: npm install resend

import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = 'kmurali.me@outlook.com';
const FIREBASE_API_KEY = 'AIzaSyBn-n5b1tSHYUGZpzPkgex76rGWJ9NApLY';
const PROJECT_ID = 'hivemind-game-ab3f1';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY environment variable');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// ─── Date helpers (Pacific Time) ───
function getPTDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function getDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// ─── Firebase REST helpers ───
async function getAuthToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Auth failed: ${data.error.message}`);
  return data.idToken;
}

function parseFSValue(val) {
  if (val.integerValue !== undefined) return parseInt(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.arrayValue) return (val.arrayValue.values || []).map(parseFSValue);
  if (val.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = parseFSValue(v);
    return obj;
  }
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue) return val.timestampValue;
  return null;
}

function parseFSDoc(doc) {
  if (!doc.fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = parseFSValue(v);
  return obj;
}

async function readDoc(token, path) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) return null;
  return parseFSDoc(data);
}

async function readCollection(token, path) {
  const docs = [];
  let pageToken = null;
  do {
    const url = new URL(`${FS_BASE}/${path}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.documents) {
      for (const doc of data.documents) {
        const name = doc.name.split('/').pop();
        docs.push({ id: name, ...parseFSDoc(doc) });
      }
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

// ─── Score computation (mirrors index.html logic) ───
const COSTS = [5, 4, 3, 2, 1];

function computeScores(prompt, picks) {
  const total = picks.length;
  if (total === 0) return { scores: [], avg: 0, distribution: {}, rowStats: [] };

  // Count picks per cell
  const counts = prompt.rows.map(() => Array(5).fill(0));
  picks.forEach(p => {
    if (!p.selections) return;
    p.selections.forEach((ci, ri) => { if (ci != null) counts[ri][ci]++; });
  });

  // Rank items per row (tied items share lowest rank in group)
  const rowRanks = counts.map(rowCounts => {
    const indexed = rowCounts.map((c, i) => ({ idx: i, count: c }));
    indexed.sort((a, b) => b.count - a.count);
    const ranks = Array(5).fill(0);
    let pos = 0;
    while (pos < indexed.length) {
      let end = pos + 1;
      while (end < indexed.length && indexed[end].count === indexed[pos].count) end++;
      const tiedScore = 5 - (end - 1);
      for (let t = pos; t < end; t++) {
        ranks[indexed[t].idx] = indexed[t].count > 0 ? tiedScore : 0;
      }
      pos = end;
    }
    return ranks;
  });

  // Top pick per row
  const topIdx = counts.map(rc => {
    let maxI = 0;
    rc.forEach((c, i) => { if (c > rc[maxI]) maxI = i; });
    return maxI;
  });

  // Calculate each player's score
  const scores = picks.map(p => {
    if (!p.selections) return 0;
    let score = 0;
    p.selections.forEach((ci, ri) => { if (ci != null) score += rowRanks[ri][ci]; });
    if (p.lockedRow != null) {
      score += p.selections[p.lockedRow] === topIdx[p.lockedRow] ? 3 : -3;
    }
    return score;
  });

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const distribution = { '25+': 0, '20-24': 0, '15-19': 0, '10-14': 0, '<10': 0 };
  scores.forEach(s => {
    if (s >= 25) distribution['25+']++;
    else if (s >= 20) distribution['20-24']++;
    else if (s >= 15) distribution['15-19']++;
    else if (s >= 10) distribution['10-14']++;
    else distribution['<10']++;
  });

  // Per-row stats (keep in $5→$1 order, not sorted by popularity)
  const rowStats = prompt.rows.map((row, ri) => {
    const maxCount = Math.max(...counts[ri]);
    const items = row.items.map((name, ci) => ({
      name,
      cost: 5 - ci,
      count: counts[ri][ci],
      pct: total > 0 ? Math.round((counts[ri][ci] / total) * 100) : 0,
      isTop: counts[ri][ci] === maxCount && counts[ri][ci] > 0
    }));
    return { label: row.label, icon: row.icon, items };
  });

  return { scores, avg, distribution, rowStats };
}

// ─── Email builder ───
function buildEmail(dateStr, prompt, events, prevEvents, picks, scoreData) {
  const total = picks.length;
  const pv = events.page_views || 0;
  const gs = events.game_starts || 0;
  const sub = events.submissions || 0;
  const rv = events.results_views || 0;
  const sh = events.shares || 0;
  const uv = events.unique_visitors || 0;

  const prevTotal = prevEvents ? (prevEvents.submissions || 0) : null;
  const trend = prevTotal != null && prevTotal > 0
    ? ((total - prevTotal) / prevTotal * 100).toFixed(0)
    : null;
  const trendStr = trend != null
    ? (trend >= 0 ? `<span style="color:#3a8a5c;">+${trend}%</span>` : `<span style="color:#c0392b;">${trend}%</span>`)
    : '<span style="color:#999;">no prior data</span>';

  const funnelRate = (num, den) => den > 0 ? Math.round((num / den) * 100) + '%' : '—';

  const funnelRows = [
    { label: 'Page Views', val: pv, rate: '' },
    { label: 'Game Starts', val: gs, rate: funnelRate(gs, pv) },
    { label: 'Submissions', val: sub, rate: funnelRate(sub, gs) },
    { label: 'Results Views', val: rv, rate: funnelRate(rv, sub) },
    { label: 'Shares', val: sh, rate: funnelRate(sh, sub) },
  ];

  const funnelHtml = funnelRows.map((r, i) => `
    <tr>
      <td style="padding:6px 12px; font-size:14px; font-weight:500;">${r.label}</td>
      <td style="padding:6px 12px; font-size:18px; font-weight:700; text-align:right;">${r.val}</td>
      <td style="padding:6px 12px; font-size:13px; color:#999; text-align:right;">${i > 0 ? r.rate : ''}</td>
    </tr>
  `).join('');

  const distHtml = Object.entries(scoreData.distribution).map(([range, count]) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `<tr>
      <td style="padding:4px 12px; font-size:13px;">${range}</td>
      <td style="padding:4px 12px; font-size:13px; font-weight:600; text-align:right;">${count}</td>
      <td style="padding:4px 12px; font-size:13px; color:#999; text-align:right;">${pct}%</td>
    </tr>`;
  }).join('');

  // Build pick popularity table (same format as analytics-view.html)
  const thStyle = 'padding:8px 10px; font-size:11px; font-weight:600; text-align:left; background:#1a1a1a; color:#fff;';
  const thPickStyle = 'padding:8px 6px; font-size:11px; font-weight:600; text-align:center; background:#1a1a1a; color:#fff; border-left:2px solid #333;';
  const tableHeader = `<tr>
    <th style="${thStyle}">Row</th>
    <th style="${thStyle}">$5 Item</th><th style="${thPickStyle}">Picks</th>
    <th style="${thStyle}">$4 Item</th><th style="${thPickStyle}">Picks</th>
    <th style="${thStyle}">$3 Item</th><th style="${thPickStyle}">Picks</th>
    <th style="${thStyle}">$2 Item</th><th style="${thPickStyle}">Picks</th>
    <th style="${thStyle}">$1 Item</th><th style="${thPickStyle}">Picks</th>
  </tr>`;

  const rowStatsHtml = scoreData.rowStats.map(row => {
    const cells = row.items.map(item => {
      const bg = item.count === 0 ? '#f9f9f9' : item.isTop ? '#e8f5ee' : '#fff';
      const badge = item.isTop ? ' <span style="background:#3a8a5c;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;">TOP</span>' : '';
      const tdItem = `<td style="padding:6px 10px; font-size:12px; font-weight:500; background:${bg}; border-bottom:1px solid #eee;"><span style="color:#999;font-size:10px;">$${item.cost}</span> ${item.name}${badge}</td>`;
      const countColor = item.count === 0 ? '#ccc' : item.isTop ? '#3a8a5c' : '#1a1a1a';
      const tdPicks = `<td style="padding:6px 8px; font-size:13px; font-weight:700; text-align:center; background:${bg}; border-bottom:1px solid #eee; border-left:2px solid #e0e0e0; border-right:2px solid #e0e0e0;"><span style="color:${countColor};">${item.count}</span> <span style="color:#999;font-size:10px;">(${item.pct}%)</span></td>`;
      return tdItem + tdPicks;
    }).join('');
    return `<tr><td style="padding:6px 10px; font-size:12px; font-weight:700; white-space:nowrap; border-bottom:1px solid #eee;">${row.icon} ${row.label}</td>${cells}</tr>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; max-width:560px; margin:0 auto; padding:20px;">
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:12px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase;">Hivemind</div>
        <div style="font-size:20px; font-weight:700; margin-top:4px;">Daily Analytics</div>
        <div style="font-size:13px; color:#999; margin-top:4px;">${formatDate(dateStr)} &middot; Game #${prompt.number}</div>
      </div>

      <div style="background:#faf5e8; padding:14px 16px; border-radius:10px; border:1px solid rgba(212,168,67,0.2); margin-bottom:20px; text-align:center;">
        <div style="font-size:11px; color:#999; text-transform:uppercase; letter-spacing:0.05em;">Yesterday's Prompt</div>
        <div style="font-size:16px; font-weight:700; margin-top:4px;">${prompt.prompt}</div>
      </div>

      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <div style="flex:1; background:#f8f8f8; border-radius:8px; padding:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800;">${total}</div>
          <div style="font-size:11px; color:#999; margin-top:2px;">Players</div>
        </div>
        <div style="flex:1; background:#f8f8f8; border-radius:8px; padding:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800;">${uv}</div>
          <div style="font-size:11px; color:#999; margin-top:2px;">Unique Visitors</div>
        </div>
        <div style="flex:1; background:#f8f8f8; border-radius:8px; padding:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800;">${trendStr}</div>
          <div style="font-size:11px; color:#999; margin-top:2px;">vs Prior Day</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px;">Funnel</div>
        <table style="width:100%; border-collapse:collapse;">
          ${funnelHtml}
        </table>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px;">Pick Popularity</div>
        ${total > 0 ? `<table style="width:100%; border-collapse:collapse;">${tableHeader}${rowStatsHtml}</table>` : '<div style="font-size:13px; color:#999; text-align:center; padding:12px;">No picks yet</div>'}
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px;">Score Distribution</div>
        ${total > 0 ? `
          <div style="text-align:center; margin-bottom:10px;">
            <span style="font-size:28px; font-weight:800;">${scoreData.avg.toFixed(1)}</span>
            <span style="font-size:13px; color:#999;"> avg score</span>
          </div>
          <table style="width:100%; border-collapse:collapse;">${distHtml}</table>
        ` : '<div style="font-size:13px; color:#999; text-align:center; padding:12px;">No scores yet</div>'}
      </div>

      <div style="text-align:center; margin-top:20px; font-size:12px; color:#999;">
        Analytics tracked since this feature was added. Prior days have pick data only.
      </div>
    </div>
  `;
}

// ─── Main ───
async function main() {
  const pt = getPTDate();
  const todayStr = pt.getFullYear() + '-' + String(pt.getMonth() + 1).padStart(2, '0') + '-' + String(pt.getDate()).padStart(2, '0');
  const yesterdayStr = addDays(todayStr, -1);
  const dayBeforeStr = addDays(todayStr, -2);

  // Load prompt
  const prompts = JSON.parse(readFileSync(join(__dirname, 'prompts.json'), 'utf8'));
  const prompt = prompts.find(p => p.gameId === yesterdayStr);
  if (!prompt) {
    console.log(`No prompt found for ${yesterdayStr}. Skipping.`);
    process.exit(0);
  }

  console.log(`Fetching analytics for ${yesterdayStr} (${prompt.prompt})...`);

  // Auth
  const token = await getAuthToken();

  // Read data
  const [events, prevEvents, picks] = await Promise.all([
    readDoc(token, `daily_events/${yesterdayStr}`),
    readDoc(token, `daily_events/${dayBeforeStr}`),
    readCollection(token, `games/${yesterdayStr}/picks`)
  ]);

  const eventData = events || {};
  const scoreData = computeScores(prompt, picks);

  console.log(`  ${picks.length} players, ${eventData.page_views || 0} page views`);

  // Build and send email
  const html = buildEmail(yesterdayStr, prompt, eventData, prevEvents, picks, scoreData);

  const { data, error } = await resend.emails.send({
    from: 'Hivemind <onboarding@resend.dev>',
    to: TO_EMAIL,
    subject: `Hivemind Analytics: ${formatDate(yesterdayStr)} — ${picks.length} players`,
    html
  });

  if (error) {
    console.error('Failed to send:', error);
    process.exit(1);
  }

  console.log('Analytics email sent! ID:', data.id);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
