import test from 'node:test'
import assert from 'node:assert/strict'
import { clockResults, contestResults, freeThrowResults, horseResults, longestRun } from '../dist/results.js'
import { SHOT_COUNT } from '../dist/three-point.js'

const statOf = (results, label) => results.stats.find(stat => stat.label === label)

test('the contest card shows every ball by rack, with money and deep balls counted apart', () => {
	// Money rack 3 (index 2). Miss the third ball of rack 1 and the money ball of rack 2; leave the last 5 unshot.
	const log = []
	for (let shot = 0; shot < SHOT_COUNT - 5; shot++) log.push({ shot, made: shot !== 2 && shot !== 9 })
	const results = contestResults({ log, moneyRack: 2, points: 30, best: 30, bestBefore: 27, secondsLeft: 0, racksDone: false })
	assert.equal(results.label, '3PT CONTEST · TIME!')
	assert.deepEqual(results.stamp, { text: 'NEW BEST', detail: 'was 27' })
	const [rack1, rack2, deep1, rack3] = results.chart.columns
	assert.deepEqual(rack1.balls.map(ball => ball.outcome), ['made', 'made', 'missed', 'made', 'made'])
	assert.equal(rack1.points, 5)
	assert.equal(rack2.points, 4)
	assert.equal(deep1.points, 3)
	assert.ok(rack3.isMoney)
	assert.equal(rack3.points, 10)
	assert.ok(results.chart.columns.at(-1).balls.every(ball => ball.outcome === 'unshot'))
	assert.deepEqual(statOf(results, 'MADE'), { value: 20, of: 27, label: 'MADE' })
	assert.equal(statOf(results, 'ACCURACY').value, '91%')
	assert.equal(results.note, 'Best rack: rack 3, 10 of 10')
})

test('the contest card counts seconds left the way the header does', () => {
	const results = contestResults({ log: [], moneyRack: 0, points: 0, best: 0, bestBefore: 0, secondsLeft: 26.4, racksDone: true })
	assert.equal(results.side, '27 S LEFT')
})

test('a first round sets the bar without a stamp, and later rounds say how far off the best they were', () => {
	assert.equal(clockResults({ log: [], points: 0, best: 0, bestBefore: 0 }).stamp, undefined)
	assert.equal(clockResults({ log: [], points: 30, best: 34, bestBefore: 34 }).scoreNote, 'points · 4 short of your best')
	assert.equal(clockResults({ log: [], points: 34, best: 34, bestBefore: 34 }).scoreNote, 'points · ties your best')
})

test('the clock card splits baskets into threes and twos and finds the longest', () => {
	const log = [
		{ at: 2, made: true, points: 3, distance: 7.4 },
		{ at: 5, made: false, points: 2, distance: 3 },
		{ at: 9, made: true, points: 2, distance: 4.1 },
	]
	const results = clockResults({ log, points: 5, best: 5, bestBefore: 0 })
	assert.deepEqual(results.stats.map(stat => stat.value), [2, 1, 1, '67%', '7.4'])
	assert.deepEqual(results.chart.shots, [{ at: 2, points: 3 }, { at: 5, points: 0 }, { at: 9, points: 2 }])
})

test('the free throw card counts the longest run and names the next distance', () => {
	assert.equal(longestRun([true, true, false, true, true, true, false].map(made => ({ made }))), 3)
	const log = [true, true, false, true, true, true, true, true, false, true].map(made => ({ made }))
	const results = freeThrowResults({ log, made: 8, level: 2, distance: 5.5, nextDistance: 6, best: 9, bestBefore: 9 })
	assert.equal(results.scoreNote, '1 short of your best')
	assert.equal(statOf(results, 'IN A ROW').value, 5)
	assert.equal(results.note, 'The line moves back.')
	assert.equal(results.action, 'Round 3')
	assert.equal(results.actionDetail, 'FROM 6 M')
})

test('the HORSE card lists the spots reached, with each letter where it was earned', () => {
	const log = [
		{ tier: 0, made: true, distance: 4.2 }, { tier: 0, made: true, distance: 4.8 }, { tier: 0, made: false, letter: 'H' },
		{ tier: 0, made: true, distance: 4.5 }, { tier: 1, made: false, letter: 'O' }, { tier: 1, made: false, letter: 'R' },
		{ tier: 1, made: false, letter: 'S' }, { tier: 1, made: true, distance: 5.9 }, { tier: 1, made: false, letter: 'E' },
	]
	const results = horseResults({ log, made: 4, best: 4, bestBefore: 0 })
	assert.deepEqual(results.chart.rows.map(row => row.marks), [['', '', 'H', ''], ['O', 'R', 'S', '', 'E']])
	assert.equal(statOf(results, 'FARTHEST MAKE').value, '5.9')
	assert.equal(statOf(results, 'REACHED').value, 'Long two')
	assert.equal(results.note, 'First letter at the mid-range')
})

test('a dunk against the clock counts as a two but never as the longest make', () => {
	const log = [{ at: 3, made: true, points: 2, distance: 0 }, { at: 9, made: true, points: 2, distance: 4.2 }]
	const stats = Object.fromEntries(clockResults({ log, points: 4, best: 4, bestBefore: 0 }).stats.map(stat => [stat.label, stat]))
	assert.equal(stats.TWOS.value, 2)
	assert.equal(stats.LONGEST.value, '4.2')
	assert.equal(clockResults({ log: log.slice(0, 1), points: 2, best: 2, bestBefore: 0 }).stats.find(stat => stat.label === 'LONGEST').value, '—')
})
