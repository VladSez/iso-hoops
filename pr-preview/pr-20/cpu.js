import { HOOP, createShot, stepBall } from './physics.js?v=3'

// How often each level makes a shot from mid-range, how much worse it gets from deep, and how far out it will go to
// set a shot when it is ahead.
export const SKILL = {
	easy: { make: 0.62, reach: 6.4 },
	medium: { make: 0.72, reach: 7.2 },
	hard: { make: 0.92, reach: 7.8 },
}
const DEEP_PENALTY = 0.1
const NEAR = 5, FAR = 7.5
const AIM_ERROR = 0.004
// Where the CPU and the player can stand, kept inside so the matching ring is fully on the court.
const WALKABLE = { minX: -8, maxX: 8, maxY: 6 }
const MAX_ANGLE = Math.PI * 0.42

export const distanceOf = spot => Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y)
export const yawTo = spot => Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x)

/** The chance the CPU makes a shot from this far out. */
const depthOf = distance => Math.min(1, Math.max(0, (distance - NEAR) / (FAR - NEAR)))

export function makeRate(level, distance) {
	return SKILL[level].make - DEEP_PENALTY * depthOf(distance)
}
// Deep shots miss a little more often than their band alone suggests, so the CPU aims that much tighter from out there.
const DEEP_SLIP = 0.06

export function scores(spot, yaw, power) {
	const ball = createShot(spot, yaw, power)
	for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
	return ball.made
}

/** The widest unbroken band of power that makes the shot from `spot`, aiming straight at the rim. */
export function makeWindow(spot) {
	const step = 0.0025
	const yaw = yawTo(spot)
	let best = { min: 0, max: 0 }
	let start
	for (let i = 0; i <= 1 / step + 1; i++) {
		const power = Math.round(i * step * 1e4) / 1e4
		if (i <= 1 / step && scores(spot, yaw, power)) {
			start ??= power
			continue
		}
		const last = Math.round((power - step) * 1e4) / 1e4
		if (start !== undefined && last - start > best.max - best.min) best = { min: start, max: last }
		start = undefined
	}
	return best
}

// Measured make rate for a release centred in the band with a normal power error of `spread` half-bands, averaged over
// spots from 4 to 7.8 m. Misses past the band still roll in off the rim at times, so wide spreads score more than the
// band alone suggests.
const RATE_BY_SPREAD = [[0.4, 0.99], [0.5, 0.96], [0.65, 0.91], [0.8, 0.83], [1.2, 0.68], [1.6, 0.56], [2.2, 0.44], [3, 0.34], [4, 0.27]]

function spreadFor(rate) {
	for (let i = 1; i < RATE_BY_SPREAD.length; i++) {
		const [s0, r0] = RATE_BY_SPREAD[i - 1], [s1, r1] = RATE_BY_SPREAD[i]
		if (rate >= r1) return s0 + (s1 - s0) * (r0 - Math.min(rate, r0)) / (r0 - r1)
	}
	return RATE_BY_SPREAD.at(-1)[0]
}

const gaussian = random => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())

/** The CPU's release from `spot`: aimed at the rim, with a power error sized so it scores at its level's rate. */
export function aimShot(spot, level, random = Math.random, window = makeWindow(spot)) {
	const centre = (window.min + window.max) / 2
	const half = (window.max - window.min) / 2
	const distance = distanceOf(spot)
	const spread = spreadFor(Math.min(0.99, makeRate(level, distance) + DEEP_SLIP * depthOf(distance)))
	return {
		yaw: yawTo(spot) + gaussian(random) * AIM_ERROR,
		power: Math.max(0, Math.min(1, centre + gaussian(random) * spread * half)),
	}
}

/**
 * Where the CPU sets a shot. Behind, it takes safe mid-range shots; level, a little longer; ahead, it goes deep,
 * as far as its level reaches, and the hard CPU likes the corners.
 */
export function chooseSpot(duel, random = Math.random) {
	const lead = duel.letters.you - duel.letters.cpu
	const { reach } = SKILL[duel.level]
	const range = lead < 0 ? { min: 4, max: 5.2 } : lead === 0 ? { min: 4.5, max: 6.2 } : { min: 6, max: reach }
	const wide = lead > 0 && duel.level === 'hard'
	for (let i = 0; i < 200; i++) {
		const distance = range.min + (range.max - range.min) * random()
		const side = random() < 0.5 ? -1 : 1
		const angle = side * (wide ? MAX_ANGLE * (0.7 + 0.3 * random()) : MAX_ANGLE * random())
		const spot = { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
		if (spot.x >= WALKABLE.minX && spot.x <= WALKABLE.maxX && Math.abs(spot.y) <= WALKABLE.maxY) return spot
	}
	return { x: HOOP.x + range.min, y: 0 }
}
