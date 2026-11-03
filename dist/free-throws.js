import { createShot, stepBall } from './physics.js?v=2'

export const FREE_THROW_SPOT = { x: -2.5, y: 0 }
export const ROUND_SHOTS = 10
export const WOBBLE = 0.035
const YAW = Math.PI

export function scores(power) {
	const ball = createShot(FREE_THROW_SPOT, YAW, power)
	for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
	return ball.made
}

// Lower powers have rim-out gaps, so take the widest unbroken band of makes.
export function findMakeWindow() {
	const step = 0.0025
	let best = { min: 0, max: 0 }
	let start
	for (let i = 0; i <= 1 / step + 1; i++) {
		const power = i * step
		if (i <= 1 / step && scores(power)) {
			start ??= power
			continue
		}
		if (start !== undefined && power - step - start > best.max - best.min) best = { min: start, max: power - step }
		start = undefined
	}
	return best
}
// Sweeping ~400 shots at load is too slow for startup, so the result is pinned here and a test checks it against findMakeWindow().
export const MAKE_WINDOW = { min: 0.3425, max: 0.44 }

/** Power offset applied while charging, so even a perfect hold needs a well-timed release. */
export const wobble = time => WOBBLE * (0.6 * Math.sin(time * 2 * Math.PI * 2.3) + 0.4 * Math.sin(time * 2 * Math.PI * 3.7))

export const startRound = best => ({ taken: 0, made: 0, best })
export const isDone = round => round.taken >= ROUND_SHOTS

export function recordShot(round, made) {
	if (isDone(round)) return round
	const total = round.made + Number(made)
	return { taken: round.taken + 1, made: total, best: Math.max(round.best, total) }
}
