import { HOOP } from './physics.js?v=3'

export const LETTERS = ['G', 'O', 'A', 'T']
/** How close to a spot's centre the player must stand to shoot, in metres. Also the marker ring's radius. */
export const SPOT_RADIUS = 0.55
export const MAKES_PER_TIER = 3
// Called spots move out every few makes: close range, short, mid-range, then beyond the arc (6.7 m).
// The launch angle is fixed, so nothing closer than about 2.2 m can drop in; 2.6 m leaves a fair power window.
export const TIERS = [
	{ min: 2.6, max: 3.6 },
	{ min: 3.6, max: 5 },
	{ min: 5, max: 6.4 },
	{ min: 7, max: 7.8 },
]
// Where the player can walk (see update() in game.js), kept a little inside so the ring is fully on the court.
const WALKABLE = { minX: -8, maxX: 8, maxY: 6 }
// Spots sit in front of the hoop, at most this far round from straight out, so the rim is never side-on.
const MAX_ANGLE = Math.PI * 0.42

export const tierOf = made => TIERS[Math.min(Math.floor(made / MAKES_PER_TIER), TIERS.length - 1)]

/** Picks a random spot for the current tier. Pass `random` to make it deterministic in tests. */
export function pickSpot(made, random = Math.random) {
	const { min, max } = tierOf(made)
	for (;;) {
		const distance = min + (max - min) * random()
		const angle = (random() * 2 - 1) * MAX_ANGLE
		const spot = { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
		const isWalkable = spot.x >= WALKABLE.minX && spot.x <= WALKABLE.maxX && Math.abs(spot.y) <= WALKABLE.maxY
		if (isWalkable) return spot
	}
}

export const isOnSpot = (player, spot) => Math.hypot(player.x - spot.x, player.y - spot.y) <= SPOT_RADIUS

/**
 * A game of GOAT against the court. Each called spot must be made; a miss earns the next letter, and spelling GOAT
 * ends the game. The score is the number of makes. Best only moves when a game ends.
 */
export const startGoat = (best, random = Math.random) => ({ made: 0, letters: 0, best, spot: pickSpot(0, random), isOver: false })

export function recordGoatShot(game, made, random = Math.random) {
	if (game.isOver) return game
	const makes = game.made + Number(made)
	const letters = game.letters + Number(!made)
	const isOver = letters >= LETTERS.length
	const best = isOver ? Math.max(game.best, makes) : game.best
	return { made: makes, letters, best, spot: pickSpot(makes, random), isOver }
}
