# Signal Lock — Devpost Submission & Readiness Checklist

**Hackathon:** Reddit Daily Games Hackathon ($35,000 USD Prize Pool)  
**Deadline:** December 8, 2026  
**Project Name:** Signal Lock — Daily 5×5 Laser Mirror Puzzle  
**GitHub Repo:** https://github.com/cocvn157/signal-lock-devvit  
**Live Standalone Playable Preview:** https://cocvn157.github.io/signal-lock-devvit/  
**Media Assets in Repo:** [`screenshot.png`](./screenshot.png) (1280×720) · [`demo.mp4`](./demo.mp4) (1280×720 walkthrough)

---

## ✅ Pre-Submission Verification Status

- **`devvit.json` (`v1` schema):** Aligned to `https://developers.reddit.com/schema/config-file.v1.json` (`post.dir: "dist/client"`, `post.entrypoints.default`, `server.dir: "dist/server"`, `server.entry: "index.cjs"`, `permissions: { redis: true, reddit: true }`, `triggers.onAppInstall: "/internal/on-app-install"`, `menu.items[0].endpoint: "/internal/menu/post-create"`).
- **Server Endpoints (`src/server/index.ts`):**
  - `GET /api/state` — loads today's deterministic UTC puzzle, Redis streak, and top-10 subreddit leaderboard.
  - `POST /api/submit` — server-side beam validation (`traceBeam`), Redis streak & leaderboard update, user streak flair (`⚡ Nd Signal Streak`), and spoiler-free emoji card generation.
  - `POST /api/share-comment` — one-click posts the zero-spoiler emoji result card to the Interactive Post's comments.
  - `POST /internal/on-app-install` & `POST /internal/menu/post-create` — creates Interactive Posts via `reddit.submitCustomPost` and returns a clean `navigateTo` post URL.
- **Standalone / Client Preview (`src/client/main.ts`):** Probes `GET /api/state` on boot for Devvit runtime and falls back seamlessly to standalone browser mode (`localStorage` streaks, Endless Practice mode, Web Audio API synth SFX) on GitHub Pages and local HTTP previews.
- **Typecheck, Build & Tests:**
  - `npx.cmd tsc --noEmit` — passes with 0 errors
  - `npm.cmd run build` — builds `dist/client/` (Vite) and `dist/server/index.cjs` (esbuild CJS)
  - `npm.cmd test` — 4/4 automated tests passing (`tests/puzzle.test.ts`, verifying 30 consecutive daily puzzles for determinism, unsolved start state, `parMoves >= 3`, and full checkpoint solvability)
  - `screenshot.png` — verified 1280×720 headless render of `dist/client/index.html`

---

## 🚀 Remaining Manual Steps (Copy & Paste in PowerShell)

Run these commands inside `C:\Users\NITRO\.gemini\antigravity\scratch\signal-lock-devvit`:

### 1. Log in to Reddit Devvit CLI
```powershell
npx.cmd devvit login
```

### 2. Build & Upload App to Devvit
```powershell
npm.cmd run build
npx.cmd devvit upload
```

### 3. Run Playtest & Create Test Post in Your Test Subreddit (<200 subscribers)
```powershell
npx.cmd devvit playtest <your-test-subreddit>
```
1. Wait for Devvit to install the app on `r/<your-test-subreddit>`.
2. Open `https://www.reddit.com/r/<your-test-subreddit>/` — `onAppInstall` automatically creates today's Signal Lock Interactive Post, or use the subreddit moderator menu **"Create Signal Lock Daily Post"** (`/internal/menu/post-create`).
3. Play & solve the puzzle on Reddit, test **"💬 Post to Comments"**, and copy the live Reddit post URL for Devpost.

### 4. Record Short YouTube Demo Video
- Record a 60–90s screen capture playing **Signal Lock** inside the Reddit Interactive Post (you can also reuse/combine [`demo.mp4`](./demo.mp4)) and upload it to YouTube (Public or Unlisted) for the Devpost video URL field.

### 5. Submit on Devpost (Before December 8, 2026)
- Upload [`screenshot.png`](./screenshot.png) to the Devpost image gallery.
- Paste your Reddit Interactive Post URL, GitHub repo URL, live demo URL, YouTube video link, and the copy below.

---

## 📝 Copy-Paste Devpost Form Text

### Tagline (Short Pitch)
> A daily 5×5 laser-mirror logic puzzle built natively on Reddit Devvit Web — solve today's grid in Par moves, keep your UTC streak flair, and share zero-spoiler emoji cards to the comments.

### Inspiration
Daily puzzles thrive on Reddit when every player gets the exact same challenge and can compare scores in the comments without spoiling the solution. **Signal Lock** brings a crisp, tactile optical circuit puzzle straight into the Reddit feed using `@devvit/web`.

### What It Does
- **Deterministic Daily 5×5 Grid:** Every day at 00:00 UTC, all Redditors face the exact same seeded 5×5 laser puzzle (`src/shared/puzzle.ts`) mathematically verified to require `>= 3` optimal moves (`Par`).
- **Route Through Every Checkpoint (`💎` -> `🎯`):** Tap mirrors (`/` or `\`) to bounce the cyan laser beam around walls (`🧱`), lighting every checkpoint before hitting the target core.
- **Server-Verified Streaks, Leaderboards & Flair:** `POST /api/submit` re-traces submitted mirror layouts server-side in Express (`@devvit/web/server`), stores UTC streaks and daily top-10 rankings in Devvit Redis, and updates the solver's subreddit flair (`⚡ Nd Signal Streak`).
- **Zero-Spoiler Comment Share Card:** Solvers can copy or one-click post an emoji grid (`⚡ 💎 🪞 ⬛ 🎯`) directly into the post comments (`POST /api/share-comment`) without revealing mirror angles.
- **Endless Practice & Synth Audio:** Includes an infinite practice seed generator and zero-asset Web Audio API sound effects.

### How We Built It
- **Platform:** Reddit Devvit Web (`@devvit/web@0.15.4`, `devvit@0.15.4`) with `config-file.v1.json` schema
- **Frontend:** TypeScript, HTML5/CSS Grid, SVG glowing laser overlay, Web Audio API synth (`Vite 6`)
- **Backend:** Express (`src/server/index.ts`) bundled via `esbuild` with Devvit Redis & Reddit API integrations
- **Shared Engine & Tests:** Pure deterministic generator + beam raytracer (`src/shared/puzzle.ts`) tested with Node's built-in test runner (`tests/puzzle.test.ts`)

### Challenges We Ran Into
Designing a fast procedural 5×5 puzzle generator that never produces trivial 0–2 move boards, loops, or unreachable checkpoints. We solved this by constructing a guaranteed valid bounce path first, placing checkpoints exclusively on unique traversed segments, scrambling mirror orientations, and running an exhaustive bitmask solver (`computeMinimumMoves`) to guarantee `parMoves >= 3`.

### What's Next
- Community-created custom 5×5 puzzle submissions in subreddit comments
- Weekly themed grids (double emitters and splitters) and head-to-head daily speedrun challenges
