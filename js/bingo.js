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

      const imgContent = item.isFree
        ? `<span class="cell-emoji">${item.emoji}</span>`
        : `<img class="cell-img" src="images/items/${item.id}.svg" alt="${item.name}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
           <span class="cell-emoji" style="display:none">${item.emoji}</span>`;

      html += `<td class="${classes}" ${clickAttr} style="--item-color:${item.color}">
        <div class="cell-inner">
          ${imgContent}
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
