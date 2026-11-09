import { HOOP } from './physics.js?v=3'

export const LETTERS = ['H', 'O', 'R', 'S', 'E']
/** How close to a spot's centre the player must stand to shoot, in metres. Also the marker ring's radius. */
export const SPOT_RADIUS = 0.7
export const MAKES_PER_TIER = 3
// Called spots move out every few makes: mid-range, long mid-range, just inside the arc (6.7 m), then threes.
// There are no close shots: HORSE is about range, and the fixed launch angle can't drop anything under about 2.2 m anyway.
export const TIERS = [
	{ min: 4, max: 5 },
	{ min: 5, max: 6.2 },
	{ min: 6.2, max: 6.7 },
	{ min: 7, max: 7.8 },
]
// Where the player can walk (see update() in game.js), kept a little inside so the ring is fully on the court.
const WALKABLE = { minX: -8, maxX: 8, maxY: 6 }
// Spots sit in front of the hoop, at most this far round from straight out, so the rim is never side-on.
const MAX_ANGLE = Math.PI * 0.42
/** How far a new spot keeps from the last two, in metres, so the game moves you round the court. */
export const MIN_GAP = 3
// In the thin band just inside the arc the last two spots can rule out most of it, so after this many tries the
// farthest one tried is used instead.
const TRIES = 40

export const tierOf = made => TIERS[Math.min(Math.floor(made / MAKES_PER_TIER), TIERS.length - 1)]

function randomSpot({ min, max }, random) {
	for (;;) {
		const distance = min + (max - min) * random()
		const angle = (random() * 2 - 1) * MAX_ANGLE
		const spot = { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
		const isWalkable = spot.x >= WALKABLE.minX && spot.x <= WALKABLE.maxX && Math.abs(spot.y) <= WALKABLE.maxY
		if (isWalkable) return spot
	}
}

/**
 * Picks a random spot for the current tier, at least MIN_GAP from each of the `recent` spots where the tier has room.
 * Pass `random` to make it deterministic in tests.
 */
export function pickSpot(made, random = Math.random, recent = []) {
	const gapTo = spot => Math.min(Infinity, ...recent.map(other => Math.hypot(spot.x - other.x, spot.y - other.y)))
	let farthest
	for (let i = 0; i < TRIES; i++) {
		const spot = randomSpot(tierOf(made), random)
		if (gapTo(spot) >= MIN_GAP) return spot
		if (!farthest || gapTo(spot) > gapTo(farthest)) farthest = spot
	}
	return farthest
}

export const isOnSpot = (player, spot) => Math.hypot(player.x - spot.x, player.y - spot.y) <= SPOT_RADIUS

/**
 * A game of HORSE against the court. Each called spot must be made; a miss earns the next letter, and spelling HORSE
 * ends the game. The score is the number of makes. Best only moves when a game ends.
 */
export const startHorse = (best, random = Math.random) => ({ made: 0, letters: 0, best, spot: pickSpot(0, random), isOver: false })

export function recordHorseShot(game, made, random = Math.random) {
	if (game.isOver) return game
	const makes = game.made + Number(made)
	const letters = game.letters + Number(!made)
	const isOver = letters >= LETTERS.length
	const best = isOver ? Math.max(game.best, makes) : game.best
	const recent = [game.spot, game.previous].filter(Boolean)
	return { made: makes, letters, best, spot: pickSpot(makes, random, recent), previous: game.spot, isOver }
}
