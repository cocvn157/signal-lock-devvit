import {
  generateDailyPuzzle,
  getUtcDateKey,
  traceBeam,
  buildSpoilerFreeShareCard,
  type DailyPuzzle,
  type MirrorSlash,
} from '../shared/puzzle.ts';

let mode: 'daily' | 'practice' = 'daily';
let devvitActive = false;
let puzzle: DailyPuzzle = generateDailyPuzzle(getUtcDateKey());
let initialMirrors: Record<string, MirrorSlash> = {};
let mirrors: Record<string, MirrorSlash> = {};
let moves = 0;
let startMs = Date.now();
let elapsedSec = 0;
let solved = false;
let streak = Number(localStorage.getItem('sl_streak') || '0');
let sfxEnabled = true;
let practiceSeedIdx = 1;
let latestShareCard = '';

let timerId: number | null = null;
let audioCtx: AudioContext | null = null;

function playTone(freq: number, dur = 0.08, type: OscillatorType = 'triangle') {
  if (!sfxEnabled) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {
    // Audio blocked before user interaction
  }
}

function loadPuzzleState(nextPuzzle: DailyPuzzle) {
  puzzle = nextPuzzle;
  initialMirrors = {};
  mirrors = {};
  for (const coord of puzzle.mirrorCoords) {
    const slash = puzzle.cells[coord.row][coord.col].mirror || '/';
    const key = `${coord.row},${coord.col}`;
    initialMirrors[key] = slash;
    mirrors[key] = slash;
  }
  moves = 0;
  elapsedSec = 0;
  solved = false;
  startMs = Date.now();
  document.getElementById('victory-box')!.classList.add('hidden');
  document.getElementById('stat-par')!.textContent = String(puzzle.parMoves);
  document.getElementById('puzzle-meta')!.textContent =
    mode === 'daily'
      ? `Daily #${puzzle.puzzleNumber} · ${puzzle.dateKey} UTC`
      : `Endless Practice #${practiceSeedIdx}`;
  if (timerId) window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    if (!solved) {
      elapsedSec = Math.max(1, Math.floor((Date.now() - startMs) / 1000));
      document.getElementById('stat-time')!.textContent = `${elapsedSec}s`;
    }
  }, 500);
  render();
}

function dirArrow(dir?: string): string {
  if (dir === 'U') return '⬆️';
  if (dir === 'D') return '⬇️';
  if (dir === 'L') return '⬅️';
  return '➡️';
}

function renderBeamSvg(path: Array<{ row: number; col: number }>, isSolved: boolean) {
  const svg = document.getElementById('beam-svg')!;
  if (path.length < 2) {
    svg.innerHTML = '';
    return;
  }
  const points = path.map((p) => `${p.col * 100 + 50},${p.row * 100 + 50}`).join(' ');
  const stroke = isSolved ? '#10b981' : '#22d3ee';
  svg.innerHTML = `
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <polyline fill="none" stroke="${stroke}" stroke-opacity="0.35" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    <polyline fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" points="${points}" />
  `;
}

function renderLeaderboard(entries: Array<{ username: string; moves: number; elapsedSec: number }>) {
  const list = document.getElementById('leaderboard-list')!;
  if (!entries.length) {
    list.innerHTML = `<li class="muted">Solve today's puzzle to claim #1!</li>`;
    return;
  }
  list.innerHTML = entries
    .map((e, idx) => `<li><strong>#${idx + 1} u/${e.username}</strong> — ${e.moves} moves (${e.elapsedSec}s)</li>`)
    .join('');
}

async function onSolved(trace: ReturnType<typeof traceBeam>) {
  solved = true;
  if (timerId) window.clearInterval(timerId);
  elapsedSec = Math.max(1, Math.floor((Date.now() - startMs) / 1000));
  playTone(523.25, 0.1, 'sine');
  setTimeout(() => playTone(659.25, 0.12, 'sine'), 80);
  setTimeout(() => playTone(783.99, 0.22, 'sine'), 160);

  if (mode === 'daily') {
    if (devvitActive) {
      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mirrors, moves, elapsedSec }),
        });
        if (res.ok) {
          const data = await res.json();
          streak = data.streak;
          latestShareCard = data.shareCard;
          renderLeaderboard(data.leaderboard || []);
        }
      } catch {
        // Fallback below
      }
    }
    if (!latestShareCard) {
      const todayKey = getUtcDateKey();
      const last = localStorage.getItem('sl_last_solved');
      if (last !== todayKey) {
        streak = streak + 1;
        localStorage.setItem('sl_streak', String(streak));
        localStorage.setItem('sl_last_solved', todayKey);
      }
      latestShareCard = buildSpoilerFreeShareCard({ puzzle, trace, moves, elapsedSec, streak });
      renderLeaderboard([{ username: 'you (local)', moves, elapsedSec }]);
    }
    document.getElementById('btn-reddit-comment')!.classList.toggle('hidden', !devvitActive);
    document.getElementById('btn-next-practice')!.classList.add('hidden');
  } else {
    latestShareCard = buildSpoilerFreeShareCard({ puzzle, trace, moves, elapsedSec, streak });
    document.getElementById('btn-reddit-comment')!.classList.add('hidden');
    document.getElementById('btn-next-practice')!.classList.remove('hidden');
  }

  const stars = moves <= puzzle.parMoves ? '⭐⭐⭐ PAR MASTER!' : moves <= puzzle.parMoves + 2 ? '⭐⭐ CLEAN LOCK!' : '⭐ SIGNAL LOCKED!';
  document.getElementById('victory-stars')!.textContent = stars;
  document.getElementById('share-preview')!.textContent = latestShareCard;
  document.getElementById('victory-box')!.classList.remove('hidden');
  document.getElementById('stat-streak')!.textContent = `${streak}🔥`;
}

function render() {
  const trace = traceBeam(puzzle.cells, mirrors);
  const pathKeys = new Set(trace.path.map((p) => `${p.row},${p.col}`));
  const grid = document.getElementById('grid')!;
  grid.innerHTML = '';

  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      const cell = puzzle.cells[r][c];
      const key = `${r},${c}`;
      const isLit = pathKeys.has(key);
      const div = document.createElement('div');
      div.className = `cell ${cell.kind}${isLit ? ' lit' : ''}`;

      if (cell.kind === 'emitter') {
        div.textContent = dirArrow(cell.emitterDir);
      } else if (cell.kind === 'target') {
        div.textContent = '🎯';
      } else if (cell.kind === 'wall') {
        div.textContent = '🧱';
      } else if (cell.kind === 'checkpoint') {
        div.textContent = isLit ? '💠' : '💎';
      } else if (cell.kind === 'mirror') {
        const slash = mirrors[key] || '/';
        const bar = document.createElement('div');
        bar.className = `mirror-bar ${slash === '/' ? 'slash-fwd' : 'slash-back'}`;
        div.appendChild(bar);
        div.addEventListener('click', () => {
          if (solved) return;
          mirrors[key] = mirrors[key] === '/' ? '\\' : '/';
          moves++;
          playTone(mirrors[key] === '/' ? 440 : 370, 0.05);
          render();
          const nextTrace = traceBeam(puzzle.cells, mirrors);
          if (nextTrace.solved) {
            void onSolved(nextTrace);
          }
        });
      }
      grid.appendChild(div);
    }
  }

  renderBeamSvg(trace.path, trace.solved);
  document.getElementById('stat-moves')!.textContent = String(moves);
  document.getElementById('stat-streak')!.textContent = `${streak}🔥`;
  document.getElementById('cp-progress')!.textContent = `${trace.litCheckpoints} / ${trace.totalCheckpoints}`;

  const statusTitle = document.getElementById('status-title')!;
  if (trace.solved) {
    statusTitle.textContent = '✅ Circuit Complete! All Checkpoints Verified';
  } else if (trace.reachedTarget) {
    statusTitle.textContent = `⚠️ Hit Target early — missed ${trace.totalCheckpoints - trace.litCheckpoints} checkpoint(s)`;
  } else if (trace.terminatedBy === 'wall') {
    statusTitle.textContent = '🧱 Beam blocked by wall — rotate mirrors!';
  } else {
    statusTitle.textContent = '⚡ Route the beam through every 💎 into 🎯';
  }
}

document.getElementById('btn-reset')!.addEventListener('click', () => {
  if (solved) return;
  mirrors = { ...initialMirrors };
  moves = 0;
  playTone(260, 0.06);
  render();
});

document.getElementById('btn-sound')!.addEventListener('click', (e) => {
  sfxEnabled = !sfxEnabled;
  (e.currentTarget as HTMLButtonElement).textContent = sfxEnabled ? '🔊 SFX On' : '🔇 Muted';
});

document.getElementById('btn-mode-daily')!.addEventListener('click', () => {
  mode = 'daily';
  document.getElementById('btn-mode-daily')!.classList.add('active');
  document.getElementById('btn-mode-practice')!.classList.remove('active');
  loadPuzzleState(generateDailyPuzzle(getUtcDateKey()));
});

document.getElementById('btn-mode-practice')!.addEventListener('click', () => {
  mode = 'practice';
  document.getElementById('btn-mode-practice')!.classList.add('active');
  document.getElementById('btn-mode-daily')!.classList.remove('active');
  practiceSeedIdx++;
  loadPuzzleState(generateDailyPuzzle(`practice-${practiceSeedIdx}`));
});

document.getElementById('btn-next-practice')!.addEventListener('click', () => {
  practiceSeedIdx++;
  loadPuzzleState(generateDailyPuzzle(`practice-${practiceSeedIdx}`));
});

document.getElementById('btn-copy-share')!.addEventListener('click', async () => {
  if (!latestShareCard) return;
  await navigator.clipboard.writeText(latestShareCard);
  const btn = document.getElementById('btn-copy-share')!;
  btn.textContent = '✅ Copied!';
  setTimeout(() => { btn.textContent = '📋 Copy Result Card'; }, 1500);
});

document.getElementById('btn-reddit-comment')!.addEventListener('click', async () => {
  const btn = document.getElementById('btn-reddit-comment') as HTMLButtonElement;
  btn.disabled = true;
  try {
    const res = await fetch('/api/share-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareCard: latestShareCard }),
    });
    btn.textContent = res.ok ? '✅ Posted to Comments!' : '⚠️ Comment Failed';
  } catch {
    btn.textContent = '⚠️ Devvit Only';
  }
});

async function boot() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      if (data?.mode === 'devvit' && data.puzzle) {
        devvitActive = true;
        streak = data.streak || 0;
        renderLeaderboard(data.leaderboard || []);
        loadPuzzleState(data.puzzle);
        return;
      }
    }
  } catch {
    // Standalone browser / GitHub Pages mode
  }
  loadPuzzleState(generateDailyPuzzle(getUtcDateKey()));
}

void boot();
