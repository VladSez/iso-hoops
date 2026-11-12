import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP } from '../dist/physics.js'
import { CORNER_LINE, CORNER_REACH, KEY_HALF_WIDTH, KEY_LENGTH, ROUND_SECONDS, THREE_POINT_DISTANCE, finishRound, isTimeUp, pointsFor, recordMake, secondsLeft, startClock, startClockRound, zoneOf } from '../dist/beat-the-clock.js'

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

test('makes beyond the three-point line are worth 3, on or inside it 2', () => {
	assert.equal(pointsFor({ x: -2.5, y: 0 }), 2)
	assert.equal(pointsFor({ x: HOOP.x + THREE_POINT_DISTANCE, y: 0 }), 2)
	assert.equal(pointsFor({ x: HOOP.x + THREE_POINT_DISTANCE + 0.05, y: 0 }), 3)
	assert.equal(pointsFor({ x: 0, y: 3 }), 3)
})

test('in the corners the line runs straight, so a three is possible inside the sidelines', () => {
	assert.equal(pointsFor({ x: HOOP.x + 1, y: CORNER_LINE + 0.1 }), 3)
	assert.equal(pointsFor({ x: HOOP.x + 1, y: -(CORNER_LINE + 0.1) }), 3)
	assert.equal(pointsFor({ x: HOOP.x + 1, y: CORNER_LINE - 0.1 }), 2)
	// Behind the hoop the corner line still runs to the baseline.
	assert.equal(pointsFor({ x: -8.25, y: 6.3 }), 3)
	// Where the straight line meets the arc, the two agree.
	assert.equal(pointsFor({ x: HOOP.x + CORNER_REACH + 0.01, y: CORNER_LINE - 0.05 }), 2)
	assert.equal(pointsFor({ x: HOOP.x + CORNER_REACH + 0.01, y: CORNER_LINE + 0.05 }), 3)
})

test('points add up until the round is finished, including a shot in the air at the buzzer', () => {
	let round = startClock(startClockRound(0), 0)
	round = recordMake(recordMake(round, 2), 3)
	assert.equal(isTimeUp(round, 61), true)
	round = recordMake(round, 2)
	assert.equal(round.points, 7)
	round = finishRound(round)
	assert.equal(recordMake(round, 3).points, 7)
})

test('best only moves when a round finishes, and survives the next round', () => {
	let round = startClock(startClockRound(5), 0)
	for (let i = 0; i < 4; i++) round = recordMake(round, 2)
	assert.equal(round.best, 5)
	round = finishRound(round)
	assert.equal(round.best, 8)
	assert.equal(finishRound(startClockRound(round.best)).best, 8)
})

test('the clock stops when the round ends early', () => {
	let round = startClock(startClockRound(0), 10)
	round = finishRound(round, 43.4)
	assert.equal(secondsLeft(round, 43.4), 26.6)
	assert.equal(secondsLeft(round, 60), 26.6)
})

test('a two inside the key is in the paint, any other two is mid-range, and a three is a three', () => {
	assert.equal(zoneOf({ out: 0, across: 0, points: 2 }), 'paint')
	assert.equal(zoneOf({ out: KEY_LENGTH - 0.1, across: KEY_HALF_WIDTH - 0.1, points: 2 }), 'paint')
	assert.equal(zoneOf({ out: KEY_LENGTH + 0.1, across: 0, points: 2 }), 'mid')
	assert.equal(zoneOf({ out: 1, across: KEY_HALF_WIDTH + 0.1, points: 2 }), 'mid')
	assert.equal(zoneOf({ out: 7, across: 0, points: 3 }), 'three')
	assert.equal(zoneOf({ out: 3.9, across: 3, points: 2, dunk: true }), 'paint')
})
