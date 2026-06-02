// Interactive bingo tracker — daub squares, detect BINGO, time the session,
// offer leaderboard submission on first BINGO.

const STORAGE_PREFIX = 'ggb_';
let currentSeed  = null;
let currentGrid  = null;
let markedCells  = new Set();

// --- Session timer ---
// Persisted in sessionStorage so a page refresh doesn't reset the clock
let timerStart    = null;
let timerInterval = null;
let bingoTime     = null;   // seconds elapsed when first BINGO was hit

function timerKey(seed) { return `ggb_timer_${seed}`; }

function startTimer(seed) {
  const stored = parseInt(sessionStorage.getItem(timerKey(seed)), 10);
  timerStart = stored || Date.now();
  if (!stored) sessionStorage.setItem(timerKey(seed), timerStart);

  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  tickTimer();
}

function stopTimer() {
  clearInterval(timerInterval);
  bingoTime = Math.round((Date.now() - timerStart) / 1000);
}

function tickTimer() {
  const el = document.getElementById('session-timer');
  if (!el || !timerStart) return;
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- Persistence ---

function storageKey(seed) { return STORAGE_PREFIX + seed; }

function saveState() {
  localStorage.setItem(storageKey(currentSeed), JSON.stringify([...markedCells]));
}

function loadState(seed) {
  const raw = localStorage.getItem(storageKey(seed));
  markedCells = raw ? new Set(JSON.parse(raw)) : new Set(['2-2']);
  markedCells.add('2-2');
}

// --- BINGO detection ---

const WIN_LINES = (() => {
  const lines = [];
  for (let i = 0; i < 5; i++) {
    lines.push([0,1,2,3,4].map(j => `${i}-${j}`));
    lines.push([0,1,2,3,4].map(j => `${j}-${i}`));
  }
  lines.push([0,1,2,3,4].map(i => `${i}-${i}`));
  lines.push([0,1,2,3,4].map(i => `${i}-${4-i}`));
  return lines;
})();

function getWinningLines() {
  return WIN_LINES.filter(line => line.every(k => markedCells.has(k)));
}

// --- Card render ---

function refreshCard() {
  const container = document.getElementById('tracker-card');
  renderBingoCard(currentGrid, container, { clickable: true, markedCells, seed: currentSeed });

  container.addEventListener('click', e => {
    const cell = e.target.closest('[data-row]');
    if (!cell) return;
    toggleCell(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
  }, { once: true });

  highlightWins();
  updateStatus();
}

function highlightWins() {
  const wins     = getWinningLines();
  if (!wins.length) return;
  const winCells = new Set(wins.flat());
  document.querySelectorAll('#tracker-card [data-row]').forEach(el => {
    if (winCells.has(`${el.dataset.row}-${el.dataset.col}`)) el.classList.add('bingo-winner');
  });
}

function updateStatus() {
  const wins    = getWinningLines();
  const statusEl = document.getElementById('bingo-status');
  if (!statusEl) return;

  if (wins.length > 0) {
    statusEl.textContent  = wins.length === 1 ? '🎉 BINGO!' : `🎉 BINGO ×${wins.length}!`;
    statusEl.className    = 'bingo-status has-bingo';

    if (!statusEl.dataset.announced) {
      statusEl.dataset.announced = '1';
      stopTimer();
      triggerConfetti();
      // Small delay so the confetti fires before the modal appears
      setTimeout(() => showBingoPopup(bingoTime), 800);
    }
  } else {
    statusEl.textContent = '';
    statusEl.className   = 'bingo-status';
    delete statusEl.dataset.announced;
  }
}

function toggleCell(r, c) {
  const key = `${r}-${c}`;
  if (markedCells.has(key)) markedCells.delete(key);
  else markedCells.add(key);
  saveState();
  refreshCard();
}

// --- BINGO popup ---

function showBingoPopup(secs) {
  if (document.getElementById('bingo-popup')) return;

  const overlay = document.createElement('div');
  overlay.id        = 'bingo-popup';
  overlay.className = 'bingo-popup-overlay';
  overlay.innerHTML = `
    <div class="bingo-popup">
      <div class="bingo-popup-firework">🎉</div>
      <h2 class="bingo-popup-heading">BINGO!</h2>
      <p class="bingo-popup-time">Completed in <strong>${formatTime(secs)}</strong></p>

      <div id="popup-stage-ask">
        <p class="bingo-popup-sub">Add your time to the leaderboard?</p>
        <div class="bingo-popup-btns">
          <button class="btn btn-primary" id="popup-yes">Add my time</button>
          <button class="btn" id="popup-no">No thanks</button>
        </div>
      </div>

      <div id="popup-stage-name" style="display:none">
        <p class="bingo-popup-sub">What name should we put down?</p>
        <div class="bingo-popup-name-row">
          <input id="popup-name-input" type="text" placeholder="Your name"
                 maxlength="50" autocomplete="off" spellcheck="false"/>
          <button class="btn btn-primary" id="popup-submit">Submit</button>
        </div>
        <p id="popup-error" style="color:var(--hot);font-size:12px;margin-top:6px;display:none"></p>
      </div>

      <div id="popup-stage-done" style="display:none">
        <p class="bingo-popup-rank" id="popup-rank-text"></p>
        <div class="bingo-popup-btns">
          <a href="leaderboard.html" class="btn btn-primary">View Leaderboard</a>
          <button class="btn" id="popup-close-done">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const stageAsk  = overlay.querySelector('#popup-stage-ask');
  const stageName = overlay.querySelector('#popup-stage-name');
  const stageDone = overlay.querySelector('#popup-stage-done');
  const errEl     = overlay.querySelector('#popup-error');
  const nameInput = overlay.querySelector('#popup-name-input');

  overlay.querySelector('#popup-yes').addEventListener('click', () => {
    stageAsk.style.display  = 'none';
    stageName.style.display = 'block';
    nameInput.focus();
  });

  overlay.querySelector('#popup-no').addEventListener('click', () => overlay.remove());

  async function doSubmit() {
    const name = nameInput.value.trim();
    if (!name) { errEl.textContent = 'Enter a name first.'; errEl.style.display = 'block'; return; }

    const submitBtn = overlay.querySelector('#popup-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    errEl.style.display = 'none';

    try {
      const res  = await fetch('/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, timeSeconds: secs }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Server error');

      stageName.style.display = 'none';
      stageDone.style.display = 'block';
      overlay.querySelector('#popup-rank-text').textContent =
        `You're #${data.rank} on the leaderboard!`;

    } catch (err) {
      errEl.textContent     = 'Something went wrong. Try again.';
      errEl.style.display   = 'block';
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Submit';
    }
  }

  overlay.querySelector('#popup-submit').addEventListener('click', doSubmit);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
  overlay.querySelector('#popup-close-done').addEventListener('click', () => overlay.remove());
}

// --- Confetti ---

function triggerConfetti() {
  const colors = ['#ffd700', '#ff6b6b', '#00e5ff', '#a8ff78', '#ff69b4'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.setProperty('--x', (Math.random() * 200 - 100) + 'vw');
    dot.style.setProperty('--y', (Math.random() * -120 - 10) + 'vh');
    dot.style.background   = colors[Math.floor(Math.random() * colors.length)];
    dot.style.left         = (Math.random() * 100) + 'vw';
    dot.style.top          = '50vh';
    dot.style.animationDelay = (Math.random() * 0.6) + 's';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 3000);
  }
}

// --- Seed input ---

function loadCardFromInput(inputId) {
  const input = document.getElementById(inputId);
  const s     = parseInt(input.value.trim(), 10);
  if (!s || isNaN(s)) { input.classList.add('error'); return; }
  input.classList.remove('error');
  initWithSeed(s);
  history.replaceState({}, '', '#' + s);
}

function initWithSeed(seed) {
  currentSeed = seed >>> 0;
  currentGrid = generateBingoCard(currentSeed);
  loadState(currentSeed);

  document.getElementById('no-card').style.display       = 'none';
  document.getElementById('tracker-section').style.display = 'block';
  document.getElementById('display-seed').textContent    = currentSeed;

  const bingoLink = document.getElementById('bingo-link');
  if (bingoLink) bingoLink.href = `bingo.html?seed=${currentSeed}`;

  startTimer(currentSeed);
  refreshCard();
}

// --- Init ---

function initTracker() {
  const hashSeed  = parseInt(window.location.hash.slice(1), 10);
  const params    = new URLSearchParams(window.location.search);
  const seedParam = hashSeed || parseInt(params.get('seed'), 10);

  if (seedParam && !isNaN(seedParam)) {
    initWithSeed(seedParam);
  } else {
    document.getElementById('no-card').style.display       = 'block';
    document.getElementById('tracker-section').style.display = 'none';
  }

  document.getElementById('load-seed-btn').addEventListener('click',
    () => loadCardFromInput('seed-input'));
  document.getElementById('seed-input').addEventListener('keydown',
    e => { if (e.key === 'Enter') loadCardFromInput('seed-input'); });
  document.getElementById('switch-seed-btn')?.addEventListener('click',
    () => loadCardFromInput('switch-seed-input'));
  document.getElementById('switch-seed-input')?.addEventListener('keydown',
    e => { if (e.key === 'Enter') loadCardFromInput('switch-seed-input'); });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (!currentSeed) return;
    if (confirm('Clear all your daubs?')) {
      markedCells = new Set(['2-2']);
      saveState();
      // Reset timer
      sessionStorage.removeItem(timerKey(currentSeed));
      startTimer(currentSeed);
      // Remove bingo announced flag
      const statusEl = document.getElementById('bingo-status');
      if (statusEl) delete statusEl.dataset.announced;
      refreshCard();
    }
  });
}
