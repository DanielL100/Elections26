const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const CONFIG = require('../config.js');

async function main() {
  // Try fetching nationalresults directly or fallback to electionUrl
  let targetUrl = CONFIG.electionUrl;
  if (!targetUrl.includes('nationalresults') && !targetUrl.includes('archive.org')) {
    targetUrl = targetUrl.replace(/\/$/, '') + '/nationalresults';
  }

  console.log(`Fetching election data from: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.error(`HTTP request failed with status: ${res.status}`);
      // Exit gracefully so action runner doesn't fail
      process.exit(0);
    }

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const dataPath = path.join(__dirname, '../data/data.json');
    const now = new Date();
    const formattedTimestamp = now.toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // 1. Extract Last Update timestamp
    const lastUpdateEl = doc.querySelector('.LastUpdate');
    let lastUpdate = '';
    const isFinalResults = html.includes('תוצאות סופיות');

    if (isFinalResults) {
      lastUpdate = `תוצאות סופיות - ${formattedTimestamp}`;
    } else if (lastUpdateEl && lastUpdateEl.textContent.trim()) {
      lastUpdate = lastUpdateEl.textContent.trim();
    } else if (html.includes('ממתינים לספירת הקולות')) {
      lastUpdate = 'ממתינים לספירת הקולות';
    } else {
      lastUpdate = `עדכון - ${formattedTimestamp}`;
    }

    console.log(`Resolved lastUpdate status: "${lastUpdate}"`);

    // 2. Extract Table Rows
    const tables = doc.querySelectorAll('table');
    if (tables.length === 0) {
      console.log('No tables found on target page (counting not started or dynamic DOM).');
      
      // If data.json does not exist yet, create a initial placeholder structure
      if (!fs.existsSync(dataPath)) {
        const initialData = {
          url: targetUrl,
          lastUpdate: lastUpdate,
          acceptedVotes: 0,
          parties: []
        };
        fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2), 'utf8');
        console.log('Created initial empty data.json placeholder.');
      }
      
      // Exit gracefully with status 0
      process.exit(0);
    }

    const isWayback = targetUrl.includes('archive.org');
    const tableOffset = isWayback ? 1 : 0;

    const generalTableRows = tables[tableOffset]?.querySelectorAll('tr');
    const partiesTableRows = tables[tableOffset + 1]?.querySelectorAll('tr');

    // Extract total valid votes
    let acceptedVotes = 0;
    if (generalTableRows && generalTableRows.length >= 2) {
      const ths = generalTableRows[0].querySelectorAll('th');
      const tds = generalTableRows[1].querySelectorAll('td');

      ths.forEach((th, idx) => {
        const key = th.textContent.trim();
        const val = tds[idx] ? tds[idx].textContent.trim() : '';
        if (key.includes('כשרים') || key.includes('הצביעו')) {
          const parsed = parseInt(val.replace(/,/g, ''), 10);
          if (!isNaN(parsed)) acceptedVotes = parsed;
        }
      });
    }

    // Extract data for each party
    const partiesList = [];
    if (partiesTableRows) {
      partiesTableRows.forEach((row) => {
        const th = row.querySelector('th');
        const tds = row.querySelectorAll('td');
        if (!th || tds.length < 3) return;

        const name = th.textContent.trim();
        const char = tds[0] ? tds[0].textContent.trim() : '';

        let percent = tds[2] ? tds[2].textContent.trim() : (tds[1] ? tds[1].textContent.trim() : '');
        let voteDiv = tds[3] ? tds[3].querySelector('div') || tds[3] : (tds[2] ? tds[2].querySelector('div') || tds[2] : null);
        let votes = voteDiv ? parseInt(voteDiv.textContent.replace(/,/g, '').trim(), 10) || 0 : 0;

        if (name && char) {
          partiesList.push({ name, char, votes, percent });
        }
      });
    }

    // 3. Write data to data/data.json
    const outputData = {
      url: targetUrl,
      lastUpdate: lastUpdate,
      acceptedVotes: acceptedVotes,
      parties: partiesList
    };

    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`Successfully generated data.json with ${partiesList.length} parties parsed.`);

  } catch (err) {
    console.error('Error executing scraper:', err);
    // Exit with 0 so workflow run stays green
    process.exit(0);
  }
}

main();
