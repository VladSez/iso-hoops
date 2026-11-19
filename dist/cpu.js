import { HOOP, RIM_BOUNCE, createShot, stepBall } from './physics.js?v=5'

// How often each level makes a shot from mid-range, from 10 m, and how far out its ordinary shots go when it is ahead.
export const SKILL = {
	easy: { make: 0.62, deep: 0.42, reach: 6.4 },
	medium: { make: 0.72, deep: 0.4, reach: 7.2 },
	hard: { make: 0.92, deep: 0.6, reach: 7.8 },
}
const NEAR = 5, TEN = 10
const AIM_ERROR = 0.004
// Where the CPU and the player can stand, kept inside so the matching ring is fully on the court.
const WALKABLE = { minX: -8, maxX: 8, maxY: 6 }
const MAX_ANGLE = Math.PI * 0.42

export const distanceOf = spot => Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y)
export const yawTo = spot => Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x)

/** How far past mid-range a shot is: 0 inside 5 m, 1 at 10 m, and more beyond. */
const depthOf = distance => Math.max(0, (distance - NEAR) / (TEN - NEAR))

/** The chance the CPU makes a shot from this far out. */
export function makeRate(level, distance) {
	const { make, deep } = SKILL[level]
	return Math.max(0.2, make - (make - deep) * depthOf(distance))
}
// Deep shots miss a little more often than their band alone suggests, so the CPU aims that much tighter from out there.
const DEEP_SLIP = 0.06

export function scores(spot, yaw, power, wind = 0, rim = RIM_BOUNCE) {
	const ball = createShot(spot, yaw, power, wind, rim)
	for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
	return ball.made
}

/** The widest unbroken band of power that makes the shot from `spot` in this wind and off this rim, aiming straight at it. */
export function makeWindow(spot, wind = 0, rim = RIM_BOUNCE) {
	const step = 0.0025
	const yaw = yawTo(spot)
	let best = { min: 0, max: 0 }
	let start
	for (let i = 0; i <= 1 / step + 1; i++) {
		const power = Math.round(i * step * 1e4) / 1e4
		if (i <= 1 / step && scores(spot, yaw, power, wind, rim)) {
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
	const spread = spreadFor(Math.min(0.99, makeRate(level, distance) + DEEP_SLIP * Math.min(1, depthOf(distance))))
	return {
		yaw: yawTo(spot) + gaussian(random) * AIM_ERROR,
		power: Math.max(0, Math.min(1, centre + gaussian(random) * spread * half)),
	}
}

const onCourt = spot => spot.x >= WALKABLE.minX && spot.x <= WALKABLE.maxX && Math.abs(spot.y) <= WALKABLE.maxY
const between = (min, max, random) => min + (max - min) * random()
const fromHoop = (distance, angle) => ({ x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance })

/** What kind of shot a spot is: the CPU picks a kind first, and reads your misses by kind. */
export function kindOf(spot) {
	const distance = distanceOf(spot)
	const angle = Math.abs(Math.atan2(spot.y - HOOP.y, spot.x - HOOP.x))
	if (distance >= 11.5) return 'logo'
	if (distance >= 7.6) return 'deep'
	if (distance >= 6.6 && Math.abs(spot.y - HOOP.y) >= 5.2) return 'corner'
	if (angle >= 1.2) return 'baseline'
	return 'inside'
}

// How often each level picks each kind of shot to set. Deep and logo shots are its gambles.
const KINDS = {
	easy: { inside: 1 },
	medium: { inside: 0.3, deep: 0.4, corner: 0.15, baseline: 0.15 },
	hard: { inside: 0.25, deep: 0.35, logo: 0.25, corner: 0.15, baseline: 0.1 },
}
const GAMBLES = ['deep', 'logo']

const SPOTS = {
	// Behind, it takes safe mid-range shots; level, a little longer; ahead, as far as its level reaches.
	inside(level, lead, side, random) {
		const range = lead < 0 ? { min: 4, max: 5.2 } : lead === 0 ? { min: 4.5, max: 6.2 } : { min: 6, max: SKILL[level].reach }
		return fromHoop(between(range.min, range.max, random), side * MAX_ANGLE * random())
	},
	deep(level, lead, side, random) {
		const distance = level === 'hard' ? between(8.8, 11.2, random) : between(7.2, 9.5, random)
		// The court is 6 m to each side, so the deeper the shot, the straighter on it has to be.
		return fromHoop(distance, side * Math.asin(5.6 / distance) * random())
	},
	logo: (level, lead, side, random) => fromHoop(between(11.8, 13.6, random), side * 0.35 * random()),
	corner(level, lead, side, random) {
		const across = between(5.3, 5.9, random)
		return { x: HOOP.x + Math.sqrt(between(6.9, 7.3, random) ** 2 - across ** 2), y: HOOP.y + side * across }
	},
	baseline: (level, lead, side, random) => fromHoop(between(3.8, 5.2, random), side * between(1.25, 1.42, random)),
}

/** How much more the CPU wants a kind of shot: more for every match you missed from it this game, less for each make. */
function weakness(log) {
	const kinds = {}, sides = { [-1]: 1, [1]: 1 }
	for (const shot of log) {
		if (shot.by !== 'you' || shot.phase !== 'match') continue
		const kind = kindOf({ x: HOOP.x + shot.out, y: HOOP.y + shot.across })
		const tally = kinds[kind] ??= { made: 0, missed: 0 }
		tally[shot.made ? 'made' : 'missed']++
		if (!shot.made) sides[Math.sign(shot.across) || 1]++
	}
	const factor = kind => {
		const tally = kinds[kind]
		return tally ? Math.min(3, Math.max(0.5, (1 + 2 * tally.missed) / (1 + 2 * tally.made))) : 1
	}
	return { factor, left: sides[-1] / (sides[-1] + sides[1]) }
}

function pick(weights, random) {
	const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
	let roll = random() * total
	for (const [kind, weight] of Object.entries(weights)) if ((roll -= weight) < 0) return kind
	return Object.keys(weights)[0]
}

/**
 * Where the CPU sets a shot. It picks a kind of shot by its level: Medium and Hard mix in corner threes, baseline
 * angles and deep threes, Hard goes to the logo, and neither likes to set the same kind twice in a row. It gambles deep more when ahead and less when behind, and it
 * leans toward the kinds of shots and the side of the court where you have missed matches this game.
 */
export function chooseSpot(duel, random = Math.random, log = []) {
	const lead = duel.letters.you - duel.letters.cpu
	const { factor, left } = weakness(log)
	const lastSet = log.findLast(shot => shot.by === 'cpu' && shot.phase === 'set')
	const lastKind = lastSet && kindOf({ x: HOOP.x + lastSet.out, y: HOOP.y + lastSet.across })
	const weights = {}
	for (const [kind, weight] of Object.entries(KINDS[duel.level])) {
		const nerve = GAMBLES.includes(kind) ? (lead > 0 ? 1.5 : lead < 0 ? 0.4 : 1) : 1
		// It mixes things up: the kind of shot it set last time is half as likely next time.
		const fresh = kind === lastKind ? 0.5 : 1
		weights[kind] = weight * nerve * factor(kind) * fresh
	}
	const kind = pick(weights, random)
	for (let i = 0; i < 200; i++) {
		const side = random() < left ? -1 : 1
		const spot = SPOTS[kind](duel.level, lead, side, random)
		if (onCourt(spot)) return spot
	}
	return { x: HOOP.x + 4.5, y: 0 }
}
