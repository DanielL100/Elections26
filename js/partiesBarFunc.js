async function init() {
  // clicking the embed opens the full site with the same order
  document.documentElement.addEventListener('click', () => {
    window.open(new URL('index.html', location.href).href.split('#')[0] + location.hash, '_blank');
  });

  let data;
  try { data = await loadData(); } catch (e) { console.error(e); data = null; }
  const res = data ? calculate(data) : { passed: [], failed: [], parties: [] };

  const hasBar = renderBar(res, { link: false });
  const label = $id('updateTime');
  if (hasBar) label.textContent = updateTexts(data.lastUpdate).text;
  else label.style.display = 'none';
}

init();
