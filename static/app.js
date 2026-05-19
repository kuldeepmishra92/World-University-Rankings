'use strict';

// ═══════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════
const html = document.documentElement;
const savedTheme = localStorage.getItem('unirank-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

document.getElementById('theme-toggle').addEventListener('click', () => {
  const cur  = html.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('unirank-theme', next);
  // Re-render active charts with new theme
  rerenderActiveCharts();
});

function getTheme() { return html.getAttribute('data-theme'); }

// ═══════════════════════════════════════════
// FIX #1 & #2 — TOAST + SAFE FETCH WRAPPER
// ═══════════════════════════════════════════
function showToast(msg, type = 'error') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icon = type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ';
  t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 300); }, 4000);
}

async function safeApiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    showToast(err.message || 'Network error — please try again.', 'error');
    return null;
  }
}

// FIX #8 — LOADING SPINNERS
function showLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="chart-loading"><div class="spinner"></div><span>Loading…</span></div>';
}
function showTableLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<tr><td colspan="10" class="table-loading"><div class="spinner"></div><span>Loading…</span></td></tr>';
}

// ═══════════════════════════════════════════
// PLOTLY LAYOUT FACTORY
// ═══════════════════════════════════════════
function layout(overrides = {}) {
  const dark = getTheme() === 'dark';
  const base = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font:  { family: 'Outfit, sans-serif', color: dark ? '#8898C0' : '#384070', size: 12 },
    margin: { t: 16, r: 20, b: 44, l: 56 },
    xaxis: {
      gridcolor:     dark ? '#1D2B44' : '#e6e9f4',
      zerolinecolor: dark ? '#1D2B44' : '#e6e9f4',
      tickfont: { color: dark ? '#5A6A90' : '#6878A8', size: 11 },
      linecolor:     dark ? '#263655' : '#d1d5e8',
    },
    yaxis: {
      gridcolor:     dark ? '#1D2B44' : '#e6e9f4',
      zerolinecolor: dark ? '#1D2B44' : '#e6e9f4',
      tickfont: { color: dark ? '#5A6A90' : '#6878A8', size: 11 },
      linecolor:     dark ? '#263655' : '#d1d5e8',
    },
    legend: {
      bgcolor:     'transparent',
      bordercolor: 'transparent',
      font: { color: dark ? '#8898C0' : '#384070', size: 11 },
    },
    colorway: ['#4352FF','#00a878','#DE1B7C','#FE4537','#8b5cf6','#06b6d4','#f472b6','#d97706'],
  };
  return deepMerge(base, overrides);
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) {
      out[k] = deepMerge(a[k] || {}, b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}

const CONFIG = { displayModeBar: false, responsive: true };

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
const loaded = {};

document.querySelectorAll('.tnav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    switchPage(page);
    // FIX #5 — close mobile nav on page switch
    document.querySelector('.topnav')?.classList.remove('nav-open');
    document.getElementById('hamburger')?.classList.remove('active');
  });
});

function switchPage(page) {
  document.querySelectorAll('.tnav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const navEl = document.querySelector(`.tnav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  activePage = page;
  if (!loaded[page]) { pageLoaders[page]?.(); loaded[page] = true; }
}

let activePage = 'home';

const pageLoaders = {
  home:       loadHome,
  ranking:    loadRankingPage,
  trend:      initTrend,
  university: initUniPage,
  movers:     loadMovers,
  validation: loadValidation,
  predict:    initPredict,
};

// Start on home
pageLoaders.home();
loaded.home = true;

// FIX #5 — HAMBURGER MENU TOGGLE
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.querySelector('.topnav')?.classList.toggle('nav-open');
  document.getElementById('hamburger')?.classList.toggle('active');
});

// Re-render charts when theme changes
const chartRegistry = {}; // id → { traces, layoutOverrides }

function registerChart(id, traces, layoutOverrides) {
  chartRegistry[id] = { traces, layoutOverrides };
}

function rerenderActiveCharts() {
  Object.entries(chartRegistry).forEach(([id, { traces, layoutOverrides }]) => {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) {
      Plotly.react(id, traces, layout(layoutOverrides), CONFIG);
    }
  });
}

function plot(id, traces, layoutOverrides = {}) {
  // Clear any loading spinner before Plotly renders (newPlot appends, not replaces)
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
  registerChart(id, traces, layoutOverrides);
  Plotly.newPlot(id, traces, layout(layoutOverrides), CONFIG);
}

// ═══════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════
async function loadHome() {
  showLoading('chart-spearman');
  const data = await safeApiFetch('/api/summary');
  if (!data) return;

  animateCount('stat-universities', data.total_universities);
  animateCount('stat-countries',    data.total_countries);
  document.getElementById('stat-spearman').textContent = data.avg_spearman;

  const years  = Object.keys(data.spearman_by_year);
  const values = Object.values(data.spearman_by_year);

  const traces = [{
    type: 'bar',
    x: years,
    y: values,
    marker: {
      color: values.map(v => v >= 0.93 ? '#00a878' : v >= 0.85 ? '#1a6ef5' : '#d97706'),
      cornerradius: 5,
    },
    text: values.map(v => v?.toFixed(4) ?? ''),
    textposition: 'outside',
    textfont: { size: 11 },
    hovertemplate: '<b>%{x}</b><br>Spearman r: %{y:.4f}<extra></extra>',
  }];

  plot('chart-spearman', traces, {
    yaxis: { range: [0.78, 1.0], title: { text: 'Spearman r', font: { size: 11 } } },
    xaxis: { title: { text: 'Year', font: { size: 11 } } },
    shapes: [{
      type: 'line', x0: -0.5, x1: years.length - 0.5,
      y0: 0.85, y1: 0.85,
      line: { color: '#d97706', width: 1.5, dash: 'dash' }
    }],
    annotations: [{
      x: years.length - 1, y: 0.858,
      text: 'Strong threshold (0.85)',
      showarrow: false,
      font: { color: '#d97706', size: 10 }
    }],
    margin: { t: 16, r: 20, b: 44, l: 44 },
  });

  // Methodology accordion — click to expand/collapse
  document.querySelectorAll('.ms-item').forEach(item => {
    item.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all first
      document.querySelectorAll('.ms-item').forEach(el => el.classList.remove('open'));
      // Toggle clicked
      if (!isOpen) item.classList.add('open');
    });
  });
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  let cur = 0;
  const step = Math.ceil(target / 40);
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString();
    if (cur >= target) clearInterval(iv);
  }, 30);
}

// ═══════════════════════════════════════════
// RANKING PAGE
// ═══════════════════════════════════════════
let rYear = 2021, rCountry = '', rTopN = 20;

async function loadRankingPage() {
  const cData = await safeApiFetch('/api/countries');
  if (!cData) return;
  const sel   = document.getElementById('country-filter');
  sel.innerHTML = '<option value="">All Countries</option>';
  cData.countries.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });

  document.querySelectorAll('.ytab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ytab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rYear = parseInt(btn.dataset.year);
      loadRankingData();
    });
  });

  document.getElementById('country-filter').addEventListener('change', e => { rCountry = e.target.value; loadRankingData(); });
  document.getElementById('topn-filter').addEventListener('change',   e => { rTopN = parseInt(e.target.value); loadRankingData(); });

  loadRankingData();
}

async function loadRankingData() {
  showLoading('chart-ranking-bar');
  showTableLoading('ranking-tbody');
  const url  = `/api/ranking/${rYear}?top=${rTopN}${rCountry ? '&country=' + encodeURIComponent(rCountry) : ''}`;
  const data = await safeApiFetch(url);
  if (!data) return;
  const rows = data.data;

  // Horizontal bar
  const names  = rows.map(r => r.university.substring(0, 38));
  const scores = rows.map(r => r.closeness);

  const traces = [{
    type: 'bar', orientation: 'h',
    y: [...names].reverse(),
    x: [...scores].reverse(),
    marker: {
      color: [...scores].reverse(),
      colorscale: getTheme() === 'dark'
        ? [[0,'#1a1e2a'],[0.4,'#1a4db5'],[1,'#1a6ef5']]
        : [[0,'#dce8ff'],[0.4,'#5289f0'],[1,'#1a6ef5']],
      showscale: false,
      cornerradius: 4,
    },
    text: [...rows].reverse().map(r => `#${r.mcdm_rank}`),
    textposition: 'outside',
    textfont: { size: 10 },
    hovertemplate: '<b>%{y}</b><br>MCDM Rank: %{text}<br>Score: %{x:.4f}<extra></extra>',
  }];

  plot('chart-ranking-bar', traces, {
    xaxis: { range: [0, 1.1], title: { text: 'TOPSIS Closeness Score', font: { size: 11 } } },
    yaxis: { tickfont: { size: 10 } },
    margin: { t: 10, r: 70, b: 44, l: 260 },
  });

  // Table
  const tbody = document.getElementById('ranking-tbody');
  tbody.innerHTML = rows.map((r, i) => {
    const pillClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    return `<tr>
      <td><span class="rank-pill ${pillClass}">${r.mcdm_rank}</span></td>
      <td style="font-family:var(--ff-mono);color:var(--text3);font-size:12px;">${r.the_rank ?? '—'}</td>
      <td style="color:var(--text);font-weight:500;max-width:220px;white-space:normal;">${r.university}</td>
      <td>${r.country}</td>
      <td style="font-family:var(--ff-mono);color:var(--accent);">${r.closeness}</td>
      <td>${r.teaching ?? '—'}</td>
      <td>${r.research_env ?? '—'}</td>
      <td>${r.research_qual ?? '—'}</td>
      <td>${r.industry ?? '—'}</td>
      <td>${r.intl_outlook ?? '—'}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════
// TREND PAGE
// ═══════════════════════════════════════════
let selectedUnis = [];

async function initTrend() {
  // FIX #4 — populate autocomplete datalist from all universities (year 2021)
  safeApiFetch('/api/universities?year=2021').then(d => {
    if (!d) return;
    const dl = document.getElementById('trend-uni-list');
    if (dl) dl.innerHTML = d.universities.map(u => `<option value="${u}">`).join('');
  });

  document.getElementById('trend-add-btn').addEventListener('click', addTrendUni);
  document.getElementById('trend-search').addEventListener('keydown', e => { if (e.key === 'Enter') addTrendUni(); });
  document.getElementById('trend-clear-btn').addEventListener('click', () => {
    selectedUnis = [];
    renderTags();
    Plotly.purge('chart-trend');
    Plotly.purge('chart-trend-close');
    delete chartRegistry['chart-trend'];
    delete chartRegistry['chart-trend-close'];
  });
  document.getElementById('trend-top5-btn').addEventListener('click', async () => {
    const d = await safeApiFetch('/api/ranking/2021?top=5');
    if (!d) return;
    selectedUnis = d.data.map(r => r.university);
    renderTags();
    loadTrendCharts();
  });
}

function addTrendUni() {
  const val = document.getElementById('trend-search').value.trim();
  if (val && !selectedUnis.find(u => u.toLowerCase() === val.toLowerCase())) {
    selectedUnis.push(val);
    renderTags();
    loadTrendCharts();
  }
  document.getElementById('trend-search').value = '';
}

function renderTags() {
  const c = document.getElementById('trend-tags');
  c.innerHTML = selectedUnis.map(u => `
    <div class="tag">
      <span>${u.substring(0, 32)}</span>
      <span class="tag-x" data-uni="${u}">×</span>
    </div>`).join('');
  c.querySelectorAll('.tag-x').forEach(x => {
    x.addEventListener('click', () => {
      selectedUnis = selectedUnis.filter(u => u !== x.dataset.uni);
      renderTags();
      if (selectedUnis.length > 0) loadTrendCharts();
      else {
        Plotly.purge('chart-trend');
        Plotly.purge('chart-trend-close');
      }
    });
  });
}

async function loadTrendCharts() {
  if (!selectedUnis.length) return;
  showLoading('chart-trend');
  showLoading('chart-trend-close');
  const params = selectedUnis.map(u => `universities=${encodeURIComponent(u)}`).join('&');
  const data   = await safeApiFetch('/api/trend?' + params);
  if (!data) return;

  const rankTraces = [], closeTraces = [];

  Object.entries(data.trends).forEach(([uni, trend]) => {
    const x = trend.map(t => t.year);
    rankTraces.push({
      type: 'scatter', mode: 'lines+markers',
      name: uni.substring(0, 30),
      x, y: trend.map(t => t.mcdm_rank),
      line: { width: 2.5 }, marker: { size: 8 },
      hovertemplate: `<b>${uni.substring(0,30)}</b><br>Year: %{x}<br>Rank: #%{y}<extra></extra>`,
    });
    closeTraces.push({
      type: 'scatter', mode: 'lines+markers',
      name: uni.substring(0, 30),
      x, y: trend.map(t => t.closeness),
      line: { width: 2.5 }, marker: { size: 8 },
      hovertemplate: `<b>${uni.substring(0,30)}</b><br>Year: %{x}<br>Score: %{y:.4f}<extra></extra>`,
    });
  });

  plot('chart-trend', rankTraces, {
    yaxis: { autorange: 'reversed', title: { text: 'MCDM Rank (lower = better)', font: { size: 11 } } },
    xaxis: { dtick: 1, title: { text: 'Year', font: { size: 11 } } },
  });

  plot('chart-trend-close', closeTraces, {
    yaxis: { title: { text: 'Closeness Score', font: { size: 11 } } },
    xaxis: { dtick: 1, title: { text: 'Year', font: { size: 11 } } },
  });
}

// ═══════════════════════════════════════════
// UNIVERSITY PAGE
// ═══════════════════════════════════════════
function initUniPage() {
  let allUniversities = [];
  let kbdIdx = -1;

  // Load ALL universities — try /all endpoint first, fall back to per-year
  async function loadAllUniversities() {
    const d = await safeApiFetch('/api/universities/all');
    if (d && d.universities && d.universities.length) {
      allUniversities = d.universities;
      return;
    }
    // Fallback: fetch each year and merge
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    const sets  = await Promise.all(years.map(y => safeApiFetch(`/api/universities?year=${y}`)));
    const merged = new Set();
    sets.forEach(s => s?.universities?.forEach(u => merged.add(u)));
    allUniversities = [...merged].sort();
  }
  loadAllUniversities();

  const input    = document.getElementById('uni-search');
  const dropdown = document.getElementById('uni-autocomplete');

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.substring(0, idx))
         + '<mark>' + escapeHtml(text.substring(idx, idx + query.length)) + '</mark>'
         + escapeHtml(text.substring(idx + query.length));
  }

  function openDropdown(query) {
    const q = query.trim();
    if (!q) { closeDropdown(); return; }

    // Filter: match anywhere in name (case-insensitive)
    const matches = allUniversities
      .filter(u => u.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 30); // max 30 suggestions

    if (!matches.length) {
      dropdown.innerHTML = `<div class="autocomplete-empty">No match found for "<b>${escapeHtml(q)}</b>"</div>`;
      dropdown.classList.add('open');
      return;
    }

    const total = allUniversities.filter(u => u.toLowerCase().includes(q.toLowerCase())).length;
    const badge = total > 30
      ? `<div class="ac-count-badge"><span>Showing 30 of ${total} matches</span><span>↑↓ to navigate</span></div>`
      : `<div class="ac-count-badge"><span>${total} match${total>1?'es':''}</span><span>↑↓ to navigate</span></div>`;

    dropdown.innerHTML = badge + matches.map((u, i) =>
      `<div class="autocomplete-item" data-name="${escapeHtml(u)}" data-i="${i}">
         <span class="ac-icon">🎓</span>
         <span>${highlight(u, q)}</span>
       </div>`
    ).join('');

    dropdown.classList.add('open');
    kbdIdx = -1;

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.name;
        closeDropdown();
        loadUniProfile(item.dataset.name);
      });
    });
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    kbdIdx = -1;
  }

  function moveKbd(dir) {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (!items.length) return;
    items[kbdIdx]?.classList.remove('kbd-active');
    kbdIdx = Math.max(0, Math.min(kbdIdx + dir, items.length - 1));
    items[kbdIdx].classList.add('kbd-active');
    items[kbdIdx].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => openDropdown(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveKbd(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveKbd(-1); }
    else if (e.key === 'Escape') closeDropdown();
    else if (e.key === 'Enter') {
      const active = dropdown.querySelector('.autocomplete-item.kbd-active');
      if (active) {
        input.value = active.dataset.name;
        closeDropdown();
        loadUniProfile(active.dataset.name);
      } else {
        const n = input.value.trim();
        if (n) { closeDropdown(); loadUniProfile(n); }
      }
    }
  });

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.autocomplete-wrap') && !e.target.closest('#uni-search-btn')) {
      closeDropdown();
    }
  });

  document.getElementById('uni-search-btn').addEventListener('click', () => {
    const n = input.value.trim();
    if (n) { closeDropdown(); loadUniProfile(n); }
  });

  document.getElementById('uni-radar-year').addEventListener('change', e => {
    if (window._uniData) renderUniRadar(window._uniData, parseInt(e.target.value));
  });
}

async function loadUniProfile(name) {
  // FIX: show profile skeleton first, then load
  const data = await safeApiFetch('/api/university/' + encodeURIComponent(name));
  if (!data) { showToast('University not found — check spelling.', 'error'); return; }
  window._uniData = data;

  document.getElementById('uni-name-display').textContent    = data.university;
  document.getElementById('uni-country-display').textContent = data.country;
  document.getElementById('uni-monogram').textContent        = data.university.charAt(0).toUpperCase();

  // Make profile visible FIRST so chart divs have real dimensions
  document.getElementById('uni-profile').classList.remove('hidden');

  // Now show loading spinners (divs are visible and measurable)
  showLoading('chart-uni-rank');
  showLoading('chart-uni-radar');
  showLoading('chart-uni-criteria');

  // Year detail panel — wrapped in try/catch so errors don't block charts
  try {
    const yearPanel = document.getElementById('uni-year-detail-panel');
    const yearTabs  = document.getElementById('uni-year-tabs');
    yearPanel.classList.remove('hidden');

    yearTabs.innerHTML = data.data.map(d =>
      `<button class="ytab" data-year="${d.year}">${d.year}</button>`
    ).join('');

    const defaultYear = data.data[data.data.length - 1]?.year;
    yearTabs.querySelector(`[data-year="${defaultYear}"]`)?.classList.add('active');
    renderYearDetail(data, defaultYear);

    yearTabs.querySelectorAll('.ytab').forEach(btn => {
      btn.addEventListener('click', () => {
        yearTabs.querySelectorAll('.ytab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderYearDetail(data, parseInt(btn.dataset.year));
      });
    });
  } catch (e) {
    console.warn('Year detail panel error:', e);
  }

  const bestRank   = Math.min(...data.data.map(d => d.mcdm_rank).filter(Boolean));
  const latestRank = data.data[data.data.length - 1]?.mcdm_rank ?? '—';
  document.getElementById('uni-badges').innerHTML = `
    <div class="ubadge"><span class="ubv">#${bestRank}</span><span class="ubl">Best Rank</span></div>
    <div class="ubadge"><span class="ubv">#${latestRank}</span><span class="ubl">2026 Rank</span></div>
    <div class="ubadge"><span class="ubv">${data.country}</span><span class="ubl">Country</span></div>`;

  // Rank trend
  plot('chart-uni-rank', [
    { type:'scatter', mode:'lines+markers', name:'MCDM Rank',
      x: data.data.map(d=>d.year), y: data.data.map(d=>d.mcdm_rank),
      line:{color:'#1a6ef5',width:2.5}, marker:{size:9,color:'#1a6ef5'},
      hovertemplate:'<b>MCDM</b> Year %{x}: #%{y}<extra></extra>' },
    { type:'scatter', mode:'lines+markers', name:'THE Rank',
      x: data.data.map(d=>d.year), y: data.data.map(d=>d.the_rank),
      line:{color:'#d97706',width:2,dash:'dot'}, marker:{size:7,color:'#d97706'},
      hovertemplate:'<b>THE</b> Year %{x}: #%{y}<extra></extra>' },
  ], {
    yaxis: { autorange:'reversed', title:{text:'Rank',font:{size:11}} },
    xaxis: { dtick:1 },
  });

  // Radar year select
  const rsel = document.getElementById('uni-radar-year');
  rsel.innerHTML = data.data.map(d=>`<option value="${d.year}">${d.year}</option>`).join('');
  const latestYear = data.data[data.data.length-1]?.year;
  if (latestYear) rsel.value = latestYear;
  renderUniRadar(data, parseInt(rsel.value));

  // Criteria over years
  const CKEYS  = ['teaching','research_env','research_qual','industry','intl_outlook'];
  const CLABS  = ['Teaching','Research Env','Research Qual','Industry','Intl Outlook'];
  plot('chart-uni-criteria', CKEYS.map((k,i) => ({
    type:'scatter', mode:'lines+markers', name:CLABS[i],
    x: data.data.map(d=>d.year), y: data.data.map(d=>d[k]),
    line:{width:2}, marker:{size:7},
    hovertemplate:`<b>${CLABS[i]}</b> %{x}: %{y:.1f}<extra></extra>`,
  })), {
    yaxis: { range:[0,105], title:{text:'Score',font:{size:11}} },
    xaxis: { dtick:1 },
  });
}

function renderYearDetail(uniData, year) {
  const yd   = uniData.data.find(d => d.year === year);
  const prev = uniData.data.find(d => d.year === year - 1);
  if (!yd) return;

  const CRITERIA = [
    { key: 'teaching',      label: 'Teaching' },
    { key: 'research_env',  label: 'Research Environment' },
    { key: 'research_qual', label: 'Research Quality' },
    { key: 'industry',      label: 'Industry Impact' },
    { key: 'intl_outlook',  label: 'International Outlook' },
  ];

  // Rank change vs previous year
  let deltaHtml = '';
  if (prev && yd.mcdm_rank && prev.mcdm_rank) {
    const d = prev.mcdm_rank - yd.mcdm_rank; // positive = improved
    if (d > 0)      deltaHtml = `<span class="rank-delta up">▲ +${d} vs ${year-1}</span>`;
    else if (d < 0) deltaHtml = `<span class="rank-delta down">▼ ${d} vs ${year-1}</span>`;
    else            deltaHtml = `<span class="rank-delta same">— no change vs ${year-1}</span>`;
  }

  document.getElementById('uni-year-card').innerHTML = `
    <div class="yd-stats">
      <div class="yd-stat highlight">
        <span class="yd-label">MCDM Rank · ${year}</span>
        <span class="yd-val accent">#${yd.mcdm_rank ?? '—'}</span>
        ${deltaHtml}
      </div>
      <div class="yd-stat">
        <span class="yd-label">THE Official Rank</span>
        <span class="yd-val">${yd.the_rank ? '#'+yd.the_rank : '—'}</span>
        <span class="yd-sub">Times Higher Education</span>
      </div>
      <div class="yd-stat">
        <span class="yd-label">Closeness Score</span>
        <span class="yd-val">${yd.closeness ?? '—'}</span>
        <span class="yd-sub">TOPSIS closeness to ideal</span>
      </div>
    </div>
    <div class="yd-bars">
      ${CRITERIA.map(c => {
        const val = yd[c.key] ?? 0;
        return `<div class="ydb-row">
          <span class="ydb-name">${c.label}</span>
          <div class="ydb-track"><div class="ydb-fill" style="width:0%" data-target="${val}"></div></div>
          <span class="ydb-val">${val || '—'}</span>
        </div>`;
      }).join('')}
    </div>`;

  // Animate bars after render (RAF ensures DOM is ready)
  requestAnimationFrame(() => {
    document.querySelectorAll('.ydb-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  });
}

function renderUniRadar(data, year) {
  const yd = data.data.find(d => d.year === year);
  if (!yd) return;
  const CKEYS = ['teaching','research_env','research_qual','industry','intl_outlook'];
  const CLABS = ['Teaching','Research Env','Research Qual','Industry','Intl Outlook'];
  const vals  = [...CKEYS.map(k => yd[k] ?? 0), yd[CKEYS[0]] ?? 0];

  plot('chart-uni-radar', [{
    type:'scatterpolar', fill:'toself',
    r: vals, theta:[...CLABS, CLABS[0]],
    line:{color:'#1a6ef5',width:2},
    fillcolor:'rgba(26,110,245,0.12)',
    hovertemplate:'<b>%{theta}</b>: %{r:.1f}<extra></extra>',
  }], {
    polar:{
      bgcolor:'transparent',
      radialaxis:{visible:true,range:[0,100],gridcolor: getTheme()==='dark'?'#1e2230':'#e6e9f4',tickfont:{size:9}},
      angularaxis:{gridcolor: getTheme()==='dark'?'#1e2230':'#e6e9f4',tickfont:{size:10}},
    },
    margin:{t:20,r:40,b:20,l:40},
  });
}

// ═══════════════════════════════════════════
// MOVERS
// ═══════════════════════════════════════════
async function loadMovers() {
  showLoading('chart-risers');
  showLoading('chart-fallers');
  showTableLoading('movers-tbody');
  const data = await safeApiFetch('/api/movers');
  if (!data) return;

  const makeBar = (arr, color, id) => {
    plot(id, [{
      type:'bar', orientation:'h',
      y: arr.map(r=>r.university.substring(0,32)).reverse(),
      x: arr.map(r=>Math.abs(r.change)).reverse(),
      marker:{ color, cornerradius:4 },
      text: arr.map(r=>(r.change>0?'+':'')+r.change).reverse(),
      textposition:'outside', textfont:{size:10},
      hovertemplate:'<b>%{y}</b><br>Change: %{text} positions<extra></extra>',
    }], {
      xaxis:{title:{text:'Positions Changed',font:{size:11}}},
      yaxis:{tickfont:{size:10}},
      margin:{t:8,r:60,b:44,l:220},
    });
  };

  makeBar(data.risers,  '#00a878', 'chart-risers');
  makeBar(data.fallers, '#e03e3e', 'chart-fallers');

  const all = [...data.risers,...data.fallers].sort((a,b)=>b.change-a.change);
  document.getElementById('movers-tbody').innerHTML = all.map(r => `
    <tr>
      <td style="color:var(--text);font-weight:500;max-width:220px;white-space:normal;">${r.university}</td>
      <td>${r.country}</td>
      <td style="font-family:var(--ff-mono);">${r.rank_2021}</td>
      <td style="font-family:var(--ff-mono);">${r.rank_2026}</td>
      <td class="${r.change>0?'change-pos':'change-neg'}">${r.change>0?'▲ +':'▼ '}${r.change}</td>
    </tr>`).join('');
}

// ═══════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════
async function loadValidation() {
  showLoading('chart-validation');
  showTableLoading('validation-tbody');
  const data = await safeApiFetch('/api/validation');
  if (!data) return;
  const rows = data.validation;

  plot('chart-validation', [
    { type:'scatter', mode:'lines+markers',
      name:'Spearman r',
      x: rows.map(r=>r.year), y: rows.map(r=>r.spearman_r),
      line:{color:'#1a6ef5',width:3},
      marker:{size:11,color:'#1a6ef5',symbol:'circle',line:{color:'#fff',width:2}},
      fill:'tozeroy', fillcolor:'rgba(26,110,245,0.05)',
      hovertemplate:'<b>%{x}</b><br>Spearman r: %{y:.4f}<extra></extra>',
    }
  ], {
    yaxis: { range:[0.78,1.0], title:{text:'Spearman r',font:{size:11}} },
    xaxis: { dtick:1, title:{text:'Year',font:{size:11}} },
    shapes:[{ type:'line', x0:2020.5, x1:2026.5, y0:0.85, y1:0.85,
              line:{color:'#d97706',width:1.5,dash:'dash'} }],
    annotations:[{ x:2026, y:0.858, text:'0.85 threshold', showarrow:false,
                   font:{color:'#d97706',size:10} }],
  });

  document.getElementById('validation-tbody').innerHTML = rows.map(r => {
    const s = r.spearman_r >= 0.93 ? '<span style="color:var(--green)">● Very Strong</span>'
            : r.spearman_r >= 0.85 ? '<span style="color:var(--accent)">● Strong</span>'
            :                        '<span style="color:var(--amber)">● Moderate</span>';
    return `<tr>
      <td style="font-family:var(--ff-mono);color:var(--accent);">${r.year}</td>
      <td style="font-family:var(--ff-mono);color:var(--green);font-weight:600;">${r.spearman_r}</td>
      <td style="font-family:var(--ff-mono);color:var(--text3);font-size:12px;">${r.p_value}</td>
      <td>${r.n.toLocaleString()}</td>
      <td>${s}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════
// PREDICT
// ═══════════════════════════════════════════
function initPredict() {
  document.querySelectorAll('.pslider').forEach(s => {
    s.addEventListener('input', () => {
      document.getElementById('val-' + s.dataset.key).textContent = s.value;
    });
  });
  document.getElementById('predict-btn').addEventListener('click', runPredict);
}

async function runPredict() {
  const year   = parseInt(document.getElementById('predict-year').value);
  const scores = {};
  document.querySelectorAll('.pslider').forEach(s => { scores[s.dataset.key] = parseInt(s.value); });

  const btn = document.getElementById('predict-btn');
  btn.querySelector('span:first-child').textContent = 'Calculating…';
  btn.disabled = true;

  const data = await safeApiFetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, ...scores }),
  });

  btn.querySelector('span:first-child').textContent = 'Calculate My Rank';
  btn.disabled = false;
  if (!data) return;

  document.getElementById('predict-placeholder').classList.add('hidden');
  document.getElementById('predict-result').classList.remove('hidden');

  document.getElementById('res-rank').textContent  = '#' + data.mcdm_rank;
  document.getElementById('res-total').textContent = `out of ${data.total.toLocaleString()} universities`;
  document.getElementById('res-close').textContent = data.closeness;
  // FIX #10 — clearer percentile display (higher percentile = better rank)
  document.getElementById('res-pct').textContent   = data.percentile.toFixed(1) + '%';
  document.getElementById('res-pct2').textContent  = 'Top ' + (100 - data.percentile).toFixed(1) + '%';
  // Update chip label to clarify meaning
  document.querySelector('[for="res-pct"] .rc-label, .rchip .rc-label')?.textContent;
  document.querySelectorAll('.rc-label')[0].textContent = 'Percentile Score';
  document.querySelectorAll('.rc-label')[1].textContent = 'Better Than';

  // Animate bar
  setTimeout(() => {
    document.getElementById('res-bar').style.width = data.percentile + '%';
  }, 100);

  // Nearest
  document.getElementById('res-nearest').innerHTML = data.nearest.map(n => `
    <div class="nearest-item">
      <span class="ni-name">${n.university.substring(0,40)}</span>
      <span class="ni-rank">#${n.mcdm_rank}</span>
    </div>`).join('');

  // Radar
  const CKEYS = ['teaching','research_env','research_qual','industry','intl_outlook'];
  const CLABS = ['Teaching','Research Env','Research Qual','Industry','Intl Outlook'];
  const vals  = [...CKEYS.map(k => data.scores[k]), data.scores[CKEYS[0]]];

  plot('chart-predict-radar', [{
    type:'scatterpolar', fill:'toself',
    r: vals, theta:[...CLABS, CLABS[0]],
    line:{color:'#00a878',width:2},
    fillcolor:'rgba(0,168,120,0.12)',
    name:'Your Scores',
    hovertemplate:'<b>%{theta}</b>: %{r}<extra></extra>',
  }], {
    polar:{
      bgcolor:'transparent',
      radialaxis:{visible:true,range:[0,100],gridcolor: getTheme()==='dark'?'#1e2230':'#e6e9f4',tickfont:{size:9}},
      angularaxis:{gridcolor: getTheme()==='dark'?'#1e2230':'#e6e9f4',tickfont:{size:10}},
    },
    margin:{t:10,r:40,b:10,l:40},
  });
}