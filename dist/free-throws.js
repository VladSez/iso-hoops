import { createShot, stepBall } from './physics.js?v=3'

export const ROUND_SHOTS = 10
const YAW = Math.PI

// Each round shoots from a step farther back, ending at the three-point line. The scoring band narrows with distance,
// so stepping back is the difficulty. Sweeping ~400 shots per spot is too slow for startup, so each band is pinned
// here and a test checks it against findMakeWindow().
export const LEVELS = [
	{ spot: { x: -2.5, y: 0 }, distance: 4.5, window: { min: 0.3425, max: 0.44 } },
	{ spot: { x: -1.5, y: 0 }, distance: 5.5, window: { min: 0.415, max: 0.4875 } },
	{ spot: { x: -1, y: 0 }, distance: 6, window: { min: 0.45, max: 0.5225 } },
	{ spot: { x: -0.3, y: 0 }, distance: 6.7, window: { min: 0.4975, max: 0.5625 } },
]
export const levelOf = round => LEVELS[Math.min(round.level, LEVELS.length) - 1]

// The wobble scales with the band, so a centred release clears both edges by the same share in every round.
export const WOBBLE_SHARE = 0.35
export const wobbleAmplitude = ({ window }) => WOBBLE_SHARE * (window.max - window.min)

export function scores(spot, power) {
	const ball = createShot(spot, YAW, power)
	for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
	return ball.made
}

// Lower powers have rim-out gaps, so take the widest unbroken band of makes.
export function findMakeWindow(spot) {
	const step = 0.0025
	let best = { min: 0, max: 0 }
	let start
	for (let i = 0; i <= 1 / step + 1; i++) {
		const power = Math.round(i * step * 1e4) / 1e4
		if (i <= 1 / step && scores(spot, power)) {
			start ??= power
			continue
		}
		const last = Math.round((power - step) * 1e4) / 1e4
		if (start !== undefined && last - start > best.max - best.min) best = { min: start, max: last }
		start = undefined
	}
	return best
}

/** Power offset applied while charging, so even a perfect hold needs a well-timed release. */
export const wobble = (time, level) => wobbleAmplitude(level) * (0.6 * Math.sin(time * 2 * Math.PI * 2.3) + 0.4 * Math.sin(time * 2 * Math.PI * 3.7))

export const startRound = (best, level = 1) => ({ taken: 0, made: 0, best, level })
export const isDone = round => round.taken >= ROUND_SHOTS

export function recordShot(round, made) {
	if (isDone(round)) return round
	const total = round.made + Number(made)
	const taken = round.taken + 1
	// Best only moves when a round ends, so it stays the score to beat while you shoot.
	const best = taken >= ROUND_SHOTS ? Math.max(round.best, total) : round.best
	return { ...round, taken, made: total, best }
}
