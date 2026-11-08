import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP, createShot, stepBall } from '../dist/physics.js'
import { LETTERS, MAKES_PER_TIER, MIN_GAP, TIERS, isOnSpot, pickSpot, recordHorseShot, startHorse, tierOf } from '../dist/horse.js'

// A tiny seeded generator, so the sweeps below are repeatable.
function seeded(seed) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296
		return seed / 4294967296
	}
}

function play(game, results) {
	const random = seeded(7)
	for (const made of results) game = recordHorseShot(game, made, random)
	return game
}

test('every called spot is on the court, in front of the hoop, at its tier distance', () => {
	const random = seeded(1)
	for (let made = 0; made < TIERS.length * MAKES_PER_TIER + 3; made++) {
		const { min, max } = tierOf(made)
		for (let i = 0; i < 200; i++) {
			const spot = pickSpot(made, random)
			const distance = Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y)
			assert.ok(distance >= min - 1e-9 && distance <= max + 1e-9)
			assert.ok(spot.x > HOOP.x && spot.x <= 8 && Math.abs(spot.y) <= 6)
		}
	}
})

test('spots start at mid-range, move out every three makes and end beyond the arc', () => {
	assert.ok(TIERS[0].min >= 4)
	assert.equal(tierOf(0), TIERS[0])
	assert.equal(tierOf(MAKES_PER_TIER - 1), TIERS[0])
	assert.equal(tierOf(MAKES_PER_TIER), TIERS[1])
	assert.equal(tierOf(100), TIERS.at(-1))
	assert.ok(TIERS.at(-1).min > 6.7)
})

test('you have to stand inside the ring to shoot', () => {
	const spot = { x: 0, y: 0 }
	assert.equal(isOnSpot({ x: 0.45, y: 0.45 }, spot), true)
	assert.equal(isOnSpot({ x: 0.75, y: 0 }, spot), false)
})

test('makes score, misses earn letters, and H-O-R-S-E ends the game', () => {
	let game = play(startHorse(0, seeded(3)), [true, true, false, true])
	assert.equal(game.made, 3)
	assert.equal(game.letters, 1)
	assert.equal(game.isOver, false)
	game = play(game, Array(LETTERS.length - 1).fill(false))
	assert.equal(game.letters, LETTERS.length)
	assert.equal(game.isOver, true)
	assert.equal(game.best, 3)
	assert.deepEqual(recordHorseShot(game, true), game)
})

test('best holds still during a game and survives the next one', () => {
	let game = play(startHorse(5, seeded(4)), Array(8).fill(true))
	assert.equal(game.best, 5)
	game = play(game, Array(LETTERS.length).fill(false))
	assert.equal(game.best, 8)
	assert.equal(startHorse(game.best).best, 8)
})

// Some power must drop the ball in, aiming straight at the rim. Checked at the hardest corners of the range:
// the closest and farthest distances, from the widest angle a spot can have.
function canScore(distance, angle) {
	const spot = { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
	const yaw = Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x)
	for (let power = 0; power <= 1; power += 0.0025) {
		const ball = createShot(spot, yaw, power)
		for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
		if (ball.made) return true
	}
	return false
}

test('the closest and farthest called spots can be made', () => {
	assert.ok(canScore(TIERS[0].min, Math.PI * 0.42))
	assert.ok(canScore(TIERS.at(-1).max, Math.PI * 0.42))
})

test('each called spot is well away from the last two, in every tier', () => {
	const random = seeded(3)
	const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
	let closest = Infinity
	let tooClose = 0
	let calls = 0
	for (let game = 0; game < 500; game++) {
		let state = startHorse(0, random)
		const spots = [state.spot]
		// Make a few, miss one, and repeat, so the spots climb through every tier before HORSE ends the game.
		for (let shot = 0; !state.isOver; shot++) {
			state = recordHorseShot(state, shot % 4 !== 3, random)
			spots.push(state.spot)
		}
		for (let i = 1; i < spots.length; i++) {
			const nearest = Math.min(gap(spots[i], spots[i - 1]), i > 1 ? gap(spots[i], spots[i - 2]) : Infinity)
			closest = Math.min(closest, nearest)
			tooClose += nearest < MIN_GAP
			calls++
		}
	}
	// Where the thin band just inside the arc has no room left, the farthest spot tried still keeps them well apart.
	assert.ok(closest >= 2, `two spots ${closest.toFixed(2)} m apart`)
	assert.ok(tooClose / calls < 0.01, `${tooClose} of ${calls} spots closer than ${MIN_GAP} m`)
})
