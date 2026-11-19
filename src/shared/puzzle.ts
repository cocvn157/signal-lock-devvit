export type Direction = 'U' | 'R' | 'D' | 'L';
export type MirrorSlash = '/' | '\\';
export type CellKind = 'empty' | 'emitter' | 'target' | 'wall' | 'checkpoint' | 'mirror';

export interface Cell {
  row: number;
  col: number;
  kind: CellKind;
  emitterDir?: Direction;
  mirror?: MirrorSlash;
  solutionMirror?: MirrorSlash;
}

export interface DailyPuzzle {
  dateKey: string;
  puzzleNumber: number;
  size: number;
  parMoves: number;
  cells: Cell[][];
  mirrorCoords: Array<{ row: number; col: number }>;
  checkpointCount: number;
}

export interface BeamPoint {
  row: number;
  col: number;
  dir: Direction;
}

export interface TraceResult {
  path: BeamPoint[];
  litCheckpoints: number;
  totalCheckpoints: number;
  reachedTarget: boolean;
  solved: boolean;
  terminatedBy: 'target' | 'wall' | 'oob' | 'loop';
}

const DIR_DELTA: Record<Direction, [number, number]> = {
  U: [-1, 0],
  R: [0, 1],
  D: [1, 0],
  L: [0, -1],
};

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seedStr: string): () => number {
  let state = hashSeed(seedStr) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getPuzzleNumber(dateKey: string): number {
  const epoch = Date.UTC(2026, 10, 1); // Nov 1, 2026 launch epoch
  const [y, m, d] = dateKey.split('-').map(Number);
  const current = Date.UTC(y, m - 1, d);
  return Math.max(1, Math.floor((current - epoch) / 86400000) + 1);
}

export function reflectDirection(dir: Direction, slash: MirrorSlash): Direction {
  if (slash === '/') {
    if (dir === 'R') return 'U';
    if (dir === 'U') return 'R';
    if (dir === 'L') return 'D';
    return 'L';
  }
  // slash === '\'
  if (dir === 'R') return 'D';
  if (dir === 'D') return 'R';
  if (dir === 'L') return 'U';
  return 'L';
}

export function traceBeam(
  cells: Cell[][],
  mirrorOverrides?: Record<string, MirrorSlash>
): TraceResult {
  const size = cells.length;
  let emitter: Cell | null = null;
  let totalCheckpoints = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c].kind === 'emitter') emitter = cells[r][c];
      if (cells[r][c].kind === 'checkpoint') totalCheckpoints++;
    }
  }

  if (!emitter || !emitter.emitterDir) {
    return {
      path: [],
      litCheckpoints: 0,
      totalCheckpoints,
      reachedTarget: false,
      solved: false,
      terminatedBy: 'oob',
    };
  }

  let row = emitter.row;
  let col = emitter.col;
  let dir: Direction = emitter.emitterDir;
  const path: BeamPoint[] = [{ row, col, dir }];
  const seenStates = new Set<string>();
  const litCheckpointsSet = new Set<string>();

  for (let step = 0; step < size * size * 4 + 4; step++) {
    const [dr, dc] = DIR_DELTA[dir];
    row += dr;
    col += dc;

    if (row < 0 || row >= size || col < 0 || col >= size) {
      return {
        path,
        litCheckpoints: litCheckpointsSet.size,
        totalCheckpoints,
        reachedTarget: false,
        solved: false,
        terminatedBy: 'oob',
      };
    }

    const stateKey = `${row},${col},${dir}`;
    if (seenStates.has(stateKey)) {
      return {
        path,
        litCheckpoints: litCheckpointsSet.size,
        totalCheckpoints,
        reachedTarget: false,
        solved: false,
        terminatedBy: 'loop',
      };
    }
    seenStates.add(stateKey);

    const cell = cells[row][col];
    path.push({ row, col, dir });

    if (cell.kind === 'wall') {
      return {
        path,
        litCheckpoints: litCheckpointsSet.size,
        totalCheckpoints,
        reachedTarget: false,
        solved: false,
        terminatedBy: 'wall',
      };
    }

    if (cell.kind === 'checkpoint') {
      litCheckpointsSet.add(`${row},${col}`);
    }

    if (cell.kind === 'target') {
      const litCount = litCheckpointsSet.size;
      return {
        path,
        litCheckpoints: litCount,
        totalCheckpoints,
        reachedTarget: true,
        solved: litCount === totalCheckpoints,
        terminatedBy: 'target',
      };
    }

    if (cell.kind === 'mirror') {
      const slash = mirrorOverrides?.[`${row},${col}`] ?? cell.mirror ?? '/';
      dir = reflectDirection(dir, slash);
    }
  }

  return {
    path,
    litCheckpoints: litCheckpointsSet.size,
    totalCheckpoints,
    reachedTarget: false,
    solved: false,
    terminatedBy: 'loop',
  };
}

function buildFallbackPuzzle(dateKey: string): DailyPuzzle {
  const size = 5;
  const cells: Cell[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({ row: r, col: c, kind: 'empty' as CellKind }))
  );

  cells[0][0] = { row: 0, col: 0, kind: 'emitter', emitterDir: 'R' };
  cells[0][2] = { row: 0, col: 2, kind: 'checkpoint' };
  cells[0][4] = { row: 0, col: 4, kind: 'mirror', mirror: '/', solutionMirror: '\\' };
  cells[2][4] = { row: 2, col: 4, kind: 'checkpoint' };
  cells[4][4] = { row: 4, col: 4, kind: 'mirror', mirror: '\\', solutionMirror: '/' };
  cells[4][1] = { row: 4, col: 1, kind: 'mirror', mirror: '/', solutionMirror: '\\' };
  cells[2][1] = { row: 2, col: 1, kind: 'mirror', mirror: '\\', solutionMirror: '/' };
  cells[2][2] = { row: 2, col: 2, kind: 'checkpoint' };
  cells[2][3] = { row: 2, col: 3, kind: 'target' };
  cells[1][1] = { row: 1, col: 1, kind: 'wall' };
  cells[3][3] = { row: 3, col: 3, kind: 'wall' };

  const mirrorCoords = [
    { row: 0, col: 4 },
    { row: 4, col: 4 },
    { row: 4, col: 1 },
    { row: 2, col: 1 },
  ];

  return {
    dateKey,
    puzzleNumber: getPuzzleNumber(dateKey),
    size,
    parMoves: 4,
    cells,
    mirrorCoords,
    checkpointCount: 3,
  };
}

function computeMinimumMoves(cells: Cell[][], mirrorCoords: Array<{ row: number; col: number }>): number {
  const n = mirrorCoords.length;
  let best = Infinity;
  const totalMasks = 1 << n;
  for (let mask = 0; mask < totalMasks; mask++) {
    const overrides: Record<string, MirrorSlash> = {};
    let flips = 0;
    for (let i = 0; i < n; i++) {
      const { row, col } = mirrorCoords[i];
      const initial = cells[row][col].mirror ?? '/';
      if ((mask & (1 << i)) !== 0) {
        overrides[`${row},${col}`] = initial === '/' ? '\\' : '/';
        flips++;
      } else {
        overrides[`${row},${col}`] = initial;
      }
    }
    if (flips >= best) continue;
    if (traceBeam(cells, overrides).solved) {
      best = flips;
    }
  }
  return Number.isFinite(best) ? best : -1;
}

export function generateDailyPuzzle(dateKey: string): DailyPuzzle {
  const size = 5;
  const rng = createRng(`signal-lock::${dateKey}`);
  const dirs: Direction[] = ['U', 'R', 'D', 'L'];

  for (let attempt = 0; attempt < 250; attempt++) {
    const cells: Cell[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => ({ row: r, col: c, kind: 'empty' as CellKind }))
    );

    const startEdge = Math.floor(rng() * 4);
    let r = 0;
    let c = 0;
    let dir: Direction = 'R';
    if (startEdge === 0) {
      r = Math.floor(rng() * size);
      c = 0;
      dir = 'R';
    } else if (startEdge === 1) {
      r = 0;
      c = Math.floor(rng() * size);
      dir = 'D';
    } else if (startEdge === 2) {
      r = Math.floor(rng() * size);
      c = size - 1;
      dir = 'L';
    } else {
      r = size - 1;
      c = Math.floor(rng() * size);
      dir = 'U';
    }

    cells[r][c] = { row: r, col: c, kind: 'emitter', emitterDir: dir };
    const occupied = new Set<string>([`${r},${c}`]);
    const straightCells: Array<{ row: number; col: number }> = [];
    const mirrorList: Array<{ row: number; col: number; solution: MirrorSlash }> = [];

    const targetBounces = 4 + Math.floor(rng() * 3); // 4..6 mirrors
    let ok = true;

    for (let bounce = 0; bounce < targetBounces; bounce++) {
      const [dr, dc] = DIR_DELTA[dir];
      const candidates: number[] = [];
      for (let dist = 1; dist < size; dist++) {
        const nr = r + dr * dist;
        const nc = c + dc * dist;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
        const key = `${nr},${nc}`;
        if (cells[nr][nc].kind !== 'empty') break;
        if (!occupied.has(key)) candidates.push(dist);
      }
      if (candidates.length === 0) {
        ok = false;
        break;
      }

      // Prefer distances >= 2 when available for interesting geometry
      const longCandidates = candidates.filter((d) => d >= 2);
      const pool = longCandidates.length > 0 ? longCandidates : candidates;
      const dist = pool[Math.floor(rng() * pool.length)];

      for (let step = 1; step < dist; step++) {
        const sr = r + dr * step;
        const sc = c + dc * step;
        if (!occupied.has(`${sr},${sc}`)) {
          straightCells.push({ row: sr, col: sc });
        }
        occupied.add(`${sr},${sc}`);
      }

      r += dr * dist;
      c += dc * dist;
      occupied.add(`${r},${c}`);

      const slashChoices: MirrorSlash[] = rng() < 0.5 ? ['/', '\\'] : ['\\', '/'];
      // Pick turn direction that stays inside grid at least 1 cell
      let chosenSlash: MirrorSlash | null = null;
      for (const s of slashChoices) {
        const nextDir = reflectDirection(dir, s);
        const [ndr, ndc] = DIR_DELTA[nextDir];
        const nr = r + ndr;
        const nc = c + ndc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && cells[nr][nc].kind === 'empty') {
          chosenSlash = s;
          dir = nextDir;
          break;
        }
      }
      if (!chosenSlash) {
        ok = false;
        break;
      }
      cells[r][c] = { row: r, col: c, kind: 'mirror', mirror: chosenSlash, solutionMirror: chosenSlash };
      mirrorList.push({ row: r, col: c, solution: chosenSlash });
    }

    if (!ok || mirrorList.length < 4) continue;

    // Place final target along final dir
    const [fdr, fdc] = DIR_DELTA[dir];
    const targetDistances: number[] = [];
    for (let dist = 1; dist < size; dist++) {
      const tr = r + fdr * dist;
      const tc = c + fdc * dist;
      if (tr < 0 || tr >= size || tc < 0 || tc >= size) break;
      if (cells[tr][tc].kind !== 'empty') break;
      if (!occupied.has(`${tr},${tc}`)) targetDistances.push(dist);
    }
    if (targetDistances.length === 0) continue;

    const finalDist = targetDistances[Math.floor(rng() * targetDistances.length)];
    for (let step = 1; step < finalDist; step++) {
      const sr = r + fdr * step;
      const sc = c + fdc * step;
      straightCells.push({ row: sr, col: sc });
      occupied.add(`${sr},${sc}`);
    }
    const tr = r + fdr * finalDist;
    const tc = c + fdc * finalDist;
    cells[tr][tc] = { row: tr, col: tc, kind: 'target' };
    occupied.add(`${tr},${tc}`);

    // Place 2-3 checkpoints on unique traversed non-mirror cells
    const uniqueStraight = Array.from(
      new Map(straightCells.map((p) => [`${p.row},${p.col}`, p])).values()
    ).filter((p) => cells[p.row][p.col].kind === 'empty');

    if (uniqueStraight.length < 2) continue;
    for (let i = uniqueStraight.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [uniqueStraight[i], uniqueStraight[j]] = [uniqueStraight[j], uniqueStraight[i]];
    }
    const checkpointCount = Math.min(3, uniqueStraight.length);
    for (let i = 0; i < checkpointCount; i++) {
      const cp = uniqueStraight[i];
      cells[cp.row][cp.col] = { row: cp.row, col: cp.col, kind: 'checkpoint' };
    }

    // Add 3-5 walls on completely unused empty cells
    const unused: Array<{ row: number; col: number }> = [];
    for (let rr = 0; rr < size; rr++) {
      for (let cc = 0; cc < size; cc++) {
        if (!occupied.has(`${rr},${cc}`) && cells[rr][cc].kind === 'empty') {
          unused.push({ row: rr, col: cc });
        }
      }
    }
    for (let i = unused.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [unused[i], unused[j]] = [unused[j], unused[i]];
    }
    const wallCount = Math.min(4, unused.length);
    for (let i = 0; i < wallCount; i++) {
      cells[unused[i].row][unused[i].col] = { row: unused[i].row, col: unused[i].col, kind: 'wall' };
    }

    // Scramble mirrors so puzzle requires >= 3 flips to solve optimally
    const mirrorCoords = mirrorList.map(({ row, col }) => ({ row, col }));
    const solMap: Record<string, MirrorSlash> = {};
    for (const m of mirrorList) {
      solMap[`${m.row},${m.col}`] = m.solution;
      const flip = rng() < 0.72;
      cells[m.row][m.col].mirror = flip ? (m.solution === '/' ? '\\' : '/') : m.solution;
    }

    if (!traceBeam(cells, solMap).solved) continue;
    const parMoves = computeMinimumMoves(cells, mirrorCoords);
    if (parMoves >= 3) {
      return {
        dateKey,
        puzzleNumber: getPuzzleNumber(dateKey),
        size,
        parMoves,
        cells,
        mirrorCoords,
        checkpointCount,
      };
    }
  }

  return buildFallbackPuzzle(dateKey);
}

export function buildSpoilerFreeShareCard(params: {
  puzzle: DailyPuzzle;
  trace: TraceResult;
  moves: number;
  elapsedSec: number;
  streak: number;
}): string {
  const { puzzle, moves, elapsedSec, streak } = params;
  const stars = moves <= puzzle.parMoves ? '⭐⭐⭐' : moves <= puzzle.parMoves + 2 ? '⭐⭐' : '⭐';
  const rows: string[] = [];

  for (let r = 0; r < puzzle.size; r++) {
    let line = '';
    for (let c = 0; c < puzzle.size; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.kind === 'emitter') line += '⚡';
      else if (cell.kind === 'target') line += '🎯';
      else if (cell.kind === 'wall') line += '⬛';
      else if (cell.kind === 'mirror') line += '🪞';
      else if (cell.kind === 'checkpoint') line += '💎';
      else line += '🟩';
    }
    rows.push(line);
  }

  return [
    `⚡ Signal Lock #${puzzle.puzzleNumber} (${puzzle.dateKey}) ${stars}`,
    `Moves: ${moves} (Par ${puzzle.parMoves}) · ⏱️ ${elapsedSec}s · 🔥 ${streak}d streak`,
    '',
    ...rows,
  ].join('\n');
}
