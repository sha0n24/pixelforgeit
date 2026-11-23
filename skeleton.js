/* skeleton.js - reusable skeleton placeholders and progressive reveal (no dependencies)
   Skeleton builders return HTML strings that mirror the real components, so nothing jumps when content arrives.
   enqueue() reveals components one at a time; lazy() waits until a component is near the screen. */
const Sk = (() => {
  const Q = []; let running = false, io = null;
  const W = ['58%', '78%', '44%', '68%', '52%', '72%'];   // varied bar widths look more natural

  /* ---------- progressive reveal ---------- */
  function drain() {
    const fn = Q.shift();
    if (!fn) { running = false; return; }
    try { fn(); } catch (e) { console.error(e); }
    setTimeout(drain, 110);                                // one component at a time
  }
  const enqueue = fn => { Q.push(fn); if (!running) { running = true; drain(); } };
  const reset = () => { Q.length = 0; if (io) { io.disconnect(); io = null; } };
  function lazy(el, fn) {                                  // below the fold: render only when close to the viewport
    if (!el) return;
    if (!('IntersectionObserver' in window)) return enqueue(fn);
    if (!io) io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); enqueue(e.target._go); } }), { rootMargin: '200px 0px' });
    el._go = fn; io.observe(el);
  }

  /* ---------- skeleton builders ---------- */
  const bar = (w, h, extra = '') => `<span class="sk" style="width:${w};height:${h};${extra}"></span>`;

  function table(cols, rows = 6) {
    let h = '<thead><tr>' + Array.from({ length: cols }, (_, i) => `<th><span class="sk sk-th" style="width:${W[(i + 2) % 6]}"></span></th>`).join('') + '<th><span class="sk sk-th" style="width:56px"></span></th></tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      h += '<tr class="sk-row">' + Array.from({ length: cols }, (_, i) => `<td><span class="sk sk-td" style="width:${W[(r + i) % 6]}"></span></td>`).join('') +
        '<td class="act"><span class="sk sk-btn"></span><span class="sk sk-btn"></span></td></tr>';
    }
    return h + '</tbody>';
  }

  const stats = () => ['Total users', 'Managers', 'Sales executives', 'Active', 'Inactive']
    .map(t => `<div class="stat"><b class="sk sk-num"></b><span>${t}</span></div>`).join('');

  const rank = (n = 6) => '<ol class="rank">' + Array.from({ length: n }, () =>
    `<li><span class="sk sk-circle"></span><div class="rb">${bar('46%', '1rem')}${bar('70%', '.7rem', 'margin-top:.4rem')}${bar('100%', '6px', 'margin-top:.5rem')}</div>${bar('3.4rem', '1rem')}</li>`).join('') + '</ol>';

  function dashboard(manager) {
    const bars = [40, 62, 35, 70, 50, 80, 58, 66, 45, 72, 52, 60].map(h => `<span class="sk" style="height:${h}%"></span>`).join('');
    const legend = '<p class="legend"><span><i class="lp"></i>Paid</span><span><i class="ld"></i>Due</span></p>';
    const panel = (t, id) => `<section class="panel"><div class="ph"><h3>${t}</h3></div><div id="${id}" class="chart-host"><div class="sk-chart">${bars}</div></div>${legend}</section>`;
    const two = (a, b) => `<div class="grid2">${panel('Daily sales · last 30 days', a)}${panel('Monthly sales · last 12 months', b)}</div>`;
    const kpi = '<div class="stats">' + ['Today', 'This month', 'Paid this month', 'Due this month', 'Orders this month'].map(t => `<div class="stat"><b class="sk sk-num"></b><span>${t}</span></div>`).join('') + '</div>';
    const top = '<h2 class="dh">Top 10 sales executives</h2><section class="panel"><div class="ph"><h3 id="topT">Top 10</h3><div class="seg"><button type="button" class="ghost" data-per="month">This month</button><button type="button" class="ghost" data-per="all">All time</button></div></div><div id="rank">' + rank() + '</div></section>';
    return manager
      ? kpi + '<h2 class="dh">All sales executives</h2>' + two('c_d1', 'c_m1') +
        '<div id="execSec"><h2 class="dh">Per sales executive</h2><div class="pick"><label>Sales executive</label><div id="execHost"><span class="sk sk-select"></span></div><p id="execKpi" class="hint">' + bar('70%', '1rem') + '</p></div>' + two('c_d2', 'c_m2') + '</div>' + top
      : kpi + '<h2 class="dh">My sales</h2>' + two('c_d1', 'c_m1') + top;
  }

  const auth = () => bar('42%', '2rem', 'margin:.2rem 0 1.2rem') +
    ['Username', 'Password'].map(() => bar('28%', '.8rem', 'margin-top:.8rem') + '<span class="sk sk-input"></span>').join('') + '<span class="sk sk-input" style="margin-top:1.1rem"></span>';

  const popup = () => bar('52%', '1.7rem', 'margin:.2rem 0 1.2rem') + bar('30%', '1rem', 'margin-bottom:.8rem') +
    '<div class="sk-kv">' + Array.from({ length: 6 }, () => `<div>${bar('40%', '.7rem')}${bar('75%', '1rem', 'margin-top:.4rem')}</div>`).join('') + '</div>' +
    bar('46%', '1rem', 'margin:1.2rem 0 .8rem') + Array.from({ length: 3 }, () => bar('100%', '2.6rem', 'margin-bottom:.5rem')).join('');

  return { enqueue, lazy, reset, table, stats, dashboard, rank, auth, popup };
})();
