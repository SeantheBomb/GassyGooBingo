// Stream: synchronized across all viewers via time-seeded PRNG
// Every 5-minute period produces the same sequence of objects for every browser on earth.

const EVENTS_PER_PERIOD = 38;
const MIN_DURATION_MS   = 5000;   // fastest crossing: 5 seconds
const MAX_DURATION_MS   = 42000;  // slowest crossing: 42 seconds

let streamEl = null;
let activeTimers = [];
let recentList = [];

// --- Edge coordinate helpers ---

function edgePoint(edge, pos, w, h) {
  // Returns the start/end pixel coords for an object on a given edge
  // edge: 0=top, 1=right, 2=bottom, 3=left
  // pos: 0..1 position along that edge (clamped away from corners)
  const p = 0.08 + pos * 0.84;
  switch (edge) {
    case 0: return { x: p * w, y: -110 };
    case 1: return { x: w + 110, y: p * h };
    case 2: return { x: p * w, y: h + 110 };
    case 3: return { x: -110, y: p * h };
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// --- Event generation (deterministic per period) ---

function generateEvents(periodIndex) {
  const rand = mulberry32(periodIndex);
  const events = [];

  for (let i = 0; i < EVENTS_PER_PERIOD; i++) {
    const t          = rand() * PERIOD_MS;
    const itemIndex  = Math.floor(rand() * ITEMS.length);
    const startEdge  = Math.floor(rand() * 4);
    const endOffset  = 1 + Math.floor(rand() * 3);   // 1, 2, or 3 edges away
    const endEdge    = (startEdge + endOffset) % 4;
    const startPos   = rand();
    const endPos     = rand();
    const duration   = MIN_DURATION_MS + rand() * (MAX_DURATION_MS - MIN_DURATION_MS);

    events.push({ t, itemIndex, startEdge, endEdge, startPos, endPos, duration });
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

  // If spawning mid-flight, begin at the interpolated position
  const ox = lerp(startFull.x, endFull.x, startProgress);
  const oy = lerp(startFull.y, endFull.y, startProgress);
  const dx = endFull.x - ox;
  const dy = endFull.y - oy;
  const remainingDuration = event.duration * (1 - startProgress);

  const el = document.createElement('div');
  el.className = 'stream-object';
  el.style.setProperty('--item-color', item.color);
  el.style.left = ox + 'px';
  el.style.top  = oy + 'px';
  el.innerHTML = `
    <div class="obj-icon" style="border-color:${item.color};background:${item.color}22">
      <span class="obj-emoji">${item.emoji}</span>
    </div>
    <div class="obj-name">${item.name}</div>
  `;

  streamEl.appendChild(el);

  const fadeInDur  = startProgress > 0 ? 0 : Math.min(600, remainingDuration * 0.06);
  const fadeOutDur = Math.min(600, remainingDuration * 0.06);

  const anim = el.animate([
    { transform: `translate(-50%,-50%)`,                           opacity: startProgress > 0 ? 1 : 0 },
    { transform: `translate(-50%,-50%)`,                           opacity: 1,   offset: fadeInDur / remainingDuration },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`, opacity: 1, offset: 1 - fadeOutDur / remainingDuration },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`, opacity: 0 },
  ], { duration: remainingDuration, easing: 'linear', fill: 'forwards' });

  anim.onfinish = () => el.remove();

  // Update recent-sightings sidebar
  addRecentSighting(item);
}

// --- Recent sightings ---

function addRecentSighting(item) {
  recentList.unshift({ item, time: Date.now() });
  if (recentList.length > 8) recentList.pop();
  renderRecent();
}

function renderRecent() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  el.innerHTML = recentList.map(({ item, time }) => {
    const ago = Math.round((Date.now() - time) / 1000);
    return `<li style="border-left-color:${item.color}">
      <span class="recent-emoji">${item.emoji}</span>
      <span class="recent-name">${item.name}</span>
      <span class="recent-time">${ago}s ago</span>
    </li>`;
  }).join('');
}

// Keep recent timestamps live
setInterval(renderRecent, 5000);

// --- Main scheduler ---

function scheduleAll() {
  activeTimers.forEach(clearTimeout);
  activeTimers = [];

  const now             = Date.now();
  const periodIndex     = Math.floor(now / PERIOD_MS);
  const elapsed         = now % PERIOD_MS;
  const events          = generateEvents(periodIndex);

  for (const ev of events) {
    const delay = ev.t - elapsed;

    if (delay > 500) {
      // Future event — schedule normally
      activeTimers.push(setTimeout(() => spawnObject(ev), delay));
    } else if (delay > -ev.duration) {
      // In-flight event — spawn immediately at interpolated position
      const progress = Math.min(Math.max(-delay / ev.duration, 0), 0.98);
      spawnObject(ev, progress);
    }
    // else: already finished, skip
  }

  // Re-schedule at the start of the next period
  const msUntilNextPeriod = PERIOD_MS - elapsed;
  activeTimers.push(setTimeout(scheduleAll, msUntilNextPeriod + 200));

  // Update period countdown
  updateCountdown(msUntilNextPeriod);
}

// --- Period countdown display ---

function updateCountdown(msRemaining) {
  const el = document.getElementById('period-countdown');
  if (!el) return;

  let remaining = msRemaining;
  const tick = () => {
    remaining -= 1000;
    if (remaining <= 0) return;
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    el.textContent = `next sync ${m}:${s}`;
    setTimeout(tick, 1000);
  };
  tick();
}

// --- Init ---

function initStream() {
  streamEl = document.getElementById('stream-area');
  scheduleAll();

  // Pause/resume on visibility change (saves CPU in background tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleAll();
  });

  // Re-calc on resize (edge coords depend on viewport size)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleAll, 300);
  });
}
