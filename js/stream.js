// Stream: synchronized across all viewers via time-seeded PRNG.
// Event density fluctuates in burst/quiet cycles — 2-3 dense bursts per period
// separated by sparse quiet stretches, giving 0-1 objects in quiet and 3-5 in bursts.

const MIN_DURATION_MS = 6000;
const MAX_DURATION_MS = 42000;

let streamEl       = null;
let activeTimers   = [];
let recentList     = [];
let minObjInterval = null;

// --- Admin settings (stored by admin.html) ---

function getAdminSettings() {
  try { return JSON.parse(localStorage.getItem('ggb_admin_settings') || '{}'); } catch { return {}; }
}

// Returns the effective max objects allowed on screen right now.
// When crowd mode is on, scales with the live viewer count (from presence.js).
// Falls back to the manual override, or null (unlimited) if neither is set.
function getEffectiveMaxObjects() {
  const s = getAdminSettings();

  if (s.crowdMode) {
    const viewers = Math.max(window.currentViewerCount || 1, 1);
    const cap     = s.crowdCap ?? 8;
    // ~1 extra object per 3 viewers; solo feels calm, large groups feel busy
    return Math.min(Math.ceil(viewers * 0.33 + 1.5), cap);
  }

  return s.maxObjects ?? null; // null = no cap
}

// --- Edge coordinate helpers ---

function edgePoint(edge, pos, w, h) {
  const p = 0.06 + pos * 0.88;
  switch (edge) {
    case 0: return { x: p * w, y: -110 };
    case 1: return { x: w + 110, y: p * h };
    case 2: return { x: p * w, y: h + 110 };
    case 3: return { x: -110, y: p * h };
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// --- Erratic path generation ---

function generateWaypoints(start, end, pathSeed, screenW, screenH) {
  const rand   = mulberry32(pathSeed >>> 0);
  const numVia = 2 + Math.floor(rand() * 3);
  const dx = end.x - start.x, dy = end.y - start.y;
  const len    = Math.hypot(dx, dy) || 1;
  const perpX  = -dy / len, perpY = dx / len;
  const maxDev = Math.min(screenW, screenH) * 0.38;

  const pts = [start];
  for (let i = 1; i <= numVia; i++) {
    const t   = i / (numVia + 1);
    const dev = (rand() - 0.5) * 2 * maxDev;
    const wob = (rand() - 0.5) * maxDev * 0.3;
    pts.push({
      x: start.x + dx * t + perpX * dev + perpY * wob,
      y: start.y + dy * t + perpY * dev - perpX * wob,
    });
  }
  pts.push(end);
  return pts;
}

function pathPosition(pts, progress) {
  if (progress <= 0) return pts[0];
  if (progress >= 1) return pts[pts.length - 1];
  const segLen = 1 / (pts.length - 1);
  const seg    = Math.min(Math.floor(progress / segLen), pts.length - 2);
  const t      = (progress - seg * segLen) / segLen;
  return { x: lerp(pts[seg].x, pts[seg+1].x, t), y: lerp(pts[seg].y, pts[seg+1].y, t) };
}

// --- Event generation: burst / quiet density model ---

function buildEvent(t, rand) {
  const itemIndex = Math.floor(rand() * ITEMS.length);
  const startEdge = Math.floor(rand() * 4);
  const endEdge   = (startEdge + 1 + Math.floor(rand() * 3)) % 4;
  const startPos  = rand();
  const endPos    = rand();
  const duration  = MIN_DURATION_MS + rand() * (MAX_DURATION_MS - MIN_DURATION_MS);
  const pathSeed  = Math.floor(rand() * 0xFFFFFF);
  return { t, itemIndex, startEdge, endEdge, startPos, endPos, duration, pathSeed };
}

function generateEvents(periodIndex) {
  const rand   = mulberry32(periodIndex);
  const events = [];

  // 2-3 burst clusters per period — each a dense pack of events in a short window
  const numBursts = 2 + Math.floor(rand() * 2);
  for (let b = 0; b < numBursts; b++) {
    const center     = rand() * PERIOD_MS;
    const burstCount = 8 + Math.floor(rand() * 6);          // 8-13 events per burst
    const halfWidth  = 20000 + rand() * 25000;               // ±20-45 s from centre

    for (let i = 0; i < burstCount; i++) {
      // Bell-shaped distribution: average 3 uniform samples for a natural cluster
      const offset = (rand() + rand() + rand() - 1.5) * halfWidth;
      const t      = center + offset;
      if (t >= 0 && t < PERIOD_MS) events.push(buildEvent(t, rand));
    }
  }

  // Sparse background events in the quiet stretches
  const bgCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < bgCount; i++) {
    events.push(buildEvent(rand() * PERIOD_MS, rand));
  }

  return events.sort((a, b) => a.t - b.t);
}

// --- Object spawning ---

function spawnObject(event, startProgress = 0) {
  // Respect effective max (crowd mode or manual override)
  const maxObjects = getEffectiveMaxObjects();
  if (maxObjects != null && streamEl.querySelectorAll('.stream-object').length >= maxObjects) return;

  const item = ITEMS[event.itemIndex];
  if (!item) return;

  const w = streamEl.clientWidth;
  const h = streamEl.clientHeight;

  const startFull = edgePoint(event.startEdge, event.startPos, w, h);
  const endFull   = edgePoint(event.endEdge,   event.endPos,   w, h);
  const allPts    = generateWaypoints(startFull, endFull, event.pathSeed, w, h);

  const progress0     = Math.min(Math.max(startProgress, 0), 0.99);
  const origin        = pathPosition(allPts, progress0);
  const segLen        = 1 / (allPts.length - 1);
  const startSeg      = Math.floor(progress0 / segLen);
  const remainingPts  = [origin, ...allPts.slice(startSeg + 1)];
  const remainingDur  = event.duration * (1 - progress0);

  const imgSrc = item.image || `images/items/${item.id}.svg`;

  const el = document.createElement('div');
  el.className = 'stream-object';
  el.style.setProperty('--item-color', item.color);
  el.style.left = origin.x + 'px';
  el.style.top  = origin.y + 'px';
  el.innerHTML = `
    <div class="obj-icon" style="border-color:${item.color};background:rgba(0,0,0,0.6)">
      <img class="obj-img" src="${imgSrc}" alt="${item.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span class="obj-emoji" style="display:none">${item.emoji}</span>
    </div>
    <div class="obj-name">${item.name}</div>
  `;
  streamEl.appendChild(el);

  const fadeSpan = Math.min(0.08, 600 / remainingDur);
  const keyframes = remainingPts.map((pt, i) => {
    const frac = i / (remainingPts.length - 1);
    const dx   = pt.x - origin.x;
    const dy   = pt.y - origin.y;
    const opacity =
      progress0 > 0   ? (frac < 1 - fadeSpan ? 1 : 0) :
      frac < fadeSpan ? 0 :
      frac < fadeSpan * 2 ? 1 :
      frac < 1 - fadeSpan ? 1 : 0;
    return {
      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
      opacity,
      offset: frac,
    };
  });

  const anim = el.animate(keyframes, { duration: remainingDur, easing: 'ease-in-out', fill: 'forwards' });
  anim.onfinish = () => el.remove();

  if (startProgress === 0) addRecentSighting(item);
}

// --- Admin-forced minimum object spawner ---
// Not synchronized — local admin override only

function spawnForcedObject() {
  const rand      = mulberry32((Date.now() / 100) | 0);
  const fakeEvent = buildEvent(0, rand);
  spawnObject(fakeEvent, 0);
}

function startMinEnforcer() {
  clearInterval(minObjInterval);
  minObjInterval = setInterval(() => {
    const { minObjects } = getAdminSettings();
    if (!minObjects) return;
    const current = streamEl.querySelectorAll('.stream-object').length;
    if (current < minObjects) spawnForcedObject();
  }, 2000);
}

// --- Recent sightings sidebar ---

function addRecentSighting(item) {
  recentList.unshift({ item, time: Date.now() });
  if (recentList.length > 8) recentList.pop();
  renderRecent();
}

function renderRecent() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  el.innerHTML = recentList.map(({ item, time }) => {
    const secs = Math.round((Date.now() - time) / 1000);
    const ago  = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
    const src  = item.image || `images/items/${item.id}.svg`;
    return `<li style="border-left-color:${item.color}">
      <img class="recent-img" src="${src}" alt="${item.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span class="recent-emoji-fallback">${item.emoji}</span>
      <span class="recent-info">
        <span class="recent-name">${item.name}</span>
        <span class="recent-time">${ago}</span>
      </span>
    </li>`;
  }).join('');
}

setInterval(renderRecent, 5000);

// --- Main scheduler ---

function scheduleAll() {
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  streamEl.querySelectorAll('.stream-object').forEach(el => el.remove());

  const now         = Date.now();
  const periodIndex = Math.floor(now / PERIOD_MS);
  const elapsed     = now % PERIOD_MS;
  const events      = generateEvents(periodIndex);

  for (const ev of events) {
    const delay = ev.t - elapsed;
    if (delay > 500) {
      activeTimers.push(setTimeout(() => spawnObject(ev), delay));
    } else if (delay > -ev.duration) {
      const progress = Math.min(Math.max(-delay / ev.duration, 0), 0.97);
      spawnObject(ev, progress);
    }
  }

  const msUntilNext = PERIOD_MS - elapsed;
  activeTimers.push(setTimeout(scheduleAll, msUntilNext + 200));
  updateCountdown(msUntilNext);
}

function updateCountdown(msRemaining) {
  const el = document.getElementById('period-countdown');
  if (!el) return;
  let rem = msRemaining;
  const tick = () => {
    rem -= 1000;
    if (rem <= 0) return;
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000).toString().padStart(2, '0');
    el.textContent = `next sync ${m}:${s}`;
    setTimeout(tick, 1000);
  };
  tick();
}

// --- Init ---

function initStream() {
  streamEl = document.getElementById('stream-area');
  scheduleAll();
  startMinEnforcer();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleAll();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleAll, 300);
  });
}
