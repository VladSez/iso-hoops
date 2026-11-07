# CLAUDE.md

Neighborhood Hoops: an isometric pixel-art basketball game that runs in the browser. Plain ES modules in `dist/`, no dependencies, no build step. Live at https://vladsez.github.io/iso-hoops/. README.md describes features and controls for players.

## Commands

- `node serve.mjs` serves `dist/` at http://127.0.0.1:5300. In the Claude desktop app, start it with `preview_start`, from a `.claude/launch.json` entry that runs `node serve.mjs` on port 5300 (create the file if it's missing; it isn't committed).
- `node --test` runs every test in `test/`. CI runs the same on each pull request and push to `main`.

## Browser

Use the built-in browser (the Claude desktop app's browser pane) to open, test and screenshot the game. Use another browser, such as Claude in Chrome or Playwright, only when asked.

## Running the game

Start the game with sound off. Before the page loads, set the saved sound setting in localStorage, then reload:

```js
localStorage.setItem('iso-hoops:sound-mode', 'off')
```

This only mutes your own test sessions. The game's default for players stays sound on.

The same way, open straight into a state by setting these keys before load:

| Key | Values |
| --- | --- |
| `iso-hoops:court` | `neighborhood`, `rooftop`, `beach`, `autumn`, `winter` |
| `iso-hoops:time` | `auto`, `morning`, `day`, `evening`, `night` |
| `iso-hoops:mode` | `free`, `free-throws`, `clock`, `horse` |
| `iso-hoops:sound-mode` | `all`, `effects`, `off` |

Best scores live in `iso-hoops:free-throw-best`, `iso-hoops:clock-best-points`, `iso-hoops:horse-best` and `iso-hoops:longest-basket`. Seed one to show a realistic score.

In free throws mode, holding Space for about 620 ms usually makes the shot, and a 60 ms tap misses.

## Where things live

- `dist/game.js`: the game loop, input, menus, court props, lighting and audio. Most changes land here.
- `dist/engine.js`: the renderer, vendored from Pixel Plays (MIT). It is a classic script whose top-level names (`pix`, `plot`, `project`, `unproject`, `castShadow`, `hash`) are globals that `game.js` uses. Change it only when you must, and keep its two-space style.
- `dist/physics.js`, `free-throws.js`, `beat-the-clock.js`, `horse.js`: pure rules for the ball and each mode. Each has a test file in `test/`.
- `dist/courts.js`: one data entry per court (palette, sound, lighting settings). Add per-court behaviour here as data, not as branches in `game.js`.
- `dist/time-of-day.js`: the phase table (morning, day, evening, night) and the hour lookup.
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

## Shipping

- Commit messages: a sentence-case title saying what a player now gets, then bullet points. See `git log`.
- Open pull requests with the `pr-description` skill in `.claude/skills/`. It captures before/after screenshots and a clip.
- Every pull request gets a preview at `https://vladsez.github.io/iso-hoops/pr-preview/pr-<number>/`. Merging to `main` deploys `dist/` to GitHub Pages automatically.
- Check the phone layout (portrait and landscape) for any header, footer or menu change. Touch screens use separate layouts in `style.css` under `@media (pointer: coarse)`.
