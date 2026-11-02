# Neighborhood Hoops

A relaxed basketball practice game built on [Pixel Plays](https://github.com/amirmushichge/pixel-plays)' isometric software renderer. No dependencies or build step.

Play: [iso-hoops on GitHub Pages](https://vladsez.github.io/iso-hoops/).

Run `node serve.mjs`, then open http://127.0.0.1:5300. Run physics checks with `node --test`.

- WASD / arrows: move relative to the screen
- Mouse: manually aim toward the hoop (aims on the hoop's horizontal plane)
- Q / E: turn your aim without a mouse
- Hold Space: build shot power; release: shoot
- Escape: cancel a charge, or pause/resume

Ballistic shots can hit the rim and backboard. A basket counts only when the ball passes downward through the hoop. The ball returns automatically after every shot. Stats are temporary and reset on reload. Sound is on by default, with a quiet original instrumental loop. Browsers that block autoplay start audio on the first click or keypress. The sound button mutes both music and effects.

Made shots pass through a bright, animated net, with a basket callout and a pulse on the made count. Made shots also play a swish and scoring chime when sound is on. Reduced-motion preferences keep the net and callout still.

The original `dist/engine.js` is from Pixel Plays, by AmirMushich. Its MIT license is included in `dist/LICENSE.pixel-plays`. No Pixel Plays music is used. All court, interface, game and physics code was created for this project.

## Deploy to GitHub Pages

GitHub Pages publishes the `gh-pages` branch. When editing `dist/style.css`, update its `?v=` version in `dist/index.html` so browsers fetch the latest styles. After committing game changes on `main`, deploy the contents of `dist` with:

```sh
git push origin main
git subtree push --prefix dist origin gh-pages
```
