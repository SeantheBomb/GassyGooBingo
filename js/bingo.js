// Bingo card generation — each player gets their own random seed
// Seed can be shared via URL so a group can compare cards

const BINGO_COLS = ['B', 'I', 'N', 'G', 'O'];

function generateBingoCard(seed) {
  const rand = mulberry32(seed >>> 0);
  const shuffled = seededShuffle(ITEMS, rand);
  const selected = shuffled.slice(0, 24); // 24 items + 1 FREE center

  // Build 5x5 grid, inserting FREE at position [2][2]
  const grid = [];
  let idx = 0;
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) {
        row.push({ id: 'FREE', name: 'FREE SPACE', emoji: '⭐', color: '#ffd700', isFree: true });
      } else {
        row.push(selected[idx++]);
      }
    }
    grid.push(row);
  }
  return grid;
}

function renderBingoCard(grid, container, { clickable = false, markedCells = null, seed = null } = {}) {
  let html = '<table class="bingo-table" aria-label="Bingo card">';

  // Column headers
  html += '<thead><tr>';
  for (const h of BINGO_COLS) {
    html += `<th class="bingo-col-header">${h}</th>`;
  }
  html += '</tr></thead>';

  html += '<tbody>';
  for (let r = 0; r < 5; r++) {
    html += '<tr>';
    for (let c = 0; c < 5; c++) {
      const item = grid[r][c];
      const key = `${r}-${c}`;
      const isMarked = markedCells ? markedCells.has(key) : item.isFree;
      const classes = [
        'bingo-cell',
        item.isFree ? 'bingo-free' : '',
        isMarked ? 'marked' : '',
        clickable && !item.isFree ? 'clickable' : '',
      ].filter(Boolean).join(' ');

      const clickAttr = clickable && !item.isFree
        ? `data-row="${r}" data-col="${c}"`
        : '';

      // Bingo card is text-only — the challenge is recognising the stream item
      // FREE SPACE uses the Regulation logo instead of the star emoji
      const freeIcon = item.isFree
        ? `<svg class="free-reg-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
             <rect width="100" height="100" fill="#000" rx="8"/>
             <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="11"/>
             <path fill="#fff" d="M50 20 C57 20 63 25 63 31 C63 36 68 38 76 39 C85 40 86 49 82 54 C79 58 72 59 70 65 C68 70 70 76 68 80 C66 84 60 85 56 80 C53 76 50 75 50 75 C50 75 47 76 44 80 C40 85 34 84 32 80 C30 76 32 70 30 65 C28 59 21 58 18 54 C14 49 15 40 24 39 C32 38 37 36 37 31 C37 25 43 20 50 20Z"/>
           </svg>`
        : '';

      html += `<td class="${classes}" ${clickAttr} style="--item-color:${item.color}">
        <div class="cell-inner">
          ${freeIcon}
          <span class="cell-name">${item.name}</span>
          ${isMarked && !item.isFree ? '<div class="daub"></div>' : ''}
        </div>
      </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  container.innerHTML = html;
}

// --- Bingo page init ---

function initBingo() {
  const params = new URLSearchParams(window.location.search);
  let seed = parseInt(params.get('seed'), 10);
  if (!seed || isNaN(seed)) seed = (Math.random() * 0xFFFFFFFF) >>> 0;

  applyCard(seed);

  document.getElementById('new-card-btn').addEventListener('click', () => {
    const s = (Math.random() * 0xFFFFFFFF) >>> 0;
    applyCard(s);
  });

  document.getElementById('print-btn').addEventListener('click', () => window.print());
}

function applyCard(seed) {
  const grid = generateBingoCard(seed);
  renderBingoCard(grid, document.getElementById('bingo-card'));

  // Persist seed in URL so the card can be bookmarked / shared
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  history.replaceState({}, '', url);

  const seedEl = document.getElementById('card-seed');
  if (seedEl) seedEl.textContent = seed;

  const trackerLink = document.getElementById('tracker-link');
  if (trackerLink) trackerLink.href = `tracker.html#${seed}`;
}
