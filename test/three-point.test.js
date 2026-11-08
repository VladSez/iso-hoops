import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP, createShot, stepBall } from '../dist/physics.js'
import { finishRound, recordMake, startClock } from '../dist/beat-the-clock.js'
import {
	BALLS_PER_RACK, RACK_COUNT, SHOTS, SHOT_COUNT, STATIONS, ballsLeft, chooseMoneyRack, maxPoints, nextShot, startContest, takeBall, valueOf,
} from '../dist/three-point.js'

function scores(spot, power) {
	const ball = createShot(spot, Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x), power)
	for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
	return ball.made
}

test('five racks of five and two deep balls, shot in the NBA order', () => {
	assert.equal(SHOT_COUNT, RACK_COUNT * BALLS_PER_RACK + 2)
	assert.deepEqual(STATIONS.map(station => station.rack ?? `deep ${station.deep}`), [0, 1, 'deep 0', 2, 'deep 1', 3, 4])
})

test('every spot is beyond the arc and where the player can stand', () => {
	for (const { spot } of STATIONS) {
		assert.ok(Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y) > 6.7)
		assert.ok(spot.x > HOOP.x && spot.x <= 8.3 && Math.abs(spot.y) <= 6.3)
	}
})

test('every power inside a spot’s band scores', () => {
	for (const { spot, window } of STATIONS) {
		assert.ok(window.max - window.min >= 0.04)
		for (let power = window.min; power <= window.max + 1e-9; power += 0.0025) assert.ok(scores(spot, power), `${power} from ${spot.x}, ${spot.y}`)
	}
})

test('money balls are worth 2, the money rack is all money balls, deep balls are worth 3, for 40 at most', () => {
	const moneyRack = 1
	const values = SHOTS.map(shot => valueOf(shot, moneyRack))
	assert.deepEqual(values.slice(0, 5), [1, 1, 1, 1, 2])
	assert.deepEqual(values.slice(5, 10), [2, 2, 2, 2, 2])
	assert.equal(values[10], 3)
	for (let rack = 0; rack < RACK_COUNT; rack++) assert.equal(maxPoints(rack), 40)
})

test('the money rack can only be changed before the clock starts', () => {
	let contest = chooseMoneyRack(startContest(0), -1)
	assert.equal(contest.moneyRack, RACK_COUNT - 1)
	contest = chooseMoneyRack(contest, 2)
	assert.equal(contest.moneyRack, 2)
	contest = startClock(contest, 0)
	assert.equal(chooseMoneyRack(contest, 0).moneyRack, 2)
})

test('balls leave the racks in order, and the racks run out', () => {
	let contest = startContest(0)
	assert.equal(ballsLeft(contest, 0), BALLS_PER_RACK)
	for (let i = 0; i < 6; i++) contest = takeBall(contest)
	assert.equal(ballsLeft(contest, 0), 0)
	assert.equal(ballsLeft(contest, 1), BALLS_PER_RACK - 1)
	assert.equal(ballsLeft(contest, 2), 1)
	for (let i = 0; i < SHOT_COUNT; i++) contest = takeBall(contest)
	assert.equal(nextShot(contest), undefined)
	assert.equal(contest.taken, SHOT_COUNT)
})

test('the best score moves when the contest ends', () => {
	let contest = startClock(startContest(12), 0)
	contest = recordMake(contest, 2)
	assert.equal(contest.best, 12)
	contest = finishRound({ ...contest, points: 20 })
	assert.equal(contest.best, 20)
	assert.equal(recordMake(contest, 3).points, 20)
})
