const INFO_ICON = (title) => `<a href='' onclick='return false;' data-bs-toggle='tooltip' data-placement='bottom' title='${title}' data-toggle='tooltip'><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' class='bi bi-info-circle' viewBox='0 0 16 16'><path d='M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z'/><path d='m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'/></svg></a>`;
const CARET_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-up-fill text-success" viewBox="0 0 16 16"><path d="m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z"/></svg>`;

let result = null;

async function init() {
  let data;
  try { data = await loadData(); }
  catch (e) {
    $id('prog_bar').innerHTML = "<h4 class='mx-auto'>טרם נספרו קולות</h4>";
    ['rangeslider', 'righty', 'lefty'].forEach((id) => { $id(id).style.display = 'none'; });
    console.error(e); return;
  }
  result = calculate(data);
  const url = data.url || CONFIG.electionUrl;
  $id('electionsUrl').href = url;
  $id('electionsUrl2').href = url;

  const hasBar = renderBar(result, { link: true });
  fillUpdateText(data.lastUpdate);
  fillGeneralInfo(data);
  fillTable();
  $('[data-toggle="tooltip"]').tooltip();
  getTableHeader();
  window.addEventListener('resize', getTableHeader);

  if (hasBar) {
    $('#prog_bar').sortable({ revert: true, cursor: 'move', update: () => { rebuildTicks(); setInput(); } });
  }
}

function fillUpdateText(lastUpdate) {
  const u = updateTexts(lastUpdate);
  $id('updateTime').textContent = u.text;
  if (u.kind === 'sim' || u.kind === 'none') $id('refToElecWeb').textContent = u.text;
  else $id('lastUpdate').textContent = u.kind === 'final' ? 'נלקח' : u.text;
}

function fillGeneralInfo(data) {
  const r = result;
  const cell = (label, value) => `<th><table class='table table-borderless moblie_general_info'><tr><td class='d-lg-none'>${label}</td><td>${value}</td></tr></table></th>`;
  const hasVotes = r.accepted > 0;
  let h = '';
  h += cell('קולות כשרים', hasVotes ? fmt(r.accepted) : '0');
  h += cell('קולות למנדט', hasVotes ? fmt(r.votesPerSeat.toFixed(2)) : '0');
  h += cell('אחוז המצביעים' + INFO_ICON('אחוז הקולות שנספרו מתוך בעלי זכות ההצבעה'), hasVotes ? fmt(((parseInt(data["general"]["קולות עד עתה"].replaceAll(",", ""))/parseInt(data["general"]["מספר בעלי זכות בחירה"].replaceAll(",", ""))) * 100).toFixed(2)) + '%' : '0%');
  h += cell('קולות מבוזבזים ' + INFO_ICON('סך הקולות של מפלגות שלא עברו את אחוז החסימה'), fmt(r.trashVotes));
  h += cell('מנדטים עודפים ' + INFO_ICON('מספר המנדטים שנותרו לחלק בין המפלגות שעברו את אחוז החסימה'), r.leftover);
  const tip = 'האם המפלגה הרוויחה מנדט נוסף מהסכם עודפים עם המפלגה המצויינת למטה או מחוק בדר-עופר';
  h += `<th id='explain'><table class='table table-borderless moblie_general_info'><tr><td class='d-lg-none' id='explain_name'>מקרא</td><td>
    <table id='explain_table' class='table table-borderless'><tr>
      <td><div class="col-md-3 text-center" style="display: inline-table">${CARET_UP}<div class="parties_excesses">מפלגה</div></div>
        <span class="color_explain d-none d-lg-block" id="madnats_explain_span"> - קבלת מנדט ${INFO_ICON(tip)}\n - הסכם עודפים</span></td>
      <td class="d-lg-none" style="vertical-align: bottom;"><span class="color_explain">קבלת מנדט ${INFO_ICON(tip)}\nהסכם עודפים</span></td>
    </tr></table></td></tr></table></th>`;
  $id('general_info_data').innerHTML = h;
}

function fillTable() {
  let rows = '';
  result.parties.forEach((p) => {
    const key = p.cfg ? p.cfg.key : '';
    const short = p.cfg ? p.cfg.name : p.name;
    const did = result.passed.includes(p);
    rows += `<tr id='row-${key}'>`;
    rows += `<td class='d-none d-lg-table-cell'>${esc(p.name)}</td><td class='d-lg-none'>${esc(short)}</td>`;
    rows += `<td class='d-none d-lg-table-cell'>${esc(p.char)}</td>`;
    rows += `<td class='d-none d-lg-table-cell'>${fmt(p.votes)}</td><td class='d-none d-lg-table-cell'>${esc(p.percent)}</td>`;
    rows += `<td class='d-lg-none' style='white-space:pre-line'>${fmt(p.votes)}\n(${esc(p.percent)})</td>`;
    rows += `<td style='text-align: center;' class='d-none d-lg-table-cell'>${did ? p.base : 0}</td>`;
    rows += `<td style='text-align: center;' class='table-secondary party'><table id='mandats_table' class='table table-borderless'><tr><td>`;
    rows += did
      ? `<span class='badge badge-secondary mandats' style='background-color: ${p.cfg ? p.cfg.color : ''};'>${p.seats}</span></td>`
      : `<span class='mandats'>0</span></td>`;
    rows += '<td>';
    p.arrows.forEach((a) => {
      rows += `<div class="col-md-3 text-center arrows" style="display: inline-table">${CARET_UP}<div class="parties_excesses">${esc(a)}</div></div>`;
    });
    rows += '</td></tr></table></td></tr>';
  });
  $id('parties').insertAdjacentHTML('beforeend', rows);
}

function getTableHeader() {
  const theads = document.getElementsByTagName('thead');
  if (theads[2]) document.documentElement.style.scrollPaddingTop = theads[2].offsetHeight + 'px';
}

/* ----- share / embed overlay (called from inline onclick in index.html) ----- */

const pageBase = () => location.href.split('#')[0].replace(/[^/]*$/, '');

function on(type) {
  document.getElementsByClassName('flip-box-inner')[0].style.transform = 'rotateX(180deg)';
  const order = currentOrderString();
  $id('link_to_share').value = type === 'share'
    ? pageBase() + 'index.html#' + order
    : `<iframe src='${pageBase()}embed.html#${order}' title='elections_bar' style='height:max-content;width:100%;border:none;overflow:hidden;' scrolling='no'></iframe>`;
}

function off() {
  document.getElementsByClassName('flip-box-inner')[0].style.transform = 'rotateX(0deg)';
}

function share() {
  navigator.clipboard.writeText($id('link_to_share').value);
  const btn = $id('btn_copy');
  btn.textContent = 'הועתק'; btn.classList.replace('btn-primary', 'btn-success');
  setTimeout(() => {
    off();
    setTimeout(() => { btn.textContent = 'העתקה'; btn.classList.replace('btn-success', 'btn-primary'); }, 1000);
  }, 1300);
}

init();
