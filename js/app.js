/**
 * philosoFIFA — app.js
 * Single-page app: roster table, player detail, Leaflet map
 */

/* ── Config ─────────────────────────────────────────────────── */
const STATS  = ['PAC','SHO','PAS','DRI','DEF','PHY'];
const SLBLS  = ['Pace','Shooting','Passing','Dribbling','Defence','Physical'];
const DATA   = 'data/players.json';

let PLAYERS  = [];
let sorted   = [];
let current  = null;
let leafMap     = null;
let leafMarkers = [];
let spotIndex   = 0;
let currentSpots = [];

/* ── Bootstrap ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(DATA);
    PLAYERS   = await res.json();
    sorted    = [...PLAYERS].sort((a,b) => b.ovr - a.ovr);
    renderTable(sorted);
  } catch(e) {
    console.error('Could not load players.json', e);
    document.getElementById('roster-tbody').innerHTML =
      `<tr><td colspan="13" style="padding:2rem;text-align:center;font-family:var(--mono);font-size:12px;color:var(--faint);">
        Could not load player data. Make sure you are running a local server (not file://).
      </td></tr>`;
  }

  // Nav
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page, btn));
  });

  // Search
  document.getElementById('search').addEventListener('input', filterTable);
});

/* ── Navigation ─────────────────────────────────────────────── */
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if(btn) btn.classList.add('active');

  // Close detail when going back to roster
  if(id === 'roster') closeDetail();
}

/* ── Table ──────────────────────────────────────────────────── */
function renderTable(list) {
  const tbody = document.getElementById('roster-tbody');
  tbody.innerHTML = list.map((p, i) => `
    <tr onclick="openPlayer('${p.id}')">
      <td class="td-flag">${p.flag}</td>
      <td class="td-name">
        <span class="first">${p.firstName}</span>
        <span class="last">${p.lastName}</span>
      </td>
      <td class="td-years">${p.years}</td>
      <td class="td-disc">${p.discipline}</td>
      <td class="td-pos"><span class="pos-pill">${p.pos}</span></td>
      <td class="td-ovr">${p.ovr}</td>
      ${STATS.map(s => `<td class="td-stat">${p.stats[s]}</td>`).join('')}
      <td class="td-arrow">→</td>
    </tr>
  `).join('');
}

function filterTable() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const f = q
    ? sorted.filter(p =>
        `${p.firstName} ${p.lastName} ${p.nationality} ${p.pos}
         ${p.discipline} ${p.posFull} ${p.club}`.toLowerCase().includes(q)
      )
    : sorted;
  renderTable(f);
}

/* ── Player detail ──────────────────────────────────────────── */
function openPlayer(id) {
  const p = PLAYERS.find(x => x.id === id);
  if(!p) return;
  current = id;

  // Fill card
  document.getElementById('d-ovr').textContent   = p.ovr;
  document.getElementById('d-pos').textContent   = p.pos;
  document.getElementById('d-flag').textContent  = p.flag;
  document.getElementById('d-first').textContent = p.firstName;
  document.getElementById('d-last').textContent  = p.lastName;
  document.getElementById('d-club').textContent  = `${p.nationality} · ${p.club || ''}`.trim().replace(/\s·\s$/, '');

  // Image
  const imgEl = document.getElementById('d-image');
  imgEl.innerHTML = p.image
    ? `<img src="${p.image}" alt="${p.firstName} ${p.lastName}">`
    : `<div class="card-image-placeholder">
        <svg width="44" height="60" viewBox="0 0 60 80" fill="none">
          <circle cx="30" cy="18" r="13" fill="currentColor"/>
          <path d="M6 72c0-13.255 10.745-24 24-24s24 10.745 24 24" fill="currentColor"/>
        </svg>
      </div>`;

  // Mini stats
  document.getElementById('d-mini-stats').innerHTML =
    STATS.map(s => `
      <div class="card-stat">
        <span class="lbl">${s}</span>
        <span class="val">${p.stats[s]}</span>
      </div>
    `).join('');

  // Editorial text
  document.getElementById('d-kicker').textContent    = `${p.discipline} · ${p.era}`;
  document.getElementById('d-name-first').textContent = p.firstName;
  document.getElementById('d-name-last').textContent  = p.lastName;
  document.getElementById('d-tagline').textContent   = p.tagline;
  document.getElementById('d-pos-full').textContent  = p.posFull;
  document.getElementById('d-nat').textContent       = p.nationality;
  document.getElementById('d-era').textContent       = p.era;
  document.getElementById('d-disc').textContent      = p.discipline;
  document.getElementById('d-desc').textContent      = p.description;
  document.getElementById('d-quote').textContent     = p.quote;
  document.getElementById('d-cite').textContent      = `${p.firstName} ${p.lastName}`;

  // Stat bars
  const barsEl = document.getElementById('d-bars');
  barsEl.innerHTML = STATS.map((s, i) => `
    <div class="stat-row">
      <span class="stat-lbl">${SLBLS[i]}</span>
      <span class="stat-val">${p.stats[s]}</span>
      <div class="stat-track">
        <div class="stat-fill" data-w="${p.stats[s]}" style="width:0%"></div>
      </div>
    </div>
  `).join('');

  // Animate bars
  requestAnimationFrame(() => requestAnimationFrame(() => {
    barsEl.querySelectorAll('.stat-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }));

  // Download button
  const dlBtn = document.getElementById('d-download');
  if(p.pdf) {
    dlBtn.disabled = false;
    dlBtn.onclick  = () => window.open(p.pdf, '_blank');
  } else {
    dlBtn.disabled = true;
    dlBtn.onclick  = null;
  }

  // Spots widget
  initSpotsWidget(p.spots);

  // Prev / next
  const idx = sorted.findIndex(x => x.id === id);
  const prev = sorted[idx - 1];
  const next = sorted[idx + 1];

  const prevBtn = document.getElementById('d-prev');
  const nextBtn = document.getElementById('d-next');

  prevBtn.style.visibility = prev ? 'visible' : 'hidden';
  nextBtn.style.visibility = next ? 'visible' : 'hidden';
  if(prev) document.getElementById('d-prev-name').textContent = `${prev.firstName} ${prev.lastName}`;
  if(next) document.getElementById('d-next-name').textContent = `${next.firstName} ${next.lastName}`;

  prevBtn.onclick = () => openPlayer(prev.id);
  nextBtn.onclick = () => openPlayer(next.id);

  // Show detail
  document.getElementById('detail-wrap').style.display  = 'block';
  document.getElementById('roster-list').style.display  = 'none';
}

function closeDetail() {
  document.getElementById('detail-wrap').style.display = 'none';
  document.getElementById('roster-list').style.display  = 'block';

  // Destroy Leaflet map
  if (leafMap) { leafMap.off(); leafMap.remove(); leafMap = null; }
  leafMarkers = [];
}

/* ── Spots: slider + Leaflet map ─────────────────────────────── */

const pinIcon = () => L.divIcon({
  className: '',
  html: `<svg width="22" height="30" viewBox="0 0 22 30" fill="none">
    <circle cx="11" cy="11" r="10" fill="#3B6D11" stroke="white" stroke-width="2"/>
    <circle cx="11" cy="11" r="4"  fill="white"/>
    <line x1="11" y1="21" x2="11" y2="29" stroke="#3B6D11" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  iconSize:    [22, 30],
  iconAnchor:  [11, 30],
  popupAnchor: [0, -32],
});

const pinIconActive = () => L.divIcon({
  className: '',
  html: `<svg width="26" height="36" viewBox="0 0 26 36" fill="none">
    <circle cx="13" cy="13" r="12" fill="#3B6D11" stroke="white" stroke-width="2.5"/>
    <circle cx="13" cy="13" r="5"  fill="white"/>
    <line x1="13" y1="25" x2="13" y2="35" stroke="#3B6D11" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  iconSize:    [26, 36],
  iconAnchor:  [13, 36],
  popupAnchor: [0, -38],
});

function initSpotsWidget(spots) {
  currentSpots = spots || [];
  spotIndex    = 0;

  // ── Destroy previous Leaflet instance cleanly ──────────────
  if (leafMap) {
    leafMap.off();
    leafMap.remove();
    leafMap = null;
  }
  leafMarkers = [];

  // ── Build slides ───────────────────────────────────────────
  const slider = document.getElementById('spots-slider');
  const nav    = slider.querySelector('.spots-nav');

  // Remove old slides (keep nav)
  Array.from(slider.children).forEach(el => {
    if (!el.classList.contains('spots-nav')) el.remove();
  });

  if (currentSpots.length === 0) {
    slider.insertAdjacentHTML('afterbegin',
      `<div class="no-spots">No interventions logged yet.</div>`);
    document.getElementById('spots-dots').innerHTML = '';
    document.getElementById('spots-counter').textContent = '—';
    initLeaflet([]);
    return;
  }

  currentSpots.forEach((sp, i) => {
    const imgEl = sp.photo
      ? `<img class="spot-photo" src="${sp.photo}" alt="${sp.label}">`
      : `<div class="spot-photo-placeholder">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M3 16l5-4 4 3 3-2.5 6 4" stroke="currentColor" stroke-width="1.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-family:var(--mono);font-size:9px;letter-spacing:0.08em;
                       color:var(--muted);text-transform:uppercase;">Photo coming soon</span>
        </div>`;

    const slide = document.createElement('div');
    slide.className = 'spot-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `
      ${imgEl}
      <div class="spot-meta">
        <span class="spot-meta-label">${sp.label}</span>
        <span class="spot-meta-note">${sp.note}</span>
      </div>`;
    slider.insertBefore(slide, nav);
  });

  // ── Dots ───────────────────────────────────────────────────
  const dotsEl = document.getElementById('spots-dots');
  dotsEl.innerHTML = currentSpots.map((_, i) =>
    `<button class="spot-dot${i === 0 ? ' active' : ''}" onclick="goToSpot(${i})"></button>`
  ).join('');

  updateCounter();
  updateNavBtns();

  // ── Leaflet ────────────────────────────────────────────────
  initLeaflet(currentSpots);
}

function initLeaflet(spots) {
  const mapEl = document.getElementById('player-map');
  if (!mapEl) return;

  // Re-init
  leafMap = L.map(mapEl, {
    zoomControl:      true,
    scrollWheelZoom:  false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  }).addTo(leafMap);

  if (spots.length === 0) {
    leafMap.setView([40.416, -3.703], 13);
    return;
  }

  // Add markers
  leafMarkers = spots.map((sp, i) => {
    const m = L.marker([sp.lat, sp.lng], { icon: i === 0 ? pinIconActive() : pinIcon() })
      .addTo(leafMap)
      .bindPopup(`<strong>${sp.label}</strong><br>${sp.note}`)
      .on('click', () => goToSpot(i));
    return m;
  });

  // Always start at first spot
  leafMap.setView([spots[0].lat, spots[0].lng], 15);

  // Fix Leaflet rendering glitch when container was hidden
  setTimeout(() => leafMap.invalidateSize(), 50);
}

function goToSpot(i) {
  if (!currentSpots.length) return;
  const prev = spotIndex;
  spotIndex  = i;

  // Slides
  const slides = document.querySelectorAll('.spot-slide');
  slides.forEach((s, idx) => s.classList.toggle('active', idx === i));

  // Dots
  const dots = document.querySelectorAll('.spot-dot');
  dots.forEach((d, idx) => d.classList.toggle('active', idx === i));

  // Marker icons
  leafMarkers.forEach((m, idx) => m.setIcon(idx === i ? pinIconActive() : pinIcon()));

  // Fly map to spot
  if (leafMap && currentSpots[i]) {
    leafMap.flyTo([currentSpots[i].lat, currentSpots[i].lng], 15, { duration: 0.8 });
    setTimeout(() => leafMarkers[i]?.openPopup(), 900);
  }

  updateCounter();
  updateNavBtns();
}

function slideSpot(dir) {
  const next = spotIndex + dir;
  if (next >= 0 && next < currentSpots.length) goToSpot(next);
}

function updateCounter() {
  const el = document.getElementById('spots-counter');
  if (el) el.textContent = `${spotIndex + 1} / ${currentSpots.length}`;
}

function updateNavBtns() {
  const prev = document.getElementById('spots-prev');
  const next = document.getElementById('spots-next');
  if (prev) prev.disabled = spotIndex === 0;
  if (next) next.disabled = spotIndex === currentSpots.length - 1;
}
