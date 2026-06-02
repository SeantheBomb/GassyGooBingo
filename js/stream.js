// Stream: synchronized across all viewers via time-seeded PRNG.
// Every 5-minute period produces the same sequence for every browser on earth.
// Each object follows a curved, erratic path — also deterministic per event.

const EVENTS_PER_PERIOD = 38;
const MIN_DURATION_MS   = 6000;   // slowest: 42 seconds
const MAX_DURATION_MS   = 42000;  // fastest: 6 seconds

let streamEl = null;
let activeTimers = [];
let recentList = [];

// --- Edge coordinate helpers ---

function edgePoint(edge, pos, w, h) {
  const p = 0.06 + pos * 0.88;  // keep away from corners
  switch (edge) {
    case 0: return { x: p * w, y: -110 };       // top
    case 1: return { x: w + 110, y: p * h };    // right
    case 2: return { x: p * w, y: h + 110 };    // bottom
    case 3: return { x: -110, y: p * h };        // left
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// --- Erratic path generation ---
// Returns an array of { x, y } waypoints the object will travel through.
// pathSeed ensures all clients generate the identical path for the same event.

function generateWaypoints(start, end, pathSeed, screenW, screenH) {
  const rand = mulberry32(pathSeed >>> 0);
  const numVia = 2 + Math.floor(rand() * 3);   // 2–4 intermediate stops

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular direction (to deviate sideways from the direct line)
  const perpX = -dy / len;
  const perpY =  dx / len;
  const maxDev = Math.min(screenW, screenH) * 0.38;

  const pts = [start];
  for (let i = 1; i <= numVia; i++) {
    const t = i / (numVia + 1);
    const deviation = (rand() - 0.5) * 2 * maxDev;
    // Occasionally add a secondary wobble on top
    const wobble = (rand() - 0.5) * maxDev * 0.3;
    pts.push({
      x: start.x + dx * t + perpX * deviation + perpY * wobble,
      y: start.y + dy * t + perpY * deviation - perpX * wobble,
    });
  }
  pts.push(end);
  return pts;
}

// Interpolate position along the full path at progress [0,1]
function pathPosition(pts, progress) {
  if (progress <= 0) return pts[0];
  if (progress >= 1) return pts[pts.length - 1];
  const segLen = 1 / (pts.length - 1);
  const seg = Math.min(Math.floor(progress / segLen), pts.length - 2);
  const t = (progress - seg * segLen) / segLen;
  return { x: lerp(pts[seg].x, pts[seg + 1].x, t), y: lerp(pts[seg].y, pts[seg + 1].y, t) };
}

// --- Event generation (deterministic per period) ---

function generateEvents(periodIndex) {
  const rand = mulberry32(periodIndex);
  const events = [];

  for (let i = 0; i < EVENTS_PER_PERIOD; i++) {
    const t         = rand() * PERIOD_MS;
    const itemIndex = Math.floor(rand() * ITEMS.length);
    const startEdge = Math.floor(rand() * 4);
    const endOffset = 1 + Math.floor(rand() * 3);
    const endEdge   = (startEdge + endOffset) % 4;
    const startPos  = rand();
    const endPos    = rand();
    const duration  = MIN_DURATION_MS + rand() * (MAX_DURATION_MS - MIN_DURATION_MS);
    const pathSeed  = Math.floor(rand() * 0xFFFFFF);  // seed for erratic path

    events.push({ t, itemIndex, startEdge, endEdge, startPos, endPos, duration, pathSeed });
  }

  return events.sort((a, b) => a.t - b.t);
}

// --- Object spawning ---

function spawnObject(event, startProgress = 0) {
  const item = ITEMS[event.itemIndex];
  const w = streamEl.clientWidth;
  const h = streamEl.clientHeight;

  const startFull = edgePoint(event.startEdge, event.startPos, w, h);
  const endFull   = edgePoint(event.endEdge,   event.endPos,   w, h);
  const allPts    = generateWaypoints(startFull, endFull, event.pathSeed, w, h);

  // If joining mid-flight, trim waypoints to current position
  const progress0 = Math.min(Math.max(startProgress, 0), 0.99);
  const origin    = pathPosition(allPts, progress0);

  // Build the subset of waypoints from current position onward
  const segLen = 1 / (allPts.length - 1);
  const startSeg = Math.floor(progress0 / segLen);
  const remainingPts = [origin, ...allPts.slice(startSeg + 1)];
  const remainingDuration = event.duration * (1 - progress0);

  const el = document.createElement('div');
  el.className = 'stream-object';
  el.style.setProperty('--item-color', item.color);
  el.style.left = origin.x + 'px';
  el.style.top  = origin.y + 'px';
  el.innerHTML = `
    <div class="obj-icon" style="border-color:${item.color};background:rgba(0,0,0,0.6)">
      <img class="obj-img" src="images/items/${item.id}.svg" alt="${item.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span class="obj-emoji" style="display:none">${item.emoji}</span>
    </div>
    <div class="obj-name">${item.name}</div>
  `;

  streamEl.appendChild(el);

  // Build transform keyframes: translate relative to the origin left/top
  const fadeSpan = Math.min(0.08, 600 / remainingDuration);
  const keyframes = remainingPts.map((pt, i) => {
    const frac = i / (remainingPts.length - 1);
    const dx = pt.x - origin.x;
    const dy = pt.y - origin.y;
    const opacity =
      progress0 > 0    ? (frac < 1 - fadeSpan ? 1 : 0) :
      frac < fadeSpan   ? 0 :
      frac < fadeSpan * 2 ? 1 :
      frac < 1 - fadeSpan ? 1 : 0;

    return {
      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
      opacity,
      offset: frac,
    };
  });

  const anim = el.animate(keyframes, {
    duration: remainingDuration,
    easing: 'ease-in-out',
    fill: 'forwards',
  });
  anim.onfinish = () => el.remove();

  // Update sidebar
  if (startProgress === 0) addRecentSighting(item);
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
    const ago  = secs < 60 ? `${secs}s ago` : `${Math.floor(secs/60)}m ago`;
    return `<li style="border-left-color:${item.color}">
      <img class="recent-img" src="images/items/${item.id}.svg" alt="${item.name}"
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

  // Re-schedule at start of next period
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

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleAll();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleAll, 300);
  });
}
