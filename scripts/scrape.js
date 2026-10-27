const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const CONFIG = require('../config.js');

async function main() {
  const targetUrl = CONFIG.electionUrl || 'https://votes26.bechirot.gov.il/';
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

    // 1. Extract Last Update timestamp
    const lastUpdateEl = doc.querySelector('.LastUpdate');
    if (!lastUpdateEl) {
      console.log('LastUpdate element not found on page.');
      process.exit(0);
    }
    const lastUpdate = lastUpdateEl.textContent.trim();
    console.log(`Site last update: "${lastUpdate}"`);

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

    // Backup previous data if timestamp changed
    if (existingData && existingData.lastUpdate) {
      const backupDir = path.join(__dirname, '../data');
      let backupName = '';
      if (existingData.lastUpdate.includes('סופיות')) {
        backupName = 'סופיות.json';
      } else {
        const cleanTs = existingData.lastUpdate
          .replace(/[\/:]/g, '.')
          .slice(-16);
        backupName = `${cleanTs}.json`;
      }
      fs.writeFileSync(
        path.join(backupDir, backupName),
        JSON.stringify(existingData, null, 2),
        'utf8'
      );
      console.log(`Created backup: ${backupName}`);
    }

    // 3. Parse Tables
    const tables = doc.querySelectorAll('table');
    if (tables.length === 0) {
      console.log('No tables found on target page.');
      process.exit(0);
    }

    let generalTableRows, partiesTableRows;
    const isWayback = targetUrl.includes('archive.org');
    const tableOffset = isWayback ? 1 : 0;

    // Detect if results are finalized based on first table headers count
    const headerCols = tables[tableOffset]?.querySelectorAll('tr:nth-child(1) th') || [];
    const isEnded = headerCols.length === 5;

    generalTableRows = tables[tableOffset]?.querySelectorAll('tr');

    if (isEnded) {
      console.log('Table layout: Finalized Results');
      partiesTableRows = tables[tableOffset + 1]?.querySelectorAll('tr');
    } else {
      console.log('Table layout: In-Progress Counting');
      partiesTableRows = tables[tableOffset + 1]?.querySelectorAll('tr');
    }

    // Extract General Summary info
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

    // Extract Parties Info
    const partiesList = [];
    if (partiesTableRows) {
      partiesTableRows.forEach((row) => {
        const th = row.querySelector('th');
        const tds = row.querySelectorAll('td');
        if (!th || tds.length === 0) return;

        const name = th.textContent.trim();
        const char = tds[0] ? tds[0].textContent.trim() : '';

        let percent = '';
        let votes = 0;

        if (isEnded) {
          percent = tds[2] ? tds[2].textContent.trim() : '';
          const voteDiv = tds[3] ? tds[3].querySelector('div') || tds[3] : null;
          votes = voteDiv ? parseInt(voteDiv.textContent.replace(/,/g, '').trim(), 10) || 0 : 0;
        } else {
          percent = tds[1] ? tds[1].textContent.trim() : '';
          const voteDiv = tds[2] ? tds[2].querySelector('div') || tds[2] : null;
          votes = voteDiv ? parseInt(voteDiv.textContent.replace(/,/g, '').trim(), 10) || 0 : 0;
        }

        if (name && char) {
          partiesList.push({ name, char, votes, percent });
        }
      });
    }

    if (partiesList.length === 0) {
      console.log('No party data extracted.');
      process.exit(0);
    }

    // 4. Construct output JSON
    const outputData = {
      url: targetUrl,
      lastUpdate: lastUpdate,
      acceptedVotes: acceptedVotes,
      parties: partiesList
    };

    // Ensure data directory exists
    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log('Successfully written data/data.json');

  } catch (err) {
    console.error('Error executing scraper:', err);
    process.exit(1);
  }
}

main();
