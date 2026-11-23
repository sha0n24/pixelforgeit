const $ = s => document.querySelector(s);
const PS = 10, ROLES = ['Manager', 'Sales Executive'];
const FT = { Paid: 'number', Due: 'number', Total_Paid: 'number', Sale_Date: 'date' };
let TOKEN = '', USER = null, TAB = 'clients', SAVE = null;
let DASH = null, PER = 'month', BYF = '', EXECS = [];
const BYCOL = 'Clients By';
const SHOW_LOADER_TEXT = false;   // true = show the PIXEL FORGE IT letters during actions, false = only a thin top bar
if (!SHOW_LOADER_TEXT) document.getElementById('loader').classList.add('quiet');
let SUG = { customers: [], products: [] };
let CACHE = {}, GEN = 0, ANIM = false, LOADING = false;   // response cache, tab generation, row animation flag, table skeleton flag
let H = [], ROWS = [], IDK = 'id', ED = [], q = '', rf = '', sk = null, sd = 1, page = 1;
try { TOKEN = sessionStorage.getItem('tok') || ''; } catch (_) {}

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABELS = { Customer_Name: 'Name', Customer_Type: 'Type', 'Total Pament': 'Total Paid', 'Total Payment': 'Total Paid' };   // Sales table headings
const label = h => LABELS[h] || h.replace(/_/g, ' ');

function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  setTimeout(() => t.className = '', 3500);
}

/* ---------- loading: skeletons for reading data, PIXEL FORGE IT loader for actions (login, save, delete...) ---------- */
let PENDING = 0, hideT = null;
function busy(d) {
  PENDING += d; clearTimeout(hideT);
  if (PENDING > 0) $('#loader').classList.add('on');
  else hideT = setTimeout(() => $('#loader').classList.remove('on'), 180);   // short delay avoids flicker between back-to-back requests
}
const READS = ['status', 'me', 'list', 'customer', 'dashboard'];
const cacheGet = k => { const c = CACHE[k]; return c && Date.now() - c.t < 30000 ? c.d : null; };   // 30 s: avoids repeat requests when switching tabs
const cacheSet = (k, d) => { CACHE[k] = { d, t: Date.now() }; };
async function api(action, extra = {}) {
  const read = READS.indexOf(action) >= 0 || (action === 'users' && extra.op === 'list');
  if (!read) busy(1);
  try { const r = await apiRaw(action, extra); if (!read) CACHE = {}; return r; }   // any change clears the cache
  finally { if (!read) busy(-1); }
}
async function apiRaw(action, extra = {}) {
  const r = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
    body: JSON.stringify({ action, token: TOKEN, ...extra })
  });
  const j = await r.json();
  if (!j.ok) {
    if (/Session expired|Not logged in/.test(j.error)) logoutLocal();
    throw new Error(j.error);
  }
  return j.data;
}

/* ---------- screens ---------- */
function show(which) {
  const app = which === 'app';
  $('#auth').hidden = app; $('#app').hidden = !app;
  $('#authSk').hidden = which !== 'authsk'; $('#atitle').hidden = which === 'authsk';
  $('#loginForm').hidden = which !== 'login'; $('#setupForm').hidden = which !== 'setup';
  $('#atitle').textContent = which === 'setup' ? 'First-time setup' : 'Sign in';
}
const readUser = () => { try { return JSON.parse(sessionStorage.getItem('usr') || 'null'); } catch (_) { return null; } };
const saveUser = () => { try { sessionStorage.setItem('usr', JSON.stringify({ Full_Name: USER.Full_Name, Role: USER.Role, Username: USER.Username })); } catch (_) {} };
const whoHtml = u => `${esc(u.Full_Name)} <span class="badge ${u.Role === 'Manager' ? 'mgr' : 'exe'}">${esc(u.Role)}</span>`;
function logoutLocal() {
  TOKEN = ''; USER = null; CACHE = {}; GEN++; Sk.reset();
  try { sessionStorage.removeItem('tok'); sessionStorage.removeItem('usr'); } catch (_) {}
  show('login');
}
async function boot() {
  $('#authSk').innerHTML = Sk.auth();
  if (TOKEN) {                       // returning visitor: show the real page frame at once, verify the session in the background
    const cu = readUser();
    show('app');
    if (cu) { USER = cu; enter(); }
    else {
      $('#who').innerHTML = '<span class="sk sk-pill"></span>';
      document.querySelector('[data-tab=users]').hidden = true; $('#repair').hidden = true;
      $('#wrap').hidden = true; $('#pager').hidden = true; $('#dash').hidden = false; showDashSkeleton();
    }
    try {
      const me = await api('me'), changed = !USER || USER.Role !== me.Role;
      USER = me; saveUser();
      if (changed) enter(); else $('#who').innerHTML = whoHtml(me);
    } catch (e) { if (TOKEN) $('#status').textContent = 'Cannot reach the server: ' + e.message; }
    return;
  }
  show('authsk');
  try { const s = await api('status'); show(s.initialized ? 'login' : 'setup'); }
  catch (e) { show('login'); $('#authMsg').textContent = 'Cannot reach the server: ' + e.message; }
}
function enter() {
  show('app');
  const mgr = USER.Role === 'Manager';
  $('#who').innerHTML = whoHtml(USER);
  document.querySelector('[data-tab=users]').hidden = !mgr;
  $('#repair').hidden = !mgr;
  switchTab('dashboard');
}
function switchTab(t) {
  GEN++; Sk.reset(); LOADING = false;
  TAB = t; q = ''; rf = ''; BYF = ''; sk = null; page = 1;
  $('#search').value = ''; $('#roleFilter').value = '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#roleFilter').hidden = t !== 'users'; $('#stats').hidden = t !== 'users';
  const dash = t === 'dashboard';
  $('#tools').hidden = dash; $('#byFilter2').hidden = true;
  $('#search').hidden = dash; $('#csv').hidden = dash; $('#wrap').hidden = dash; $('#pager').hidden = dash; $('#dash').hidden = !dash;
  $('#add').hidden = dash || t === 'sales';   // sales are added only from Clients > Add Sale
  load();
}

/* ---------- data ---------- */
function showTableSkeleton() {
  LOADING = true;
  let cols = 0; try { cols = +localStorage.getItem('cols_' + TAB) || 0; } catch (_) {}
  $('#tbl').innerHTML = Sk.table(cols || (TAB === 'users' ? 5 : 9));   // same column count as last time, so the layout does not jump
  $('#pinfo').textContent = ''; $('#status').textContent = '';
  if (TAB === 'users') $('#stats').innerHTML = Sk.stats();
}
function applyList(d, anim) {
  if (TAB === 'users') { H = ['Full_Name', 'Username', 'Role', 'Status', 'Created_At']; ROWS = d.rows; IDK = 'User_ID'; ED = []; stats(ROWS); }
  else { H = d.headers; ROWS = d.rows; IDK = d.idKey; ED = d.editable; SUG = d.suggest || SUG; EXECS = d.executives || []; }
  try { localStorage.setItem('cols_' + TAB, H.length); } catch (_) {}
  LOADING = false; ANIM = anim; $('#status').textContent = ''; render();
}
async function load(force) {
  if (TAB === 'dashboard') return loadDash(force);
  const tab = TAB, g = GEN, hit = force ? null : cacheGet(tab);
  if (hit) return applyList(hit, false);                 // fresh copy in memory: no request, no skeleton
  showTableSkeleton();
  try {
    const d = tab === 'users' ? await api('users', { op: 'list' }) : await api('list', { table: tab });
    cacheSet(tab, d);
    if (g === GEN) applyList(d, true);
  } catch (e) { if (g === GEN) { LOADING = false; $('#tbl').innerHTML = ''; $('#status').textContent = 'Error: ' + e.message; } }
}

function stats(r) {
  const c = f => r.filter(f).length;
  const items = [['Total users', r.length], ['Managers', c(x => x.Role === 'Manager')], ['Sales executives', c(x => x.Role !== 'Manager')], ['Active', c(x => x.Status === 'Active')], ['Inactive', c(x => x.Status !== 'Active')]];
  $('#stats').innerHTML = items.map(([k, v]) => `<div class="stat"><b class="fade-in">${v}</b><span>${k}</span></div>`).join('');
}

function view() {
  const r = ROWS.filter(x => (!q || H.some(h => String(x[h]).toLowerCase().includes(q))) && (!rf || x.Role === rf) && (!hasBy() || !BYF || (BYF === '__none__' ? !x[byCol()] : x[byCol()] === BYF)));
  if (sk) r.sort((a, b) => String(a[sk]).localeCompare(String(b[sk]), undefined, { numeric: true }) * sd);
  return r;
}

/* ---------- WhatsApp (phone number or username) ---------- */
function phoneKey(keys = H) {
  const want = String(WHATSAPP_COLUMN).trim().toLowerCase();
  return keys.find(h => h.trim().toLowerCase() === want)
      || keys.find(h => /phone|mobile|number|whatsapp|contact/i.test(h));
}
function waBtn(row, keys = H) {
  const key = phoneKey(keys);
  if (!key) return '';
  const raw = String(row[key] ?? '').trim();
  if (!raw) return '';
  const text = WHATSAPP_MESSAGE ? '?text=' + encodeURIComponent(WHATSAPP_MESSAGE) : '';
  let url;
  if (/^(@[\w.]{3,35}|[A-Za-z][\w.]{2,34})$/.test(raw)) {
    url = 'https://wa.me/' + encodeURIComponent(raw.replace(/^@/, '')) + text;
  } else {
    let n = raw.replace(/\D/g, '');
    if (!n) return '';
    if (n.startsWith('00')) n = n.slice(2);
    else if (n.startsWith('0')) n = DEFAULT_COUNTRY_CODE + n.slice(1);
    else if (!n.startsWith(DEFAULT_COUNTRY_CODE) && n.length <= 10) n = DEFAULT_COUNTRY_CODE + n;
    url = 'https://wa.me/' + n + text;
  }
  return `<a class="wa" href="${esc(url)}" target="_blank" rel="noopener">WhatsApp</a>`;
}

/* ---------- table ---------- */
function actions(x) {
  const id = esc(x[IDK]);
  const b = (a, t, c = '') => `<button class="${c}" data-a="${a}" data-id="${id}">${t}</button>`;
  if (TAB === 'users') return b('edit', 'Edit') + b('reset', 'Reset Password', 'ghost') + b('status', x.Status === 'Active' ? 'Deactivate' : 'Activate', 'ghost') + b('del', 'Delete', 'del');
  return b('edit', 'Edit') + (TAB === 'clients' ? b('sale', 'Add Sale', 'sale') : '') + (USER.Role === 'Manager' || TAB === 'sales' ? b('del', 'Delete', 'del') : '') + (TAB === 'clients' ? waBtn(x) : '');
}

// "Clients By" dropdown: pick a sales executive to see only the clients they added
// Clients table has "Clients By"; the Sales table (manager only) has "Clients_By"
const byCol = () => TAB === 'sales' ? 'Clients_By' : BYCOL;
const hasBy = () => TAB === 'clients' || (TAB === 'sales' && H.indexOf('Clients_By') >= 0);
function byOptions() {
  const names = Array.from(new Set(EXECS.concat(ROWS.map(r => r[byCol()]).filter(Boolean)))).sort();
  return '<option value="">All executives</option>' + names.map(n => `<option value="${esc(n)}"${BYF === n ? ' selected' : ''}>${esc(n)}</option>`).join('') +
    `<option value="__none__"${BYF === '__none__' ? ' selected' : ''}>Not set</option>`;
}
function setBy(v) { BYF = v; page = 1; render(); }

function cell(x, h) {
  if (TAB === 'sales' && h === 'Customer_Name') return `<button class="link" data-a="cust" data-name="${esc(x[h])}">${esc(x[h])}</button>`;
  if (TAB === 'sales' && h === 'Customer_Type') return `<span class="chip ${x[h] === 'New' ? 'new' : 'rep'}">${esc(x[h])}</span>`;
  return esc(x[h]);
}

function render() {
  if (TAB === 'dashboard' || LOADING) return;
  const anim = ANIM; ANIM = false;                       // rows fade in one by one only right after loading
  const r = view(), pages = Math.max(1, Math.ceil(r.length / PS));
  page = Math.min(page, pages);
  const rows = r.slice((page - 1) * PS, page * PS);
  $('#tbl').innerHTML =
    '<thead><tr>' + H.map(h => `<th data-k="${esc(h)}">${esc(label(h))}${sk === h ? (sd > 0 ? ' ▲' : ' ▼') : ''}${hasBy() && h === byCol() ? `<select id="byFilter" class="th-sel" aria-label="Filter clients by sales executive">${byOptions()}</select>` : ''}</th>`).join('') + '<th>Actions</th></tr></thead>' +
    '<tbody' + (anim ? ' class="anim"' : '') + '>' + (rows.map((x, n) => `<tr style="--n:${n}">` + H.map(h => `<td data-label="${esc(label(h))}">${cell(x, h)}</td>`).join('') +
      `<td class="act">${actions(x)}</td></tr>`).join('')
      || `<tr><td colspan="${H.length + 1}">No data</td></tr>`) + '</tbody>';
  $('#byFilter2').hidden = !hasBy(); if (hasBy()) $('#byFilter2').innerHTML = byOptions();
  $('#pinfo').textContent = `Page ${page}/${pages} (${r.length} rows)`;
}

/* ---------- generic form dialog ---------- */
function openForm(title, fields, onSave, vals = {}) {
  $('#dtitle').textContent = title; $('#fields').oninput = null;
  $('#fields').innerHTML = fields.map(f => {
    const lab = `<label for="f_${f.n}">${esc(f.l || label(f.n))}${f.req ? ' *' : ''}</label>`;
    if (f.opts) return lab + `<select id="f_${f.n}" name="${f.n}">${f.opts.map(o => `<option${vals[f.n] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    const attrs = (f.req ? ' required' : '') + (f.t === 'password' ? ' autocomplete="new-password" minlength="8"' : '') + (f.t === 'number' ? ' step="any" min="0"' : '') + (f.ro ? ' readonly' : '') + (f.dl ? ` list="dl_${f.n}" autocomplete="off"` : '');
    return lab + `<input id="f_${f.n}" name="${f.n}" type="${f.t || 'text'}" value="${f.t === 'password' ? '' : esc(vals[f.n])}"${attrs}>` +
      (f.dl ? `<datalist id="dl_${f.n}">${f.dl.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : '');
  }).join('');
  SAVE = onSave; $('#dlg').showModal();
}
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// Total Paid = Paid + Due, updated live in the form (the server recalculates it too)
function liveTotal() {
  const f = $('#fields'), set = () => { const v = id => parseFloat(($('#f_' + id) || {}).value) || 0; if ($('#f_Total_Paid')) $('#f_Total_Paid').value = Math.round((v('Paid') + v('Due')) * 100) / 100; };
  f.oninput = set; set();
}
const fields = () => ED.map((h, i) => ({ n: h, req: h !== 'Total_Paid' && (i === 0 || TAB === 'sales'), ro: h === 'Total_Paid', t: FT[h], dl: TAB === 'sales' ? (h === 'Customer_Name' ? SUG.customers : h === 'Product' ? SUG.products : null) : null }));

$('#form').onsubmit = async e => {
  e.preventDefault();
  const d = {}, btn = e.submitter;
  new FormData(e.target).forEach((v, k) => d[k] = k === 'Password' ? v : v.trim());
  if (btn) { btn.classList.add('btn-busy'); btn.disabled = true; }
  try { await SAVE(d); $('#dlg').close(); toast('Saved'); load(); }
  catch (err) { toast(err.message, true); }
  finally { if (btn) { btn.classList.remove('btn-busy'); btn.disabled = false; } }
};

$('#add').onclick = () => {
  if (TAB === 'users') return openForm('Add user', [{ n: 'Full_Name', req: 1 }, { n: 'Username', req: 1 }, { n: 'Password', t: 'password', req: 1 }, { n: 'Role', opts: ROLES }], d => api('users', { op: 'create', data: d }));
  openForm('Add record', fields(), d => api('create', { table: TAB, data: d }), TAB === 'sales' ? { Sale_Date: today() } : {});
};

$('#tbl').onchange = e => { if (e.target.id === 'byFilter') setBy(e.target.value); };
$('#byFilter2').onchange = e => setBy(e.target.value);
$('#tbl').onclick = async e => {
  if (e.target.closest('select')) return;
  const th = e.target.closest('th[data-k]');
  if (th) { sd = sk === th.dataset.k ? -sd : 1; sk = th.dataset.k; return render(); }
  const cb = e.target.closest('button[data-a="cust"]');
  if (cb) return openCustomer(cb.dataset.name);
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const id = b.dataset.id, a = b.dataset.a, row = ROWS.find(x => String(x[IDK]) === id) || {};
  try {
    if (a === 'edit') {
      return TAB === 'users'
        ? openForm('Edit user', [{ n: 'Full_Name', req: 1 }, { n: 'Role', opts: ROLES }], d => api('users', { op: 'update', id, data: d }), row)
        : (openForm('Edit record', fields(), d => api('update', { table: TAB, id, data: d }), row), TAB === 'sales' && liveTotal());
    }
    if (a === 'sale') {
      const nk = H.find(h => h.trim().toLowerCase() === 'name');
      openForm('Add sale: ' + (nk ? row[nk] : ''),
        [{ n: 'Product', req: 1, dl: SUG.products }, { n: 'Paid', t: 'number', req: 1 }, { n: 'Due', t: 'number', req: 1 }, { n: 'Total_Paid', t: 'number', ro: 1 }, { n: 'Sale_Date', t: 'date', req: 1 }],
        d => api('create', { table: 'sales', clientId: id, data: d }), { Product: row['Type of Service'] || '', Paid: '0', Due: '0', Sale_Date: today() });
      return liveTotal();
    }
    if (a === 'reset') return openForm('Reset password: ' + row.Username, [{ n: 'Password', l: 'New password', t: 'password', req: 1 }], d => api('users', { op: 'reset', id, data: d }));
    if (a === 'status') {
      const act = row.Status !== 'Active';
      if (!confirm((act ? 'Activate ' : 'Deactivate ') + row.Username + '?')) return;
      await api('users', { op: 'status', id, active: act }); toast('Updated'); return load();
    }
    if (a === 'del') {
      if (!confirm('Delete this ' + (TAB === 'users' ? 'user' : 'record') + ' permanently?')) return;
      await (TAB === 'users' ? api('users', { op: 'delete', id }) : api('delete', { table: TAB, id }));
      toast('Deleted'); load();
    }
  } catch (err) { toast(err.message, true); }
};

/* ---------- dashboard ---------- */
const fmt = n => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 2 });
const short = n => n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : String(+n.toFixed(1));
const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const tick = l => l.length === 10 ? l.slice(5) : new Date(l + '-01T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' }) + ' ' + l.slice(2, 4);

// Stacked bar chart (Paid + Due) drawn as responsive SVG, no library needed
function chart(id, s) {
  const el = $('#' + id), W = 640, H = 230, L = 46, R = 8, T = 10, B = 26, n = s.labels.length, ph = H - T - B;
  const tot = s.paid.map((p, i) => p + s.due[i]), mx = Math.max(...tot), max = niceMax(Math.max(mx, 1)), bw = (W - L - R) / n, step = n > 12 ? 5 : 1;
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = T + ph * (1 - i / 4); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${short(max * i / 4)}</text>`; }
  s.labels.forEach((l, i) => {
    const x = L + i * bw + bw * 0.15, w = bw * 0.7, hp = ph * s.paid[i] / max, hd = ph * s.due[i] / max, base = T + ph;
    g += `<g><title>${esc(l)}: total ${fmt(tot[i])} (paid ${fmt(s.paid[i])}, due ${fmt(s.due[i])}, ${s.count[i]} orders)</title>` +
      `<rect x="${x}" y="${base - hp}" width="${w}" height="${hp}" class="bp"/><rect x="${x}" y="${base - hp - hd}" width="${w}" height="${hd}" class="bd"/></g>`;
    if ((n - 1 - i) % step === 0) g += `<text x="${x + w / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(tick(l))}</text>`;
  });
  if (!mx) g += `<text x="${W / 2}" y="${H / 2}" class="ax" text-anchor="middle">No sales in this period</text>`;
  el.innerHTML = `<svg class="fade-in" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales chart, paid and due amounts">${g}</svg>`;
}

function showDashSkeleton() {
  Sk.reset();
  $('#dash').innerHTML = Sk.dashboard(USER && USER.Role === 'Manager');
}
async function loadDash(force) {
  const key = 'dash:' + today(), hit = force ? null : cacheGet(key), g = GEN;
  showDashSkeleton();
  try {
    const d = hit || await api('dashboard', { today: today() });
    if (!hit) cacheSet(key, d);
    if (g !== GEN) return;
    DASH = d; $('#status').textContent = ''; fillDash(!!hit);
  } catch (e) { if (g === GEN) { $('#dash').innerHTML = ''; $('#status').textContent = 'Error: ' + e.message; } }
}

// Replace each skeleton with real content in priority order: numbers, charts, per-executive, top 10.
// Components below the screen wait until they are near the viewport; cached data is drawn at once.
function fillDash(instant) {
  const d = DASH, mgr = USER.Role === 'Manager', s = mgr ? d.all : d.mine, k = d.kpi, g = GEN;
  const run = (el, fn) => { const f = () => { if (g === GEN) fn(); }; if (instant || !el) f(); else Sk.lazy(el, f); };
  const vals = [fmt(k.today), fmt(k.month), fmt(k.paid), fmt(k.due), k.orders];
  run($('#dash .stat b'), () => document.querySelectorAll('#dash .stat b').forEach((b, i) => { b.className = 'fade-in'; b.textContent = vals[i]; }));
  run($('#c_d1'), () => chart('c_d1', s.daily));
  run($('#c_m1'), () => chart('c_m1', s.monthly));
  if (mgr) run($('#execHost'), () => fillExec(run));
  run($('#rank'), drawRank);
}

const execOf = () => DASH.byExec.find(x => x.id === ($('#execSel') || {}).value) || DASH.byExec[0];
function execLine(e) {
  const dl = e.daily, ml = e.monthly, n = dl.paid.length - 1, m = ml.paid.length - 1;
  $('#execKpi').textContent = `Today ${fmt(dl.paid[n] + dl.due[n])} · This month ${fmt(ml.paid[m] + ml.due[m])} · Orders this month ${ml.count[m]}`;
}
function fillExec(run) {
  if (!DASH.byExec.length) { $('#execSec').innerHTML = '<h2 class="dh">Per sales executive</h2><p class="hint fade-in">No sales executives yet.</p>'; return; }
  $('#execHost').innerHTML = `<select id="execSel" class="fade-in" aria-label="Sales executive">${DASH.byExec.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>`;
  const e = execOf(); execLine(e);
  run($('#c_d2'), () => chart('c_d2', execOf().daily));
  run($('#c_m2'), () => chart('c_m2', execOf().monthly));
}
function drawExec() { const e = execOf(); chart('c_d2', e.daily); chart('c_m2', e.monthly); execLine(e); }

function drawRank() {
  const month = PER === 'month', list = month ? DASH.topMonth : DASH.topAll, my = month ? DASH.myMonth : DASH.myAll, mx = Math.max(...list.map(r => r.total), 1);
  $('#topT').textContent = month ? 'Top 10 · ' + DASH.month : 'Top 10 · all time';
  document.querySelectorAll('[data-per]').forEach(b => b.classList.toggle('on', b.dataset.per === PER));
  $('#rank').innerHTML = list.length
    ? '<ol class="rank fade-in">' + list.map(r => `<li class="${r.isMe ? 'me' : ''}"><span class="rk">${r.rank}</span><div class="rb"><div class="nm">${esc(r.name)}${r.isMe ? ' <span class="chip new">You</span>' : ''}<small>${r.orders} orders · Paid ${fmt(r.paid)} · Due ${fmt(r.due)}</small></div><div class="bar"><i style="width:${Math.round(r.total / mx * 100)}%"></i></div></div><b>${fmt(r.total)}</b></li>`).join('') + '</ol>'
    : '<p class="hint fade-in">No sales yet.</p>';
  if (USER.Role !== 'Manager' && my && !list.some(r => r.isMe)) $('#rank').insertAdjacentHTML('beforeend', `<p class="hint">Your rank: #${my.rank} of ${my.of} (total ${fmt(my.total)})</p>`);
}
$('#dash').onchange = e => { if (e.target.id === 'execSel') drawExec(); };
$('#dash').onclick = e => { if (!DASH) return; const b = e.target.closest('button[data-per]'); if (b) { PER = b.dataset.per; drawRank(); } };

/* ---------- customer details popup ---------- */
async function openCustomer(name) {
  $('#icontent').innerHTML = Sk.popup(); $('#info').showModal();
  try { renderCustomer(await api('customer', { name })); }
  catch (err) { $('#icontent').innerHTML = `<p class="hint">${esc(err.message)}</p>`; }
}
function renderCustomer(d) {
  const s = d.sales, c = d.clients[0], total = Math.round(s.reduce((t, r) => t + (parseFloat(r.Total_Paid) || 0), 0) * 100) / 100;
  const kv = c ? Object.entries(c).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') : '';
  const wa = c ? waBtn(c, Object.keys(c)) : '';
  $('#icontent').innerHTML =
    `<div class="fade-in"><h2>${esc(d.name)} ${s.length > 1 ? '<span class="chip rep">Repeat customer</span>' : ''}</h2>` +
    '<h3>Client details</h3>' +
    (c ? `<dl class="kv">${kv}</dl>${wa ? `<p>${wa}</p>` : ''}` : '<p class="hint">No client with this name was found in the Clients tab.</p>') +
    `<h3>Services taken (${s.length} ${s.length === 1 ? 'order' : 'orders'}, total ${total})</h3>` +
    (s.length ? '<ul class="svc">' + s.map(r => `<li><b>${esc(r.Product)}</b><span>${esc(r.Sale_Date)} · Paid ${esc(r.Paid)} · Due ${esc(r.Due)} · Total ${esc(r.Total_Paid)} · by ${esc(r.Sold_By)}</span></li>`).join('') + '</ul>' : '<p class="hint">No sales yet.</p>') + '</div>';
}
$('#iclose').onclick = () => $('#info').close();

/* ---------- auth forms and toolbar ---------- */
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); $('#authMsg').textContent = '';
  const btn = e.submitter; btn.disabled = true;
  try {
    const d = await api('login', { username: $('#lu').value.trim(), password: $('#lp').value });
    TOKEN = d.token; USER = d.user;
    try { sessionStorage.setItem('tok', TOKEN); } catch (_) {}
    saveUser();
    $('#lp').value = ''; enter();
  } catch (err) { $('#authMsg').textContent = err.message; }
  btn.disabled = false;
};
$('#setupForm').onsubmit = async e => {
  e.preventDefault(); $('#authMsg').textContent = '';
  const btn = e.submitter; btn.disabled = true; $('#authMsg').textContent = 'Creating spreadsheet and sheets... please wait';
  try {
    const d = await api('setup', { setupKey: $('#sk').value, Full_Name: $('#sn').value.trim(), Username: $('#su').value.trim(), Password: $('#sp').value });
    $('#sp').value = ''; $('#sk').value = '';
    show('login'); $('#authMsg').textContent = 'Setup complete (' + d.steps.length + ' steps). You can sign in now.';
  } catch (err) { $('#authMsg').textContent = err.message; }
  btn.disabled = false;
};
$('#logout').onclick = async () => { try { await api('logout'); } catch (_) {} logoutLocal(); };
$('#repair').onclick = async () => {
  if (!confirm('Check the sheet structure and repair anything missing? Existing data is not deleted.')) return;
  try { const d = await api('init'); toast(d.steps.slice(0, 3).join('; ')); } catch (err) { toast(err.message, true); }
};
$('#tabs').onclick = e => { const b = e.target.closest('button[data-tab]'); if (b) switchTab(b.dataset.tab); };
$('#roleFilter').onchange = e => { rf = e.target.value; page = 1; render(); };
$('#refresh').onclick = () => load(true);
$('#cancel').onclick = () => $('#dlg').close();
$('#search').oninput = e => { q = e.target.value.toLowerCase(); page = 1; render(); };
$('#prev').onclick = () => { page--; render(); };
$('#next').onclick = () => { page++; render(); };
$('#theme').onclick = () => {
  const d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = d;
  try { localStorage.setItem('theme', d); } catch (_) {}
};
$('#csv').onclick = () => {
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const txt = [H.map(h => c(label(h))).join(',')].concat(view().map(r => H.map(h => c(r[h])).join(','))).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
  a.download = TAB + '.csv'; a.click();
};

/* ---------- live date and time ---------- */
function tickClock() {
  const n = new Date();
  $('#clkD').textContent = n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#clkT').textContent = n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
tickClock(); setInterval(tickClock, 1000);

document.title = PAGE_TITLE; $('#title').textContent = PAGE_TITLE;
try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'; } catch (_) {}
boot();
