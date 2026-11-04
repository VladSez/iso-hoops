import test from 'node:test'
import assert from 'node:assert/strict'
import { shotDistance } from '../dist/physics.js'
import { LEVELS, ROUND_SHOTS, findMakeWindow, isDone, levelOf, recordShot, scores, startRound, wobble, wobbleAmplitude } from '../dist/free-throws.js'

function shoot(round, results) {
	for (const made of results) round = recordShot(round, made)
	return round
}

for (const level of LEVELS) {
	test(`every sampled power in the ${level.distance} m band scores`, () => {
		const { min, max } = level.window
		for (let i = 0; i <= 20; i++) {
			const power = min + (max - min) * i / 20
			assert.ok(scores(level.spot, power), `power ${power.toFixed(4)} should score from ${level.distance} m`)
		}
	})

	test(`the pinned ${level.distance} m band matches the physics`, () => {
		assert.deepEqual(findMakeWindow(level.spot), level.window)
		assert.equal(shotDistance(level.spot), level.distance)
	})

	test(`a centred release from ${level.distance} m scores whatever the wobble`, () => {
		const amplitude = wobbleAmplitude(level)
		assert.ok(amplitude < (level.window.max - level.window.min) / 2)
		let peak = 0
		for (let t = 0; t < 60; t += 0.01) peak = Math.max(peak, Math.abs(wobble(t, level)))
		assert.ok(peak > amplitude * 0.8 && peak <= amplitude + 1e-9)
	})
}

test('each round steps back, and the band never gets wider', () => {
	for (let i = 1; i < LEVELS.length; i++) {
		assert.ok(LEVELS[i].distance > LEVELS[i - 1].distance)
		const width = ({ window }) => window.max - window.min
		assert.ok(width(LEVELS[i]) <= width(LEVELS[i - 1]) + 1e-9)
	}
})

test('rounds past the last spot stay at the three-point line', () => {
	assert.equal(levelOf(startRound(0, 1)), LEVELS[0])
	assert.equal(levelOf(startRound(0, LEVELS.length + 3)), LEVELS.at(-1))
	assert.equal(LEVELS.at(-1).distance, 6.7)
})

test('a round ends after ten shots and counts the makes', () => {
	const round = shoot(startRound(0), [true, false, true, true, false, true, true, false, true, true])
	assert.equal(round.taken, ROUND_SHOTS)
	assert.equal(round.made, 7)
	assert.equal(isDone(round), true)
	assert.equal(isDone(shoot(startRound(0), Array(ROUND_SHOTS - 1).fill(true))), false)
})

test('best keeps the highest round and survives a new round', () => {
	const round = shoot(startRound(8), Array(ROUND_SHOTS).fill(false))
	assert.equal(round.best, 8)
	const perfect = shoot(startRound(round.best), Array(ROUND_SHOTS).fill(true))
	assert.equal(perfect.best, 10)
	assert.deepEqual(startRound(perfect.best), { taken: 0, made: 0, best: 10, level: 1 })
})

test('shots after the round is done change nothing', () => {
	const done = shoot(startRound(0), Array(ROUND_SHOTS).fill(true))
	assert.deepEqual(recordShot(done, false), done)
})

test('best holds still during a round and only moves when it ends', () => {
	const almost = shoot(startRound(3), Array(ROUND_SHOTS - 1).fill(true))
	assert.equal(almost.made, 9)
	assert.equal(almost.best, 3)
	assert.equal(recordShot(almost, false).best, 9)
})

test('the round level survives every shot of the round', () => {
	const round = shoot(startRound(4, 3), Array(ROUND_SHOTS).fill(true))
	assert.equal(round.level, 3)
})
