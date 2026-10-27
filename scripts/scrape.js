const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const CONFIG = require('../config.js');

async function main() {
  const targetUrl = CONFIG.electionUrl || 'https://votes25.bechirot.gov.il/';
  console.log(`Fetching election data from: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.error(`HTTP error! Status: ${res.status}`);
      process.exit(1);
    }

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 1. Extract Last Update timestamp, or fallback to final results status
    const lastUpdateEl = doc.querySelector('.LastUpdate');
    let lastUpdate = '';

    if (lastUpdateEl && lastUpdateEl.textContent.trim()) {
      lastUpdate = lastUpdateEl.textContent.trim();
    } else if (html.includes('תוצאות סופיות')) {
      lastUpdate = 'תוצאות סופיות';
    } else {
      lastUpdate = 'תוצאות סופיות - בחירות 25';
    }
    console.log(`Resolved lastUpdate status: "${lastUpdate}"`);

    // 2. Check if data needs to be updated
    const dataPath = path.join(__dirname, '../data/data.json');
    let existingData = null;

    if (fs.existsSync(dataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      } catch (e) {
        console.log('Error reading existing data.json, re-creating.');
      }
    }

    if (existingData && existingData.lastUpdate === lastUpdate) {
      console.log('Timestamp has not changed. Skipping update.');
      process.exit(0);
    }

    // Backup existing data if timestamp changed
    if (existingData && existingData.lastUpdate) {
      const backupDir = path.join(__dirname, '../data');
      let backupName = existingData.lastUpdate.includes('סופיות')
        ? 'סופיות.json'
        : `${existingData.lastUpdate.replace(/[\/:]/g, '.').slice(-16)}.json`;
        
      fs.writeFileSync(
        path.join(backupDir, backupName),
        JSON.stringify(existingData, null, 2),
        'utf8'
      );
      console.log(`Created backup file: ${backupName}`);
    }

    // 3. Extract Table Rows
    const tables = doc.querySelectorAll('table');
    if (tables.length === 0) {
      console.log('No tables found on target page.');
      process.exit(1);
    }

    const isWayback = targetUrl.includes('archive.org');
    const tableOffset = isWayback ? 1 : 0;

    const generalTableRows = tables[tableOffset]?.querySelectorAll('tr');
    const partiesTableRows = tables[tableOffset + 1]?.querySelectorAll('tr');

    // Extract total valid votes (קולות כשרים)
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

        // Parsing layout for finalized election results
        let percent = tds[2] ? tds[2].textContent.trim() : (tds[1] ? tds[1].textContent.trim() : '');
        let voteDiv = tds[3] ? tds[3].querySelector('div') || tds[3] : (tds[2] ? tds[2].querySelector('div') || tds[2] : null);
        let votes = voteDiv ? parseInt(voteDiv.textContent.replace(/,/g, '').trim(), 10) || 0 : 0;

        if (name && char) {
          partiesList.push({ name, char, votes, percent });
        }
      });
    }

    // 4. Construct output JSON and write file
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
    console.log(`Successfully generated data.json with election results.`);

  } catch (err) {
    console.error('Error executing scraper:', err);
    process.exit(1);
  }
}

main();
