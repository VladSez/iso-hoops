import test from 'node:test'
import assert from 'node:assert/strict'
import { MAKE_WINDOW, ROUND_SHOTS, WOBBLE, findMakeWindow, isDone, recordShot, scores, startRound, wobble } from '../dist/free-throws.js'

function shoot(round, results) {
	for (const made of results) round = recordShot(round, made)
	return round
}

test('every sampled power in the make window scores from the free throw spot', () => {
	const { min, max } = MAKE_WINDOW
	for (let i = 0; i <= 20; i++) {
		const power = min + (max - min) * i / 20
		assert.ok(scores(power), `power ${power.toFixed(4)} should score`)
	}
})

test('the pinned make window matches the physics', () => {
	assert.deepEqual(findMakeWindow(), MAKE_WINDOW)
})

test('a release centred in the window scores whatever the wobble', () => {
	assert.ok(WOBBLE < (MAKE_WINDOW.max - MAKE_WINDOW.min) / 2)
	let peak = 0
	for (let t = 0; t < 60; t += 0.01) peak = Math.max(peak, Math.abs(wobble(t)))
	assert.ok(peak > WOBBLE * 0.8 && peak <= WOBBLE)
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
	assert.deepEqual(startRound(perfect.best), { taken: 0, made: 0, best: 10 })
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
