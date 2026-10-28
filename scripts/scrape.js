const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const CONFIG = require('../config.js');

const dataPath = path.join(__dirname, '../data/data.json');
const debugPath = path.join(__dirname, '../data/debug.html');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'he-IL,he;q=0.9'
};

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const toInt = (s) => {
  const n = parseInt(String(s ?? '').replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

function candidateUrls() {
  const base = (CONFIG.electionUrl || 'https://votes26.bechirot.gov.il').replace(/\/$/, '');
  const root = base.replace(/\/nationalresults.*$/, '');
  return [...new Set([root + '/', root + '/nationalresults?lang=he'])];
}

function parse(html) {
  const doc = new JSDOM(html).window.document;

  // 1. Timestamp: <div class="fs-h3-title">תוצאות נכון ל- 28/10/2026 05:13</div>
  let lastUpdate = '';
  for (const el of doc.querySelectorAll('.fs-h3-title')) {
    const t = clean(el.textContent);
    if (/נכון ל/.test(t)) { lastUpdate = t; break; }
  }
  if (!lastUpdate && html.includes('ממתינים לספירת הקולות')) lastUpdate = 'ממתינים לספירת הקולות';

  // 2. Summary boxes: .info-box > div > [label div][.fw-bold value div]
  const summary = {};
  for (const box of doc.querySelectorAll('#ContentPlaceHolder1_ShowTotal1_TotalTags .info-box')) {
    const valueEl = box.querySelector('.fw-bold');
    const labelEl = valueEl && valueEl.previousElementSibling;
    if (!valueEl || !labelEl) continue;
    const label = clean(labelEl.textContent);
    const raw = clean(valueEl.textContent);
    if (/בעלי זכות/.test(label)) summary.eligibleVoters = toInt(raw);
    else if (/^קולות כשרים/.test(label)) summary.acceptedVotes = toInt(raw);
    else if (/^קולות פסולים/.test(label)) summary.invalidVotes = toInt(raw);
    else if (/^קלפיות/.test(label)) summary.ballotsCounted = toInt(raw);
    else if (/שיעור הצבעה/.test(label)) summary.turnout = raw;
    else if (/^קולות|מספר מצביעים/.test(label)) summary.totalVotes = toInt(raw);
  }

  // 3. Parties: header-driven so an extra column (e.g. מנדטים) won't shift anything
  const parties = [];
  const table = doc.querySelector('#tableDiv table');
  if (table) {
    const heads = [...table.querySelectorAll('thead th')].map((th) => clean(th.textContent));
    const idx = (s) => heads.findIndex((h) => h.includes(s));
    const col = {
      name: idx('שם הרשימה'),
      char: idx('אותיות'),
      seats: idx('מנדטים'),
      percent: idx('אחוז'),
      votes: idx('קולות כשרים')
    };
    for (const row of table.querySelectorAll('tbody tr')) {
      const tds = row.querySelectorAll('td');
      if (tds.length < heads.length || col.name < 0) continue;
      const nameCell = tds[col.name];
      const name = clean(nameCell.getAttribute('title') || nameCell.textContent);
      const char = clean(tds[col.char].textContent);
      const votesCell = tds[col.votes];
      const votes = toInt((votesCell.querySelector('span.flex-fill') || votesCell).textContent);
      const percent = clean(tds[col.percent].textContent);
      if (!name || !char) continue;
      const p = { name, char, votes, percent };
      if (col.seats >= 0) p.seats = toInt(tds[col.seats].textContent);
      parties.push(p);
    }
  }
  return { lastUpdate, summary, parties };
}

async function loadHtml() {
  // Local file for testing: node scripts/scrape.js path/to/page.html
  if (process.argv[2]) return { url: 'file:' + process.argv[2], html: fs.readFileSync(process.argv[2], 'utf8') };
  for (const url of candidateUrls()) {
    try {
      console.log(`Fetching ${url}`);
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) { console.warn(`  HTTP ${res.status}`); continue; }
      const html = await res.text();
      if (html.includes('id="tableDiv"')) return { url, html };
      console.warn('  page loaded but no results table (counting not started?)');
      fs.mkdirSync(path.dirname(debugPath), { recursive: true });
      fs.writeFileSync(debugPath, html, 'utf8');
    } catch (e) {
      console.warn(`  failed: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const src = await loadHtml();
  if (!src) {
    console.log('No usable page; keeping existing data.json.');
    if (!fs.existsSync(dataPath)) {
      fs.writeFileSync(dataPath, JSON.stringify({ url: candidateUrls()[0], lastUpdate: 'ממתינים לספירת הקולות', acceptedVotes: 0, parties: [] }, null, 2), 'utf8');
    }
    process.exit(0);
  }

  const { lastUpdate, summary, parties } = parse(src.html);
  if (parties.length === 0) {
    console.warn('Table found but 0 parties parsed; keeping existing data.json.');
    fs.writeFileSync(debugPath, src.html, 'utf8');
    process.exit(0);
  }

  const partySum = parties.reduce((a, p) => a + p.votes, 0);
  const acceptedVotes = summary.acceptedVotes || partySum;
  if (summary.acceptedVotes && Math.abs(partySum - summary.acceptedVotes) / summary.acceptedVotes > 0.005) {
    console.warn(`Sanity check: party votes sum ${partySum} vs accepted ${summary.acceptedVotes}`);
  }

  const out = {
    url: src.url,
    lastUpdate: lastUpdate || `עדכון - ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
    acceptedVotes,
    ...summary,
    parties
  };
  out.acceptedVotes = acceptedVotes;
  fs.writeFileSync(dataPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote data.json: ${parties.length} parties, lastUpdate="${out.lastUpdate}", accepted=${acceptedVotes}`);
}

main();
