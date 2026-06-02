// Leaderboard page — fetches and renders top 100 BINGO times

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0
    ? `${m}:${String(s).padStart(2, '0')}`
    : `0:${String(s).padStart(2, '0')}`;
}

function formatDate(epochMs) {
  const d = new Date(epochMs);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

async function loadLeaderboard() {
  const content = document.getElementById('lb-content');
  content.innerHTML = '<div class="lb-loading">Loading…</div>';

  try {
    const res  = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('Server error');
    const { entries } = await res.json();

    if (!entries || entries.length === 0) {
      content.innerHTML = `
        <div class="lb-empty">
          No entries yet — be the first to get BINGO!<br>
          <a href="bingo.html" style="color:var(--accent);margin-top:8px;display:inline-block">Get a card →</a>
        </div>`;
      return;
    }

    const rows = entries.map((e, i) => `
      <tr>
        <td class="lb-rank">${medal(i + 1)}</td>
        <td class="lb-name">${escHtml(e.name)}</td>
        <td class="lb-time right">${formatTime(e.time_seconds)}</td>
        <td class="lb-date right">${formatDate(e.submitted_at)}</td>
      </tr>`).join('');

    content.innerHTML = `
      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th class="right">Time</th>
            <th class="right">Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

  } catch {
    content.innerHTML = '<div class="lb-empty">Failed to load — try refreshing.</div>';
  }
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  loadLeaderboard();
  document.getElementById('lb-refresh-btn').addEventListener('click', loadLeaderboard);
});
