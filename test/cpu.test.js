import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP } from '../dist/physics.js'
import { SKILL, aimShot, chooseSpot, distanceOf, kindOf, makeRate, makeWindow, scores } from '../dist/cpu.js'
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
	const deep = [at(9, 0.5), at(11, -0.4), at(13.5, 0.2), { x: HOOP.x + 3.5, y: 5.8 }, at(4, -1.42)]
	for (const spot of deep) {
		const window = makeWindow(spot)
		assert.ok(window.max - window.min > 0.03, `${JSON.stringify(spot)} has a ${window.max - window.min} band`)
	}
})

// Single spots vary by about ten points either way, so this checks what a player notices: the average over a band.
test('each level makes its shots about as often as it should, from mid-range and from deep', () => {
	const random = seeded(5)
	const bands = { 'mid-range': [4.2, 5], deep: [7, 7.8], 'deep three': [9, 10] }
	const spots = Object.fromEntries(Object.entries(bands).map(([name, [min, max]]) => [name, Array.from({ length: 8 }, () => {
		const distance = min + (max - min) * random()
		const spot = at(distance, (random() * 2 - 1) * Math.min(1.2, Math.asin(Math.min(1, 5.6 / distance))))
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
	// From 10 m Hard stays dangerous and Medium is a gamble.
	assert.equal(makeRate('hard', 10), 0.6)
	assert.equal(makeRate('medium', 10), 0.4)
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
				assert.ok(distanceOf(spot) <= { easy: SKILL.easy.reach, medium: 9.5, hard: 13.6 }[level] + 1e-9)
			}
		}
	}
})

test('Medium and Hard mix in deep threes, corners and baseline angles, and only Hard goes to the logo', () => {
	const random = seeded(4)
	const mix = level => {
		const kinds = {}
		for (let i = 0; i < 1000; i++) {
			const kind = kindOf(chooseSpot(startDuel(level, 'you'), random))
			kinds[kind] = (kinds[kind] ?? 0) + 1
		}
		return kinds
	}
	const easy = mix('easy'), medium = mix('medium'), hard = mix('hard')
	assert.ok(!easy.deep && !easy.logo && !easy.corner, JSON.stringify(easy))
	assert.ok(medium.deep > 250 && medium.corner > 80 && medium.baseline > 80 && !medium.logo, JSON.stringify(medium))
	assert.ok(medium.inside < 450, `Medium keeps it varied: ${JSON.stringify(medium)}`)
	assert.ok(hard.deep > 250 && hard.corner > 80, JSON.stringify(hard))
	// Hard goes to the logo about two or three times in ten.
	assert.ok(hard.logo > 180 && hard.logo < 300, JSON.stringify(hard))
})

test('the CPU sets more shots where you have missed matches this game, and fewer where you made them', () => {
	const random = seeded(6)
	const share = (log, test) => {
		let count = 0
		for (let i = 0; i < 2000; i++) count += test(chooseSpot(startDuel('medium', 'you'), random, log))
		return count / 2000
	}
	const match = (made, out, across) => ({ by: 'you', phase: 'match', made, out, across })
	const isCorner = spot => kindOf(spot) === 'corner'
	const isDeep = spot => kindOf(spot) === 'deep'
	const missedLeftCorners = [match(false, 3.5, -5.6), match(false, 3.4, -5.7)]
	assert.ok(share(missedLeftCorners, isCorner) > share([], isCorner) + 0.08)
	assert.ok(share(missedLeftCorners, spot => spot.y < HOOP.y) > 0.65)
	assert.ok(share([match(true, 8.5, 0), match(true, 8.4, 1)], isDeep) < share([], isDeep) - 0.08)
	// Its own shots and your set shots say nothing about how you match.
	assert.ok(Math.abs(share([{ ...match(false, 3.5, -5.6), by: 'cpu' }], isCorner) - share([], isCorner)) < 0.05)
})

test('the CPU is less likely to set the same kind of shot twice in a row', () => {
	const random = seeded(8)
	const share = log => {
		let deep = 0
		for (let i = 0; i < 2000; i++) deep += kindOf(chooseSpot(startDuel('medium', 'you'), random, log)) === 'deep'
		return deep / 2000
	}
	const deepSet = { by: 'cpu', phase: 'set', made: true, out: 8.5, across: 0 }
	assert.ok(share([deepSet]) < share([]) - 0.1)
})
