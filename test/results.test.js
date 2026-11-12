import test from 'node:test'
import assert from 'node:assert/strict'
import { clockResults, contestResults, dunkSpots, freeThrowResults, horseResults, longestRun } from '../dist/results.js'
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

test('the clock card counts makes by zone, plots each shot and finds the longest', () => {
	const log = [
		{ at: 2, made: true, points: 3, distance: 7.4, out: 7.3, across: 1.2 },
		{ at: 5, made: false, points: 2, distance: 3, out: 3, across: 0.2 },
		{ at: 9, made: true, points: 2, distance: 4.1, out: 2.2, across: 3.5 },
	]
	const results = clockResults({ log, points: 5, best: 5, bestBefore: 0 })
	assert.deepEqual(results.stats.map(stat => [stat.label, stat.value, stat.of]), [['PAINT', 0, 1], ['MID-RANGE', 1, 1], ['THREES', 1, 1], ['2 OF 3', '67%', undefined], ['LONGEST', '7.4', undefined]])
	assert.deepEqual(results.chart.shots, [
		{ at: 2, points: 3, out: 7.3, across: 1.2, made: true, three: true },
		{ at: 5, points: 0, out: 3, across: 0.2, made: false, three: false },
		{ at: 9, points: 2, out: 2.2, across: 3.5, made: true, three: false },
	])
	assert.deepEqual(results.chart.zones.map(zone => [zone.id, zone.made, zone.taken]), [['paint', 0, 1], ['mid', 1, 1], ['three', 1, 1]])
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

test('a dunk against the clock counts in the paint, from wherever it started, but never as the longest make', () => {
	const log = [{ at: 3, made: true, points: 2, distance: 0, out: 3.8, across: 2.9, dunk: true }, { at: 9, made: true, points: 2, distance: 4.2, out: 4.6, across: 1 }]
	const results = clockResults({ log, points: 4, best: 4, bestBefore: 0 })
	assert.deepEqual(statOf(results, 'PAINT'), { value: 1, of: 1, label: 'PAINT' })
	assert.deepEqual(statOf(results, 'MID-RANGE'), { value: 1, of: 1, label: 'MID-RANGE' })
	assert.equal(statOf(results, 'LONGEST').value, '4.2')
	assert.equal(statOf(clockResults({ log: log.slice(0, 1), points: 2, best: 2, bestBefore: 0 }), 'LONGEST').value, '—')
})

test('dunks are drawn just in front of the rim, on the side each came from', () => {
	const dunks = [[3.6, 1.2], [2, -2], [0.5, 4], [1, 0], [-1, 5]].map(([out, across]) => ({ out, across, dunk: true }))
	const spots = dunkSpots(dunks)
	for (const dunk of dunks) {
		const spot = spots.get(dunk)
		assert.ok(Math.abs(Math.hypot(spot.out, spot.across) - 0.9) < 1e-9, 'just in front of the rim')
		assert.equal(Math.sign(spot.across), Math.sign(dunk.across), 'on the side it came from')
		assert.ok(Math.abs(Math.atan2(spot.across, spot.out)) <= 1.9 + 1e-9, 'never past the baseline end of the arc')
	}
	const results = clockResults({ log: dunks.map((d, i) => ({ ...d, at: i, made: true, points: 2, distance: 0 })), points: 10, best: 10, bestBefore: 0 })
	assert.ok(results.chart.shots.every(shot => Math.abs(Math.hypot(shot.out, shot.across) - 0.9) < 1e-9))
})
