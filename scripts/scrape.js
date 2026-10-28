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

const BROWSER_HEADERS = {
  ...HEADERS,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function saveDebug(url, status, headers, html) {
  fs.mkdirSync(path.dirname(debugPath), { recursive: true });
  fs.writeFileSync(debugPath, html || '', 'utf8');
  fs.writeFileSync(
    debugPath.replace(/\.html$/, '-meta.json'),
    JSON.stringify({ url, status, bodyLength: (html || '').length, headers }, null, 2),
    'utf8'
  );
}

// Real browser fallback: USE_BROWSER=1 (needs: npm i playwright && npx playwright install chromium)
async function fetchWithBrowser(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: 'he-IL' });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('#tableDiv table', { timeout: 20000 }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function loadHtml() {
  // Local file for testing: node scripts/scrape.js path/to/page.html
  if (process.argv[2]) return { url: 'file:' + process.argv[2], html: fs.readFileSync(process.argv[2], 'utf8') };

  for (const url of candidateUrls()) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Fetching ${url} (attempt ${attempt})`);
        let html, status = 'browser', headers = {};
        if (process.env.USE_BROWSER === '1') {
          html = await fetchWithBrowser(url);
        } else {
          const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
          status = res.status;
          headers = Object.fromEntries(res.headers.entries());
          html = await res.text();
        }
        console.log(`  status=${status} bodyLength=${html.length} server=${headers.server || '-'} content-type=${headers['content-type'] || '-'}`);
        console.log(`  start: ${clean(html).slice(0, 200) || '(EMPTY BODY)'}`);
        if (html.includes('id="tableDiv"')) return { url, html };
        saveDebug(url, status, headers, html);
        if (html.length > 0) break; // real page without table: counting not started, retrying will not help
        await sleep(2000 * attempt);  // empty body: retry
      } catch (e) {
        console.warn(`  failed: ${e.message}`);
        await sleep(2000 * attempt);
      }
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
