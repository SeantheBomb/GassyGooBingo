// Live viewer count — backed by Cloudflare D1 via Pages Function at /presence
// Each tab gets a unique session ID. Heartbeats every 60s keep the row alive.
// A lighter count-only poll runs every 30s between heartbeats.
// On tab close, a keepalive request removes the row immediately.

(function () {
  const countEl = document.getElementById('viewer-count');
  if (!countEl) return;

  // Unique session ID per tab (not persisted across sessions)
  const id = (() => {
    const stored = sessionStorage.getItem('ggb_sid');
    if (stored) return stored;
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const fresh = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('ggb_sid', fresh);
    return fresh;
  })();

  function setCount(n) {
    if (typeof n === 'number' && n >= 1) countEl.textContent = n;
  }

  // Heartbeat — POST keeps our session alive and returns updated count
  async function heartbeat() {
    try {
      const res = await fetch('/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setCount((await res.json()).viewers);
    } catch { /* ignore network errors — count stays at last known value */ }
  }

  // Count-only poll — cheap GET, no write
  async function pollCount() {
    try {
      const res = await fetch('/presence');
      if (res.ok) setCount((await res.json()).viewers);
    } catch {}
  }

  // Register immediately on load
  heartbeat();

  // Heartbeat every 60s, count poll every 30s (interleaved)
  let tick = 0;
  setInterval(() => {
    tick++;
    if (tick % 2 === 0) heartbeat(); else pollCount();
  }, 30_000);

  // Remove our session when the tab is closed/navigated away (keepalive = survives unload)
  window.addEventListener('pagehide', () => {
    navigator.sendBeacon('/presence', new Blob(
      [JSON.stringify({ id, leave: true })],
      { type: 'application/json' }
    ));
  });
})();
