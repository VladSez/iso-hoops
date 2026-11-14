import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP } from '../dist/physics.js'
import { SKILL, aimShot, chooseSpot, distanceOf, makeRate, makeWindow, scores } from '../dist/cpu.js'
import { startDuel } from '../dist/horse-duel.js'

function seeded(seed) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296
		return seed / 4294967296
	}
}

const at = (distance, angle) => ({ x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance })

test('every distance the CPU shoots from has a band of power that scores', () => {
	for (const distance of [4, 5, 6.2, 7, 7.8]) {
		for (const angle of [0, 0.8, -1.2]) {
			const window = makeWindow(at(distance, angle))
			assert.ok(window.max - window.min > 0.03, `${distance} m at ${angle} rad has a ${window.max - window.min} band`)
		}
	}
})

// Single spots vary by about ten points either way, so this checks what a player notices: the average over a band.
test('each level makes its shots about as often as it should, from mid-range and from deep', () => {
	const random = seeded(5)
	const bands = { 'mid-range': [4.2, 5], deep: [7, 7.8] }
	const spots = Object.fromEntries(Object.entries(bands).map(([name, [min, max]]) => [name, Array.from({ length: 8 }, () => {
		const spot = at(min + (max - min) * random(), (random() * 2 - 1) * 1.2)
		return { spot, window: makeWindow(spot) }
	})]))
	for (const level of Object.keys(SKILL)) {
		for (const [name, list] of Object.entries(spots)) {
			let made = 0, target = 0
			for (const { spot, window } of list) {
				target += makeRate(level, Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y)) / list.length
				for (let i = 0; i < 100; i++) {
					const { yaw, power } = aimShot(spot, level, random, window)
					made += scores(spot, yaw, power)
				}
			}
			const rate = made / (list.length * 100)
			assert.ok(Math.abs(rate - target) < 0.07, `${level} from ${name} made ${(rate * 100).toFixed(0)}%, aiming for ${(target * 100).toFixed(0)}%`)
		}
	}
})

test('harder levels shoot better, and every level is worse from deep', () => {
	assert.ok(makeRate('easy', 5) < makeRate('medium', 5) && makeRate('medium', 5) < makeRate('hard', 5))
	for (const level of Object.keys(SKILL)) assert.ok(makeRate(level, 7.5) < makeRate(level, 4.5))
})

test('the CPU sets safer shots when behind and goes deeper when ahead', () => {
	const random = seeded(9)
	const average = letters => {
		let total = 0
		for (let i = 0; i < 300; i++) total += distanceOf(chooseSpot({ ...startDuel('hard', 'you'), letters }, random))
		return total / 300
	}
	const behind = average({ you: 0, cpu: 2 })
	const ahead = average({ you: 2, cpu: 0 })
	assert.ok(ahead > behind + 1.5, `ahead ${ahead.toFixed(1)} m, behind ${behind.toFixed(1)} m`)
})

test('every spot the CPU sets is on the court and in front of the hoop', () => {
	const random = seeded(2)
	for (const level of Object.keys(SKILL)) {
		for (const letters of [{ you: 0, cpu: 3 }, { you: 0, cpu: 0 }, { you: 4, cpu: 0 }]) {
			for (let i = 0; i < 200; i++) {
				const spot = chooseSpot({ ...startDuel(level, 'you'), letters }, random)
				assert.ok(spot.x > HOOP.x && spot.x <= 8 && Math.abs(spot.y) <= 6, JSON.stringify(spot))
				assert.ok(distanceOf(spot) <= SKILL[level].reach + 1e-9)
			}
		}
	}
})
