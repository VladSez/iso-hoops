# CLAUDE.md

Neighborhood Hoops: an isometric pixel-art basketball game that runs in the browser. Plain ES modules in `dist/`, no dependencies, no build step. Live at https://vladsez.github.io/iso-hoops/. README.md describes features and controls for players.

## Commands

- `node serve.mjs` serves `dist/` at http://127.0.0.1:5300. In the Claude desktop app, start it with `preview_start`, from a `.claude/launch.json` entry that runs `node serve.mjs` on port 5300 (create the file if it's missing; it isn't committed).
- `node --test` runs every test in `test/`. CI runs the same on each pull request and push to `main`.

## Browser

Use the built-in browser (the Claude desktop app's browser pane) to open, test and screenshot the game. Use another browser, such as Claude in Chrome or Playwright, only when asked.

Before building a visual or UI change, ask whether to design it first on a canvas artifact. If the answer is yes, build only after the design is agreed.

After a visual or UI change, don't make before/after screenshots or videos for the reply. Instead, start the game yourself in the browser pane, set any localStorage keys the feature needs (see Running the game), and give the user the URL, http://127.0.0.1:5300, plus step-by-step instructions for trying the new feature, with a screenshot of the key steps:

1. What to do, one action per step (which key to hold and for how long, where to walk, which menu to open).
2. What to look for at each step, so the user can tell it works.

Before/after media belongs only in pull requests, captured by the `pr-description` skill.

## Running the game

Start the game with sound off. Before the page loads, set the saved sound setting in localStorage, then reload:

```js
localStorage.setItem('iso-hoops:sound-mode', 'off')
```

Keep sound off whenever you start or reload the game in the browser pane, including when you hand it over for the user to play. Don't remove the key afterwards. This only affects the browser pane. The game's default for players stays sound on.

The same way, open straight into a state by setting these keys before load:

| Key | Values |
| --- | --- |
| `iso-hoops:court` | `neighborhood`, `rooftop`, `beach`, `autumn`, `winter` |
| `iso-hoops:time` | `auto`, `morning`, `day`, `evening`, `night` |
| `iso-hoops:mode` | `free`, `free-throws`, `clock`, `horse`, `three-point` |
| `iso-hoops:sound-mode` | `all`, `effects`, `off` |

Best scores live in `iso-hoops:free-throw-best`, `iso-hoops:clock-best-points`, `iso-hoops:horse-best`, `iso-hoops:three-point-best` and `iso-hoops:longest-basket`. Seed one to show a realistic score.

The meter's fill speed is random each shot (`rollChargeTime` in `physics.js`). To time a shot, set `Math.random = () => 0.5` in the page first; that gives the old fixed speed, 1.6 s to full, and a 2 m/s tailwind. Then in free throws mode, holding Space for about 620 ms usually makes the shot, and a 60 ms tap misses.

## Where things live

- `dist/game.js`: the game loop, input, menus, court props, lighting and audio. Most changes land here.
- `dist/engine.js`: the renderer, vendored from Pixel Plays (MIT). It is a classic script whose top-level names (`pix`, `plot`, `project`, `unproject`, `castShadow`, `hash`) are globals that `game.js` uses. Change it only when you must, and keep its two-space style.
- `dist/physics.js`, `free-throws.js`, `beat-the-clock.js`, `horse.js`, `three-point.js`: pure rules for the ball and each mode. Each has a test file in `test/`.
- `dist/results.js`: what each mode's results card shows when a round ends, built from the round's shot log in `game.js`.
- `dist/courts.js`: one data entry per court (palette, sound, lighting settings, rim bounciness). Add per-court behaviour here as data, not as branches in `game.js`.
- `dist/time-of-day.js`: the phase table (morning, day, evening, night) and today's schedule from sunrise and sunset. `dist/places.js` holds reference coordinates for Europe, the US, Turkey and the most populous zones elsewhere (other zones are estimated from their UTC offset), generated from tzdb's `zone.tab` and `backward`; regenerate it with `node scripts/build-places.mjs` rather than editing by hand. `game.js` saves today's schedule as `iso-hoops:sky` so the early script in `index.html` paints the right sky.
- `dist/music.js`: the music, generated sample by sample with no audio files.
- `dist/style.css`: colours are CSS variables on `:root`, and each phase overrides them under `[data-phase="…"]`. Use the variables, not hex values.
- `dist/sw.js`: the service worker for offline play.

## Rules that break the deploy if missed

- When you change a file in `dist/` that the page loads, bump its `?v=` string everywhere it appears: `dist/index.html` for `style.css`, `engine.js` and `game.js`, and the `import` lines for modules (for example `./courts.js?v=6`).
- `FILES` in `dist/sw.js` must list exactly the files the page loads, with the same `?v=` strings. `test/offline.test.js` fails otherwise. Bump `VERSION` in `sw.js` when `index.html` changes.
- A new module needs its own `?v=1`, an entry in `FILES`, and a file that exists in `dist/`.

## Style

- Tabs, no semicolons and single quotes in the game's own files.
- Comments only for a reason the code can't show.
- Copy for players is plain and calm, like the existing feedback lines.
- After finishing a feature or fixing a bug, end the reply with a summary of what you did in simple terms: what a player now gets, what changed in tests or docs, and what is still not done (for example, nothing committed). Skip it for minor changes, such as a wording tweak, a one-line edit or a docs update.

## Shipping

- Commit messages: a sentence-case title saying what a player now gets, then bullet points. See `git log`.
- Open pull requests with the `pr-description` skill in `.claude/skills/`. It captures before/after screenshots and a clip.
- Every pull request gets a preview at `https://vladsez.github.io/iso-hoops/pr-preview/pr-<number>/`. Merging to `main` deploys `dist/` to GitHub Pages automatically.
- When you learn in this session that its PR has merged (the user says so, or the PR status or a CI event shows it), ask whether to archive the session and remove its worktree to free disk space. Do it only on a yes.
- Check the phone layout (portrait and landscape) for any header, footer or menu change. Touch screens use separate layouts in `style.css` under `@media (pointer: coarse)`.
- Don't commit plan files. Once everything in a plan is built, ask before deleting it.
