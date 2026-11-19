# ⚡ Signal Lock — Daily 5×5 Laser Mirror Puzzle (Reddit Devvit Web)

Built for **Reddit's Game of the Day Hackathon** (`$35,000 USD` prize pool) using **Devvit Web** (`@devvit/web@0.15.4`).

## ✨ Core Gameplay & Reddit Integration
- **Deterministic Daily Puzzle (`src/shared/puzzle.ts`):** Every day at 00:00 UTC, all Redditors play the exact same 5×5 laser-mirror grid guaranteed solvable with an exact mathematical `Par` score (`>= 3` moves).
- **Zero-Spoiler Comment Share Card:** Solvers copy or one-click post a clean emoji grid (`⚡ 💎 🪞 🧱 🎯`) directly to the Interactive Post's Reddit comments without spoiling mirror orientations.
- **Server-Verified Redis Streaks & Subreddit Leaderboard (`src/server/index.ts`):** Replays submitted mirror states server-side via `traceBeam()`, tracks daily UTC streaks in `@devvit/web` Redis, ranks daily solvers by `(moves, elapsedSec)`, and awards user streak flair (`⚡ Nd Signal Streak`).
- **Dual Mode:** Runs as a native **Reddit Devvit Interactive Post** AND includes a standalone playable web mode + **Endless Practice** generator + Web Audio API synth sound effects.

## 🧪 Build & Test

```bash
npm install
npm test        # Runs 30-day consecutive puzzle solvability & parity checks
npm run build   # Builds dist/client (Vite) + dist/server/index.cjs (esbuild)
```

## 🚀 Deploy to Reddit (Devvit)

```bash
npx devvit login
npx devvit playtest <your-test-subreddit>
```
