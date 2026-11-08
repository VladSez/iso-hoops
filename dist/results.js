import { ROUND_SHOTS } from './free-throws.js?v=5'
import { LETTERS, TIERS } from './horse.js?v=2'
import { SHOTS, STATIONS, valueOf } from './three-point.js?v=1'

// Each mode's round summary for the card shown when a round ends. These are plain data: game.js draws them. A round's
// `log` holds one entry per shot, in order, as game.js records it.

const percent = (made, taken) => (taken ? `${Math.round(made / taken * 100)}%` : '—')
const count = (log, test) => log.filter(test).length
const farthest = log => Math.max(0, ...log.filter(shot => shot.made).map(shot => shot.distance))
const metres = distance => (distance ? { value: distance.toFixed(1), unit: 'm' } : { value: '—' })

/** The stamp for beating a previous best. A first round only sets the bar, so it gets none. */
const newBest = (best, bestBefore) => (best > bestBefore && bestBefore > 0 ? { text: 'NEW BEST', detail: `was ${bestBefore}` } : undefined)

function againstBest(score, best, bestBefore) {
	if (newBest(best, bestBefore) || bestBefore === 0) return ''
	return score === best ? 'ties your best' : `${best - score} short of your best`
}

const joined = (...parts) => parts.filter(Boolean).join(' · ')

export function contestResults({ log, moneyRack, points, best, bestBefore, secondsLeft, racksDone }) {
	const results = new Map(log.map(shot => [shot.shot, shot.made]))
	const outcome = index => (results.has(index) ? (results.get(index) ? 'made' : 'missed') : 'unshot')
	const columns = STATIONS.map((station, stationIndex) => {
		const balls = []
		let scored = 0
		SHOTS.forEach((shot, index) => {
			if (shot.station !== stationIndex) return
			const value = valueOf(shot, moneyRack)
			balls.push({ value, outcome: outcome(index) })
			if (outcome(index) === 'made') scored += value
		})
		const isMoney = station.rack === moneyRack
		return { label: station.deep === undefined ? `RACK ${station.rack + 1}` : 'DEEP', isMoney, points: scored, balls }
	})
	const all = columns.flatMap(column => column.balls)
	const madeOf = value => count(all, ball => ball.value === value && ball.outcome === 'made')
	const racks = columns.filter(column => column.label !== 'DEEP')
	const bestRack = racks.reduce((top, rack) => (rack.points > top.points ? rack : top), racks[0])
	const rackMax = rack => rack.balls.reduce((total, ball) => total + ball.value, 0)
	return {
		label: `3PT CONTEST · ${racksDone ? 'RACKS DONE' : 'TIME!'}`,
		side: racksDone ? `${Math.floor(secondsLeft)} S LEFT` : '',
		score: String(points),
		scoreNote: joined('/ 40 points', againstBest(points, best, bestBefore)),
		stamp: newBest(best, bestBefore),
		chart: { type: 'racks', columns },
		stats: [
			{ value: count(all, ball => ball.outcome === 'made'), of: all.length, label: 'MADE' },
			{ value: percent(count(log, shot => shot.made), log.length), label: 'ACCURACY' },
			{ value: madeOf(2), of: count(all, ball => ball.value === 2), label: 'MONEY BALLS' },
			{ value: madeOf(3), of: count(all, ball => ball.value === 3), label: 'DEEP BALLS' },
		],
		note: bestRack.points ? `Best rack: ${bestRack.label.toLowerCase()}, ${bestRack.points} of ${rackMax(bestRack)}` : '',
	}
}

export function clockResults({ log, points, best, bestBefore }) {
	const made = log.filter(shot => shot.made)
	return {
		label: 'BEAT THE CLOCK · TIME!',
		side: '',
		score: String(points),
		scoreNote: joined('points', againstBest(points, best, bestBefore)),
		stamp: newBest(best, bestBefore),
		chart: { type: 'timeline', shots: log.map(shot => ({ at: shot.at, points: shot.made ? shot.points : 0 })) },
		stats: [
			{ value: made.length, label: 'BASKETS' },
			{ value: count(made, shot => shot.points === 3), label: 'THREES' },
			{ value: count(made, shot => shot.points === 2), label: 'TWOS' },
			{ value: percent(made.length, log.length), label: `${made.length} OF ${log.length}` },
			{ ...metres(farthest(log)), label: 'LONGEST' },
		],
		note: '',
	}
}

export function longestRun(log) {
	let run = 0
	let longest = 0
	for (const shot of log) {
		run = shot.made ? run + 1 : 0
		longest = Math.max(longest, run)
	}
	return longest
}

export function freeThrowResults({ log, made, level, distance, nextDistance, best, bestBefore }) {
	return {
		label: `10 FREE THROWS · ROUND ${level} · ${distance} M`,
		side: '',
		score: String(made),
		scoreUnit: `/${ROUND_SHOTS}`,
		scoreNote: againstBest(made, best, bestBefore),
		stamp: newBest(best, bestBefore),
		chart: { type: 'shots', shots: log.map(shot => shot.made) },
		stats: [
			{ value: percent(made, log.length), label: 'ACCURACY' },
			{ value: longestRun(log), label: 'IN A ROW' },
			{ value: best, of: ROUND_SHOTS, label: 'BEST' },
		],
		note: nextDistance > distance ? 'The line moves back.' : 'Same line again.',
		action: `Round ${level + 1}`,
		actionDetail: `FROM ${nextDistance} M`,
	}
}

const TIER_NAMES = ['Mid-range', 'Long two', 'Inside the arc', 'Threes']

export function horseResults({ log, made, best, bestBefore }) {
	const reached = Math.max(0, ...log.map(shot => shot.tier))
	const rows = TIERS.slice(0, reached + 1).map((tier, index) => ({
		name: TIER_NAMES[index],
		range: `${tier.min}–${tier.max} m`,
		marks: log.filter(shot => shot.tier === index).map(shot => (shot.made ? '' : shot.letter)),
	}))
	const firstMiss = log.find(shot => !shot.made)
	return {
		label: 'HORSE · GAME OVER',
		side: LETTERS.join('·'),
		score: String(made),
		scoreNote: joined('made', againstBest(made, best, bestBefore)),
		stamp: newBest(best, bestBefore),
		chart: { type: 'ladder', rows },
		stats: [
			{ value: made, of: log.length, label: 'MADE' },
			{ ...metres(farthest(log)), label: 'FARTHEST MAKE' },
			{ value: TIER_NAMES[reached], label: 'REACHED' },
		],
		note: firstMiss ? `First letter at the ${TIER_NAMES[firstMiss.tier].toLowerCase()}` : '',
		action: 'New game',
	}
}
