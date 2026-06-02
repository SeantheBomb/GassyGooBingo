// Interactive bingo tracker — click squares to daub them, detects BINGO
// State persisted in localStorage per card seed

const STORAGE_PREFIX = 'ggb_';
let currentSeed = null;
let currentGrid = null;
let markedCells = new Set();

function storageKey(seed) {
  return STORAGE_PREFIX + seed;
}

function saveState() {
  localStorage.setItem(storageKey(currentSeed), JSON.stringify([...markedCells]));
}

function loadState(seed) {
  const raw = localStorage.getItem(storageKey(seed));
  markedCells = raw ? new Set(JSON.parse(raw)) : new Set(['2-2']); // FREE always marked
  markedCells.add('2-2');
}

// --- Bingo detection ---

const WIN_LINES = (() => {
  const lines = [];
  for (let i = 0; i < 5; i++) {
    lines.push([0,1,2,3,4].map(j => `${i}-${j}`)); // rows
    lines.push([0,1,2,3,4].map(j => `${j}-${i}`)); // cols
  }
  lines.push([0,1,2,3,4].map(i => `${i}-${i}`));   // diagonal TL→BR
  lines.push([0,1,2,3,4].map(i => `${i}-${4-i}`)); // diagonal TR→BL
  return lines;
})();

function getWinningLines() {
  return WIN_LINES.filter(line => line.every(k => markedCells.has(k)));
}

// --- Render ---

function refreshCard() {
  const container = document.getElementById('tracker-card');
  renderBingoCard(currentGrid, container, {
    clickable: true,
    markedCells,
    seed: currentSeed,
  });

  // Attach click handler via delegation
  container.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-row]');
    if (!cell) return;
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    toggleCell(r, c);
  }, { once: true }); // re-attached on every refresh via recursion guard

  highlightWins();
  updateStatus();
}

function highlightWins() {
  const wins = getWinningLines();
  if (!wins.length) return;

  const winCells = new Set(wins.flat());
  const container = document.getElementById('tracker-card');
  container.querySelectorAll('[data-row]').forEach(el => {
    const key = `${el.dataset.row}-${el.dataset.col}`;
    if (winCells.has(key)) el.classList.add('bingo-winner');
  });
}

function updateStatus() {
  const wins = getWinningLines();
  const statusEl = document.getElementById('bingo-status');
  if (!statusEl) return;

  if (wins.length > 0) {
    statusEl.textContent = wins.length === 1 ? '🎉 BINGO!' : `🎉 BINGO ×${wins.length}!`;
    statusEl.className = 'bingo-status has-bingo';
    if (!statusEl.dataset.announced) {
      statusEl.dataset.announced = '1';
      triggerConfetti();
    }
  } else {
    statusEl.textContent = '';
    statusEl.className = 'bingo-status';
    delete statusEl.dataset.announced;
  }
}

function toggleCell(r, c) {
  const key = `${r}-${c}`;
  if (markedCells.has(key)) {
    markedCells.delete(key);
  } else {
    markedCells.add(key);
  }
  saveState();
  refreshCard();
}

// --- Simple CSS confetti burst ---

function triggerConfetti() {
  const colors = ['#ffd700', '#ff6b6b', '#00e5ff', '#a8ff78', '#ff69b4'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.setProperty('--x', (Math.random() * 200 - 100) + 'vw');
    dot.style.setProperty('--y', (Math.random() * -120 - 10) + 'vh');
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.left = (Math.random() * 100) + 'vw';
    dot.style.top = '50vh';
    dot.style.animationDelay = (Math.random() * 0.6) + 's';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 3000);
  }
}

// --- Seed input ---

function loadCardFromInput(inputId) {
  const input = document.getElementById(inputId);
  const s = parseInt(input.value.trim(), 10);
  if (!s || isNaN(s)) {
    input.classList.add('error');
    return;
  }
  input.classList.remove('error');
  initWithSeed(s);
  history.replaceState({}, '', '#' + s);
}

function initWithSeed(seed) {
  currentSeed = seed >>> 0;
  currentGrid = generateBingoCard(currentSeed);
  loadState(currentSeed);

  document.getElementById('no-card').style.display = 'none';
  document.getElementById('tracker-section').style.display = 'block';
  document.getElementById('display-seed').textContent = currentSeed;

  const bingoLink = document.getElementById('bingo-link');
  if (bingoLink) bingoLink.href = `bingo.html?seed=${currentSeed}`;

  refreshCard();
}

// --- Init ---

function initTracker() {
  // Support both hash (#<seed>) and query param (?seed=<seed>) for flexibility
  const hashSeed = parseInt(window.location.hash.slice(1), 10);
  const params   = new URLSearchParams(window.location.search);
  const seedParam = hashSeed || parseInt(params.get('seed'), 10);

  if (seedParam && !isNaN(seedParam)) {
    initWithSeed(seedParam);
  } else {
    document.getElementById('no-card').style.display = 'block';
    document.getElementById('tracker-section').style.display = 'none';
  }

  document.getElementById('load-seed-btn').addEventListener('click', () => loadCardFromInput('seed-input'));
  document.getElementById('seed-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCardFromInput('seed-input');
  });
  document.getElementById('switch-seed-btn')?.addEventListener('click', () => loadCardFromInput('switch-seed-input'));
  document.getElementById('switch-seed-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCardFromInput('switch-seed-input');
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (!currentSeed) return;
    if (confirm('Clear all your daubs?')) {
      markedCells = new Set(['2-2']);
      saveState();
      refreshCard();
    }
  });
}
