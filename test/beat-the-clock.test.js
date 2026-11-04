import test from 'node:test'
import assert from 'node:assert/strict'
import { ROUND_SECONDS, finishRound, isTimeUp, recordMake, secondsLeft, startClock, startClockRound } from '../dist/beat-the-clock.js'

test('the clock waits for the first shot', () => {
	const round = startClockRound(0)
	assert.equal(secondsLeft(round, 100), ROUND_SECONDS)
	assert.equal(isTimeUp(round, 1000), false)
})

test('the clock runs for sixty seconds from the first shot', () => {
	const round = startClock(startClockRound(0), 10)
	assert.equal(secondsLeft(round, 10), 60)
	assert.equal(secondsLeft(round, 45.5), 24.5)
	assert.equal(isTimeUp(round, 69.9), false)
	assert.equal(isTimeUp(round, 70), true)
	assert.equal(secondsLeft(round, 80), 0)
})

test('makes count until the round is finished, including a shot in the air at the buzzer', () => {
	let round = startClock(startClockRound(0), 0)
	round = recordMake(recordMake(round))
	assert.equal(isTimeUp(round, 61), true)
	round = recordMake(round)
	assert.equal(round.made, 3)
	round = finishRound(round)
	assert.equal(recordMake(round).made, 3)
})

test('best only moves when a round finishes, and survives the next round', () => {
	let round = startClock(startClockRound(5), 0)
	for (let i = 0; i < 7; i++) round = recordMake(round)
	assert.equal(round.best, 5)
	round = finishRound(round)
	assert.equal(round.best, 7)
	assert.equal(finishRound(startClockRound(round.best)).best, 7)
})
