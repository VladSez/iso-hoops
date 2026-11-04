# Neighborhood Hoops

A relaxed 3D pixel-art basketball game that runs in your browser. Move around the court, line up your shot and drain it through the net.

**[Play it here](https://vladsez.github.io/iso-hoops/)**

![Neighborhood Hoops](dist/og-image.png)

Built with Claude Opus 5.5 on [Pixel Plays](https://github.com/amirmushichge/pixel-plays)' isometric software renderer. There are no dependencies and no build step.

## Features

- **5 courts:** neighborhood, rooftop at dusk, boardwalk beach, autumn park and first snow. Switch between them from the Court menu in the footer.
- **Longest basket:** in free shooting, the header tracks your longest make in metres, measured from where you shot to the hoop. Beat it for a NEW LONGEST callout. It is saved in your browser.
- **10 free throws:** a mode with a goal. Shoot ten from the free throw spot and see how many you make, then step back a little each round, out to the three-point line. Your best round is remembered. Pick it from the Mode menu in the footer.
- **Real shot physics:** the ball can bounce off the rim and the backboard. A basket counts only when the ball drops down through the hoop.
- **Music written in code:** a quiet, original 76 BPM loop built sample by sample, with no audio files.
- **Sound effects made on the fly:** dribbles, swishes and the scoring chime are all generated with the Web Audio API.
- **Made-shot feedback:** the net animates, a basket callout appears and the made count pulses.
- **Remembers your settings:** your court and sound choices are kept between visits.
- **Plays on phones:** an on-screen stick and Shoot button replace the keyboard, with layouts for portrait and landscape.
- **Accessible motion:** with reduced motion turned on, the net and callout stay still.

## Controls

| Action | Input |
| --- | --- |
| Move | WASD or arrow keys (relative to the screen) |
| Aim | Mouse, or Q / E to turn |
| Shoot | Hold Space or the left mouse button to build power, release to shoot |
| Cancel a shot or pause | Escape |

In 10 free throws mode your spot and aim are locked, starting at the free throw line. Release inside the dark band on the meter, which wobbles slightly, so time your release. After your tenth shot, Space starts the next round a step farther back, from 5.5 m, then 6 m, then the three-point line.

On phones and tablets, drag the stick in the bottom left to move, tap or drag on the court to aim, and hold the Shoot button to charge. Both portrait and landscape work.

The ball comes back to you after every shot. Free shooting stats reset when you reload the page, except your longest basket. Your best free throw round is saved in your browser too.

## Sound

Sound is on by default. Browsers that block autoplay start the audio on your first click or keypress. Use the sound menu in the footer to turn off just the music or all sound.

## Run locally

```sh
node serve.mjs
```

Then open http://127.0.0.1:5300.

Run the physics tests with:

```sh
node --test
```

## Deploy to GitHub Pages

GitHub Pages publishes the `gh-pages` branch. When you edit `dist/style.css`, `dist/engine.js` or `dist/game.js` (or a module it imports), bump that file's `?v=` version in `dist/index.html` so browsers fetch the new code. After committing game changes on `main`, deploy the contents of `dist` with:

```sh
git push origin main
git subtree push --prefix dist origin gh-pages
```

## Credits

- `dist/engine.js` comes from [Pixel Plays](https://github.com/amirmushichge/pixel-plays) by AmirMushich, under the MIT license in `dist/LICENSE.pixel-plays`. No Pixel Plays music is used.
- All court, interface, game, physics and audio code was written for this project.
- Made by [@vladsazonau](https://x.com/vladsazonau).
