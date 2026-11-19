import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDailyPuzzle,
  traceBeam,
  reflectDirection,
  buildSpoilerFreeShareCard,
  type MirrorSlash,
} from '../src/shared/puzzle.ts';

test('reflectDirection handles / and \\ accurately across all 4 cardinal directions', () => {
  assert.equal(reflectDirection('R', '/'), 'U');
  assert.equal(reflectDirection('U', '/'), 'R');
  assert.equal(reflectDirection('L', '/'), 'D');
  assert.equal(reflectDirection('D', '/'), 'L');

  assert.equal(reflectDirection('R', '\\'), 'D');
  assert.equal(reflectDirection('D', '\\'), 'R');
  assert.equal(reflectDirection('L', '\\'), 'U');
  assert.equal(reflectDirection('U', '\\'), 'L');
});

test('daily puzzle generator is deterministic for a given UTC date', () => {
  const p1 = generateDailyPuzzle('2026-11-19');
  const p2 = generateDailyPuzzle('2026-11-19');
  assert.deepEqual(p1, p2);
});

test('generated daily puzzles across 30 consecutive days are unsolved initially and strictly solvable at parMoves', () => {
  for (let day = 1; day <= 30; day++) {
    const dd = String(day).padStart(2, '0');
    const dateKey = `2026-11-${dd}`;
    const puzzle = generateDailyPuzzle(dateKey);

    assert.equal(puzzle.size, 5);
    assert.ok(puzzle.parMoves >= 3, `${dateKey} parMoves too low: ${puzzle.parMoves}`);
    assert.ok(puzzle.checkpointCount >= 2, `${dateKey} checkpointCount too low`);

    // Initial scrambled board MUST NOT already be solved
    const initialTrace = traceBeam(puzzle.cells);
    assert.equal(initialTrace.solved, false, `${dateKey} started already solved`);

    // Solution mirror configuration MUST hit every checkpoint & reach target
    const solutionOverrides: Record<string, MirrorSlash> = {};
    for (const coord of puzzle.mirrorCoords) {
      const cell = puzzle.cells[coord.row][coord.col];
      solutionOverrides[`${coord.row},${coord.col}`] = cell.solutionMirror ?? '/';
    }
    const solvedTrace = traceBeam(puzzle.cells, solutionOverrides);
    assert.equal(solvedTrace.solved, true, `${dateKey} failed to solve with solutionMirrors`);
    assert.equal(solvedTrace.litCheckpoints, puzzle.checkpointCount);
    assert.equal(solvedTrace.reachedTarget, true);
  }
});

test('spoiler-free share card formats puzzle number, par score, and 5x5 grid cleanly', () => {
  const puzzle = generateDailyPuzzle('2026-11-19');
  const trace = traceBeam(puzzle.cells);
  const card = buildSpoilerFreeShareCard({
    puzzle,
    trace,
    moves: puzzle.parMoves,
    elapsedSec: 18,
    streak: 5,
  });
  assert.match(card, /Signal Lock #19 \(2026-11-19\) ⭐⭐⭐/);
  assert.match(card, /🔥 5d streak/);
  assert.ok(card.includes('⚡') && card.includes('🎯'));
});
