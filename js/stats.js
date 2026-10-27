const FONT = 'Alef, Arial, sans-serif';

const tooltip = (title, label) => ({
  rtl: true, textDirection: 'rtl', displayColors: false, bodyAlign: 'right', titleAlign: 'center',
  callbacks: { title, label },
});
const noop = () => {};
const datalabels = (formatter) => ({ display: true, align: 'center', textAlign: 'center', formatter, font: { size: 22, family: FONT }, color: '#000' });
const centerText = (text, withLegend) => ({
  beforeDraw(chart) {
    const { width, height, ctx } = chart; ctx.restore();
    ctx.font = (height / 125).toFixed(2) + 'rem Alef'; ctx.textBaseline = 'middle';
    const narrow = window.innerWidth < 992, w = ctx.measureText(text).width;
    let x, y = height / 2;
    if (withLegend) {
      x = narrow ? Math.round((width - w) / 2) : Math.round((width + w) / 2 + chart.legend.width / 2);
      if (narrow) y = height / 2 - chart.legend.height / 2;
    } else x = Math.round((width + w) / 2);
    ctx.fillText(text, x, y); ctx.save();
  },
});

async function init() {
  let data;
  try { data = await loadData(); } catch (e) { console.error(e); return; }
  const r = calculate(data);
  const url = data.url || CONFIG.electionUrl;
  $id('electionsUrl2').href = url;
  if (!r.passed.length) return;

  /* blocs */
  const blocs = CONFIG.blocs.map((b) => ({ ...b, seats: 0, votes: 0, parties: [], seatList: [], colors: [] }));
  r.passed.forEach((p) => {
    const b = blocs.find((x) => x.id === blocOf(p)) || blocs[0];
    const name = p.cfg ? p.cfg.name : p.name;
    b.seats += p.seats; b.votes += p.votes; b.parties.push(name); b.seatList.push(p.seats); b.colors.push(p.cfg ? p.cfg.color : '#BDBDBD');
  });
  const bloc = (id) => blocs.find((b) => b.id === id) || { parties: [], seatList: [], colors: [] };
  const partiesOf = (label) => (blocs.find((b) => b.label === label) || { parties: [] }).parties;

  const legendPos = () => (window.innerWidth < 992 ? 'bottom' : 'left');
  const blocLabels = blocs.map((b) => b.label), blocColors = blocs.map((b) => b.color);

  new Chart($id('blocks'), {
    type: 'doughnut',
    data: { labels: blocLabels, datasets: [{ data: blocs.map((b) => b.seats), backgroundColor: blocColors, hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, rotation: 180,
      plugins: {
        tooltip: tooltip((c) => c[0].label + ' - ' + c[0].raw + ' מנדטים', (c) => partiesOf(c.label)),
        datalabels: datalabels((v) => v),
        legend: { position: legendPos, rtl: true, reverse: true, onClick: noop, labels: { font: { family: FONT, size: 14 } } },
      },
    },
    plugins: [centerText('מנדטים', true), ChartDataLabels],
  });

  new Chart($id('myChart2'), {
    type: 'doughnut',
    data: { labels: blocLabels, datasets: [{ data: blocs.map((b) => b.votes / r.accepted * 100), backgroundColor: blocColors, hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, rotation: 180,
      plugins: {
        tooltip: tooltip((c) => c[0].label + ' - ' + c[0].raw.toFixed(2) + '%', (c) => partiesOf(c.label)),
        datalabels: datalabels((v) => v.toFixed(0) + '%'),
        legend: { display: false },
      },
    },
    plugins: [centerText('קולות', false), ChartDataLabels],
  });

  new Chart($id('parties'), {
    type: 'bar',
    data: {
      labels: r.passed.map((p) => (p.cfg ? p.cfg.name : p.name)),
      datasets: [{ data: r.passed.map((p) => p.seats), backgroundColor: r.passed.map((p) => (p.cfg ? p.cfg.color : '#BDBDBD')), hoverOffset: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltip((c) => c[0].label, (c) => c.raw + ' מנדטים'), legend: { display: false } },
      scales: { y: { max: r.passed[0].seats + 10, ticks: { stepSize: 5 } } },
    },
  });

  const pie = (canvasId, id, pos) => {
    const b = bloc(id);
    new Chart($id(canvasId), {
      type: 'pie',
      data: { labels: b.parties, datasets: [{ data: b.seatList, backgroundColor: b.colors, hoverOffset: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: tooltip((c) => c[0].label, (c) => c.raw + ' מנדטים'), legend: { position: pos, rtl: true, onClick: noop } },
      },
    });
  };
  pie('netanyahu-block', 'netanyahu', 'right');
  pie('lapid-block', 'lapid', 'left');

  /* wasted votes (everything in "seat equivalents") */
  const seatEq = (v) => v / r.votesPerSeat;
  const trashSeats = seatEq(r.trashVotes);
  const seatTip = tooltip((c) => c[0].label, (c) => c.raw.toFixed(2) + ' מנדטים');

  new Chart($id('wasted-votes'), {
    type: 'pie',
    data: { labels: ['קולות מבוזבזים', 'שאר הקולות'], datasets: [{ data: [trashSeats, CONFIG.totalSeats - trashSeats], backgroundColor: ['rgb(255, 99, 132)', 'rgb(54, 162, 235)'], hoverOffset: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: seatTip, legend: { position: 'right', rtl: true, onClick: noop } } },
  });

  const next = r.failed.slice(0, 3);
  if (next.length) {
    const cut = (s) => s.slice(0, 20) + '...';
    const rest = r.failed.slice(3).reduce((s, p) => s + p.votes, 0);
    new Chart($id('wasted-parties'), {
      type: 'pie',
      data: {
        labels: [...next.map((p) => cut(p.name)), 'כל השאר'],
        datasets: [{ data: [...next.map((p) => seatEq(p.votes)), seatEq(rest)], backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726', '#BDBDBD'], hoverOffset: 4 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: seatTip, legend: { position: 'left', rtl: true, onClick: noop } } },
    });

    new Chart($id('almost-enter'), {
      type: 'bar',
      data: { labels: next.map((p) => p.name), datasets: [{ data: next.map((p) => seatEq(p.votes)), backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'], hoverOffset: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: seatTip, legend: { display: false } },
        scales: {
          y: { max: 4 },
          x: { ticks: { callback(val) { const l = this.getLabelForValue(val); return l.length > 13 && window.innerWidth < 992 ? l.slice(0, 13) + '...' : l; } } },
        },
      },
    });
  }
}

init();
