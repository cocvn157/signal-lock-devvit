import express from 'express';
import { createServer, getServerPort, redis, reddit, context } from '@devvit/web/server';
import {
  generateDailyPuzzle,
  getUtcDateKey,
  traceBeam,
  buildSpoilerFreeShareCard,
  type MirrorSlash,
} from '../shared/puzzle.js';

const app = express();
app.use(express.json());

interface LeaderboardEntry {
  username: string;
  moves: number;
  elapsedSec: number;
  streak: number;
}

function getPrevDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

app.get('/api/state', async (_req, res) => {
  try {
    const dateKey = getUtcDateKey();
    const puzzle = generateDailyPuzzle(dateKey);
    const user = await reddit.getCurrentUser().catch(() => null);
    const username = user?.username || 'redditor';

    const streakKey = `streak:${username}`;
    const lastSolvedKey = `last_solved:${username}`;
    const solvedKey = `solved:${dateKey}:${username}`;
    const lbKey = `leaderboard:${dateKey}`;

    const [streakRaw, lastSolved, solvedRaw, lbRaw] = await Promise.all([
      redis.get(streakKey),
      redis.get(lastSolvedKey),
      redis.get(solvedKey),
      redis.get(lbKey),
    ]);

    const prevDay = getPrevDateKey(dateKey);
    let streak = parseInt(streakRaw || '0', 10);
    if (lastSolved && lastSolved !== dateKey && lastSolved !== prevDay) {
      streak = 0;
    }

    const leaderboard: LeaderboardEntry[] = lbRaw ? JSON.parse(lbRaw) : [];

    res.json({
      mode: 'devvit',
      username,
      dateKey,
      puzzle,
      streak,
      todayResult: solvedRaw ? JSON.parse(solvedRaw) : null,
      leaderboard: leaderboard.slice(0, 10),
    });
  } catch (err) {
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'Failed to load daily state' });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const {
      mirrors,
      moves,
      elapsedSec,
    } = req.body as {
      mirrors: Record<string, MirrorSlash>;
      moves: number;
      elapsedSec: number;
    };

    const dateKey = getUtcDateKey();
    const puzzle = generateDailyPuzzle(dateKey);
    const trace = traceBeam(puzzle.cells, mirrors);

    if (!trace.solved) {
      res.status(400).json({ error: 'Submitted mirror configuration does not solve the puzzle', trace });
      return;
    }

    const user = await reddit.getCurrentUser().catch(() => null);
    const username = user?.username || 'redditor';
    const streakKey = `streak:${username}`;
    const lastSolvedKey = `last_solved:${username}`;
    const solvedKey = `solved:${dateKey}:${username}`;
    const lbKey = `leaderboard:${dateKey}`;

    const [alreadySolved, lastSolved, streakRaw, lbRaw] = await Promise.all([
      redis.get(solvedKey),
      redis.get(lastSolvedKey),
      redis.get(streakKey),
      redis.get(lbKey),
    ]);

    let streak = parseInt(streakRaw || '0', 10);
    if (!alreadySolved) {
      const prevDay = getPrevDateKey(dateKey);
      streak = lastSolved === prevDay ? streak + 1 : 1;
      await Promise.all([
        redis.set(streakKey, String(streak)),
        redis.set(lastSolvedKey, dateKey),
      ]);
    }

    const safeMoves = Math.max(puzzle.parMoves, Math.floor(Number(moves) || puzzle.parMoves));
    const safeElapsed = Math.max(1, Math.floor(Number(elapsedSec) || 1));
    const resultRecord = {
      moves: safeMoves,
      elapsedSec: safeElapsed,
      streak,
      solvedAt: new Date().toISOString(),
    };

    if (!alreadySolved) {
      await redis.set(solvedKey, JSON.stringify(resultRecord));
    }

    const leaderboard: LeaderboardEntry[] = lbRaw ? JSON.parse(lbRaw) : [];
    const existingIdx = leaderboard.findIndex((e) => e.username === username);
    const entry: LeaderboardEntry = { username, moves: safeMoves, elapsedSec: safeElapsed, streak };
    if (existingIdx >= 0) {
      if (
        entry.moves < leaderboard[existingIdx].moves ||
        (entry.moves === leaderboard[existingIdx].moves && entry.elapsedSec < leaderboard[existingIdx].elapsedSec)
      ) {
        leaderboard[existingIdx] = entry;
      }
    } else {
      leaderboard.push(entry);
    }
    leaderboard.sort((a, b) => a.moves - b.moves || a.elapsedSec - b.elapsedSec);
    await redis.set(lbKey, JSON.stringify(leaderboard.slice(0, 50)));

    // Try setting user flair badge when running inside a configured subreddit
    if (context.subredditName && username !== 'redditor') {
      await reddit
        .setUserFlair({
          subredditName: context.subredditName,
          username,
          text: `⚡ ${streak}d Signal Streak`,
        })
        .catch(() => {});
    }

    const shareCard = buildSpoilerFreeShareCard({
      puzzle,
      trace,
      moves: safeMoves,
      elapsedSec: safeElapsed,
      streak,
    });

    res.json({
      ok: true,
      streak,
      shareCard,
      leaderboard: leaderboard.slice(0, 10),
    });
  } catch (err) {
    console.error('POST /api/submit error:', err);
    res.status(500).json({ error: 'Failed to submit solution' });
  }
});

app.post('/api/share-comment', async (req, res) => {
  try {
    const { shareCard } = req.body as { shareCard?: string };
    if (!shareCard || !context.postId) {
      res.status(400).json({ error: 'Missing shareCard or postId' });
      return;
    }
    await reddit.submitComment({
      id: context.postId,
      text: shareCard,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/share-comment error:', err);
    res.status(500).json({ error: 'Failed to post Reddit comment' });
  }
});

async function createSignalLockPost() {
  const dateKey = getUtcDateKey();
  return reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Signal Lock — Daily Laser Puzzle (${dateKey})`,
    entry: 'default',
  });
}

app.post('/internal/on-app-install', async (_req, res) => {
  try {
    const post = await createSignalLockPost();
    res.json({ status: 'ok', postId: post.id, url: post.url });
  } catch (err) {
    console.error('POST /internal/on-app-install error:', err);
    res.status(500).json({ error: 'Failed to create Signal Lock post on install' });
  }
});

app.post('/internal/menu/post-create', async (_req, res) => {
  try {
    const post = await createSignalLockPost();
    const shortId = post.id.replace(/^t3_/, '');
    res.json({
      navigateTo: post.url || `https://reddit.com/r/${context.subredditName}/comments/${shortId}`,
    });
  } catch (err) {
    console.error('POST /internal/menu/post-create error:', err);
    res.status(400).json({ status: 'error', message: 'Failed to create post' });
  }
});

const server = createServer(app);
server.on('error', (err) => console.error(`Server error: ${err.stack}`));
server.listen(getServerPort());
