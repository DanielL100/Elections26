/* Shared by index.html, stats.html and embed.html. Nothing election-specific lives here - see config.js */

const $id = (id) => document.getElementById(id);
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cfgByChar = Object.fromEntries(CONFIG.parties.map((p, i) => [p.char, { ...p, order: i }]));
const cfgByKey = Object.fromEntries(CONFIG.parties.map((p) => [p.key, cfgByChar[p.char]]));

/* ---------- data ---------- */

async function loadData() {
  const res = await fetch(CONFIG.dataUrl + (CONFIG.dataUrl.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json: HTTP ' + res.status);
  return res.json();
}

/* ---------- seat calculation ---------- */

function calculate(data) {
  const total = CONFIG.totalSeats;
  const accepted = Number(data.acceptedVotes) || 0;
  const threshold = (accepted * CONFIG.thresholdPercent) / 100;
  const votesPerSeat = accepted / total;

  const all = (data.parties || []).map((p) => ({
    name: p.name, char: p.char, percent: p.percent, votes: Number(p.votes) || 0,
    cfg: cfgByChar[p.char] || null, base: 0, seats: 0, arrows: [],
  }));
  const passed = all.filter((p) => p.votes > threshold);
  const failed = all.filter((p) => !(p.votes > threshold));
  const label = (p) => (p.cfg ? p.cfg.name : p.name);

  let leftover = total;
  if (passed.length) {
    const quota = passed.reduce((s, p) => s + p.votes, 0) / total;
    passed.forEach((p) => { p.base = Math.floor(p.votes / quota); p.seats = p.base; leftover -= p.base; });
  }
  const initialLeftover = leftover;

  const partnerOf = (p) => {
    for (const [a, b] of CONFIG.agreements) {
      if (a !== p.char && b !== p.char) continue;
      const other = passed.find((q) => q.char === (a === p.char ? b : a));
      if (other) return other;
    }
    return null;
  };

  for (let n = 0; n < initialLeftover; n++) {
    const used = new Set();
    let best = null, bestVal = 0;
    for (const p of passed) {
      if (used.has(p)) continue;
      const q = partnerOf(p);
      used.add(p); if (q) used.add(q);
      const val = (p.votes + (q ? q.votes : 0)) / (p.seats + (q ? q.seats : 0) + 1);
      if (val > bestVal) { bestVal = val; best = { a: p, b: q }; }
    }
    if (!best) break;
    if (best.b) {
      const va = best.a.votes / (best.a.seats + 1);
      const vb = best.b.votes / (best.b.seats + 1);
      const [win, other] = va > vb ? [best.a, best.b] : [best.b, best.a];
      win.seats++; win.arrows.push(label(other));
    } else {
      best.a.seats++; best.a.arrows.push('חוק בדר-עופר');
    }
  }

  passed.sort((x, y) => y.seats - x.seats); // stable: ties keep the site's vote order
  const trashVotes = failed.reduce((s, p) => s + p.votes, 0);
  return { accepted, threshold, votesPerSeat, trashVotes, leftover: initialLeftover, passed, failed, parties: [...passed, ...failed] };
}

const blocOf = (p) => (p.cfg ? p.cfg.bloc : CONFIG.defaultBloc);

/* ---------- "last update" wording ---------- */

function updateTexts(lastUpdate) {
  lastUpdate = lastUpdate || '';
  if (lastUpdate.includes('דמה')) return { kind: 'sim', text: 'תוצאות דמה' };
  if (lastUpdate.includes('סופיות')) return { kind: 'final', text: 'תוצאות סופיות' };
  if (lastUpdate.includes('טרם')) return { kind: 'none', text: 'טרם נספרו קולות' };
  return {
    kind: 'live',
    text: 'עודכן לאחרונה בתאריך ' + lastUpdate.substr(lastUpdate.length - 16, 10) + ' בשעה ' + lastUpdate.substr(lastUpdate.length - 5, 5),
  };
}

/* ---------- order in the URL hash (#ZSGJ...P...) ---------- */

function parseHash() {
  const keys = []; let pointer = -1;
  for (const ch of decodeURIComponent(location.hash.replace(/^#/, ''))) {
    if (ch === 'P') pointer = keys.length;
    else if (cfgByKey[ch] && !keys.includes(ch)) keys.push(ch);
  }
  CONFIG.parties.forEach((p) => { if (!keys.includes(p.key)) keys.push(p.key); });
  return { keys, pointer };
}

/* Parties that have seats, in bar order. Unconfigured parties that passed go last, in gray. */
function barItems(res) {
  const { keys } = parseHash();
  const items = [];
  keys.forEach((k) => { const p = res.passed.find((x) => x.char === cfgByKey[k].char); if (p) items.push(p); });
  res.passed.forEach((p) => { if (!items.includes(p)) items.push(p); });
  return items;
}

/* ---------- bar + slider ---------- */

let validValues = [];
const slider = () => $id('rangeslider');

function rebuildTicks() {
  validValues = []; let cur = 0; let html = '';
  document.querySelectorAll('.parties-mandats-inside').forEach((el) => {
    html += "<option value='" + cur + "'></option>"; validValues.push(cur); cur += parseInt(el.textContent, 10);
  });
  html += "<option value='" + total() + "'></option>"; validValues.push(total());
  $id('tickmarks').innerHTML = html;
}
const total = () => CONFIG.totalSeats;

function renderBar(res, opts = {}) {
  const items = barItems(res);
  if (!items.length) {
    $id('prog_bar').innerHTML = "<h4 class='mx-auto'>טרם נספרו קולות</h4>";
    ['rangeslider', 'righty', 'lefty'].forEach((id) => { $id(id).style.display = 'none'; });
    return false;
  }
  let html = '';
  items.forEach((p, i) => {
    const name = p.cfg ? p.cfg.name : p.name;
    const color = p.cfg ? p.cfg.color : '#BDBDBD';
    const w = p.seats / total() * 100;
    const words = name.split(' ');
    html += `<div id='mandat${i}' class='parties-mandats mandat${i}' data-key='${p.cfg ? p.cfg.key : ''}' style='width: ${w}%;'>`;
    html += `<div class='progress-bar parties-mandats-inside' role='progressbar' style='width: 100%; background-color: ${color};' aria-valuenow='${w}' aria-valuemin='0' aria-valuemax='100' ${opts.link && p.cfg ? `data-jump='${p.cfg.key}'` : ''}>${p.seats}</div>`;
    if (words.length > 1 && name !== 'יש עתיד') {
      html += `<div class='parties-names d-lg-none'>${esc(words[0])}\n       ${esc(words.slice(1).join(' '))}</div>`;
      html += `<div class='parties-names d-none d-lg-block'>${esc(name)}</div>`;
    } else html += `<div class='parties-names'>${esc(name)}</div>`;
    html += '</div>';
  });
  $id('prog_bar').innerHTML = html;

  if (opts.link) {
    document.querySelectorAll('[data-jump]').forEach((el) => el.addEventListener('click', () => {
      const row = $id('row-' + el.dataset.jump); if (row) row.scrollIntoView({ behavior: 'smooth' });
    }));
  }

  rebuildTicks();
  setPointerInitial(items);
  slider().oninput = slider().onchange = setInput;
  window.addEventListener('resize', setInput);
  setInput();
  return true;
}

function setPointerInitial(items) {
  const { pointer } = parseHash();
  let sum = 0;
  if (pointer >= 0) {
    items.slice(0, pointer).forEach((p) => { sum += p.seats; });
  } else {
    const stop = cfgByChar[CONFIG.defaultPointerAfter];
    const at = items.findIndex((p) => p.char === CONFIG.defaultPointerAfter);
    if (at >= 0) items.slice(0, at + 1).forEach((p) => { sum += p.seats; });
    else if (stop) items.forEach((p) => { if (p.cfg && p.cfg.order < stop.order) sum += p.seats; });
  }
  slider().value = sum;
}

function setInput() {
  const el = slider();
  el.value = closestValue(el.value);
  const w = $id('prog_bar').offsetWidth, v = Number(el.value), t = total();
  $id('lefty').style.right = (v * w / t + 10) + 'px';
  $id('lefty').innerHTML = t - v;
  $id('righty').style.left = ((t - v) * w / t + 10) + 'px';
  $id('righty').innerHTML = v;
}

function closestValue(input) {
  return validValues.reduce((best, v) => (Math.abs(v - input) < Math.abs(best - input) ? v : best), validValues[0]);
}

/* Current bar order as a share-string, e.g. "ZSGPJ..." */
function currentOrderString() {
  let out = '', sum = 0; const val = Number(slider().value);
  if (val === 0) out += 'P';
  document.querySelectorAll('#prog_bar .parties-mandats').forEach((el) => {
    sum += parseInt(el.querySelector('.parties-mandats-inside').textContent, 10);
    out += el.dataset.key || '';
    if (sum === val && val !== 0) out += 'P';
  });
  return out;
}
