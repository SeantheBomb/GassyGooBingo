// Mulberry32 — fast, deterministic, good distribution
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle using a seeded RNG
function seededShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Stream sync: 5-minute periods, same for every browser on earth
const PERIOD_MS = 5 * 60 * 1000;

function getCurrentPeriod() {
  return Math.floor(Date.now() / PERIOD_MS);
}

function getTimeWithinPeriod() {
  return Date.now() % PERIOD_MS;
}
