import test from 'node:test'
import assert from 'node:assert/strict'
import { ACHIEVEMENTS, GROUPS, closest, nextStreak, parseProgress, record, seed, startProgress } from '../dist/achievements.js'
import { DUNKS } from '../dist/dunks.js'
import { COURTS } from '../dist/courts.js'
import { CHARACTERS } from '../dist/characters.js'

const DATE = '2026-11-21'
const shot = (extra = {}) => ({ type: 'shot', made: true, swish: false, banked: false, distance: 5, three: false, court: 'neighborhood', phase: 'day', autoTime: true, ...extra })
const miss = (extra = {}) => shot({ made: false, ...extra })

function play(events, progress = startProgress()) {
	const earned = []
	for (const event of events) {
		const result = record(progress, event, DATE)
		progress = result.progress
		earned.push(...result.earned)
	}
	return { progress, earned }
}
const times = (count, event) => Array.from({ length: count }, () => event)

test('every badge belongs to a group and has a reachable goal', () => {
	const groups = new Set(GROUPS.map(group => group.id))
	assert.equal(new Set(ACHIEVEMENTS.map(achievement => achievement.id)).size, ACHIEVEMENTS.length)
	for (const achievement of ACHIEVEMENTS) {
		assert.ok(groups.has(achievement.group), achievement.id)
		assert.ok(achievement.goal > 0, achievement.id)
		assert.equal(achievement.of(startProgress().stats), 0, achievement.id)
	}
})

test('each streak step unlocks on exactly its count', () => {
	for (const goal of [5, 10, 20, 50, 100, 200]) {
		const { progress, earned } = play(times(goal - 1, shot()))
		assert.ok(!earned.some(id => id.startsWith('streak-') && id === `streak-${goal}`), `streak-${goal} too early`)
		const last = record(progress, shot(), DATE)
		assert.ok(last.earned.includes(`streak-${goal}`), `streak-${goal} on the ${goal}th make`)
	}
})

test('a miss resets the run but keeps the best', () => {
	const { progress } = play([...times(4, shot()), miss(), ...times(3, shot())])
	assert.equal(progress.stats.run, 3)
	assert.equal(progress.stats.bestRun, 4)
	assert.ok(!progress.earned['streak-5'])
})

test('a dunk neither extends nor breaks a run', () => {
	const { progress, earned } = play([...times(4, shot()), shot({ dunk: 'flush' }), shot({ dunk: 'tomahawk' })])
	assert.equal(progress.stats.run, 4)
	assert.deepEqual(earned, ['dunk-1'])
	const fifth = record(progress, shot(), DATE)
	assert.ok(fifth.earned.includes('streak-5'))
})

test('a run ends with a note about whether it was a record', () => {
	const first = play(times(6, shot())).progress
	const ended = record(first, miss(), DATE).ended
	assert.deepEqual(ended, { length: 6, best: true })
	const again = play([miss(), ...times(5, shot())], first).progress
	assert.deepEqual(record(again, miss(), DATE).ended, { length: 5, best: false })
	assert.equal(record(startProgress(), miss(), DATE).ended, undefined)
})

test('a swish is a make that touched nothing, a bank is not one', () => {
	const swished = play([shot({ swish: true })])
	assert.deepEqual(swished.earned, [])
	assert.equal(swished.progress.stats.swishes, 1)
	const banked = play([shot({ banked: true, swish: false })])
	assert.deepEqual(banked.earned, [])
	assert.equal(banked.progress.stats.banks, 1)
	assert.equal(banked.progress.stats.swishes, 0)
	const ten = play(times(10, shot({ banked: true }))).earned
	assert.ok(ten.includes('banks'))
})

test('swish counts reach both tiers', () => {
	assert.ok(play(times(10, shot({ swish: true }))).earned.includes('swish-10'))
	assert.ok(play(times(50, shot({ swish: true }))).earned.includes('swish-50'))
	assert.ok(!play(times(49, shot({ swish: true }))).earned.includes('swish-50'))
})

test('distance badges read the longest make and ignore dunks and misses', () => {
	assert.ok(!play([miss({ distance: 12.5 })]).earned.includes('logo'))
	assert.ok(!play([shot({ dunk: 'flush', distance: 12.5 })]).earned.includes('logo'))
	assert.ok(play([shot({ distance: 9.2 })]).earned.includes('downtown'))
	const far = play([shot({ distance: 12.1 })]).earned
	assert.ok(far.includes('downtown') && far.includes('logo'))
})

test('baskets add up to the volume badges', () => {
	assert.ok(play(times(100, shot())).earned.includes('regular'))
	assert.ok(!play(times(99, shot())).earned.includes('regular'))
	assert.ok(play(times(1000, shot())).earned.includes('home-court'))
})

test('dunks are tracked by kind, and Dunk contest needs every kind', () => {
	const kinds = Object.keys(DUNKS)
	const partial = play([...kinds.slice(1).map(dunk => shot({ dunk })), shot({ dunk: kinds[1] })])
	assert.ok(partial.earned.includes('dunk-1'))
	assert.ok(!partial.earned.includes('dunk-all'))
	assert.ok(play(kinds.map(dunk => shot({ dunk }))).earned.includes('dunk-all'))
})

test('a basket on every court earns Tourist', () => {
	const events = Object.keys(COURTS).map(court => shot({ court }))
	assert.ok(!play(events.slice(1)).earned.includes('tourist'))
	assert.ok(play(events).earned.includes('tourist'))
})

test('Dawn to dusk needs all four times of day on Auto, and a pinned time does not count', () => {
	const phases = ['morning', 'day', 'evening', 'night']
	assert.ok(play(phases.map(phase => shot({ phase, autoTime: true }))).earned.includes('dawn-to-dusk'))
	const pinned = play([...phases.slice(0, 3).map(phase => shot({ phase, autoTime: true })), shot({ phase: 'night', autoTime: false })])
	assert.ok(!pinned.earned.includes('dawn-to-dusk'))
	assert.equal(pinned.progress.stats.phases.length, 3)
})

test('Night owl counts baskets at night and First snow a three on the winter court', () => {
	assert.ok(play(times(100, shot({ phase: 'night' }))).earned.includes('night-owl'))
	assert.ok(!play(times(99, shot({ phase: 'night' }))).earned.includes('night-owl'))
	assert.ok(!play([shot({ court: 'winter', three: false })]).earned.includes('first-snow'))
	assert.ok(!play([shot({ court: 'beach', three: true })]).earned.includes('first-snow'))
	assert.ok(play([shot({ court: 'winter', three: true })]).earned.includes('first-snow'))
})

test('Buzzer beater needs a make after time was up', () => {
	assert.ok(!play([shot()]).earned.includes('buzzer'))
	assert.ok(!play([miss({ buzzer: true })]).earned.includes('buzzer'))
	assert.ok(play([shot({ buzzer: true })]).earned.includes('buzzer'))
})

test('free throw rounds earn Perfect ten, and Ten from deep only from the three-point line', () => {
	assert.deepEqual(play([{ type: 'round', mode: 'free-throws', made: 9, distance: 6.7 }]).earned, [])
	assert.deepEqual(play([{ type: 'round', mode: 'free-throws', made: 10, distance: 4.5 }]).earned, ['perfect-ten'])
	assert.deepEqual(play([{ type: 'round', mode: 'free-throws', made: 10, distance: 6.7 }]).earned, ['perfect-ten', 'ten-from-deep'])
})

test('Beat the clock and the 3PT contest tiers follow the best score', () => {
	assert.deepEqual(play([{ type: 'round', mode: 'clock', points: 46 }]).earned, ['clock-30', 'clock-45'])
	assert.deepEqual(play([{ type: 'round', mode: 'three-point', points: 30, allMoney: false }]).earned, ['contest-20', 'contest-30'])
	assert.deepEqual(play([{ type: 'round', mode: 'three-point', points: 12, allMoney: true }]).earned, ['money-man'])
})

test('the duel earns a win per level, each character once, and a clean sheet', () => {
	const win = (level, character, letters = 2) => ({ type: 'round', mode: 'horse', won: true, level, character, letters })
	assert.deepEqual(play([{ ...win('easy', 'rae'), won: false }]).earned, [])
	assert.deepEqual(play([win('easy', 'rae')]).earned, ['cpu-easy'])
	assert.deepEqual(play([win('hard', 'rae', 0)]).earned, ['cpu-hard', 'clean-sheet'])
	const roster = CHARACTERS.map(character => win('medium', character.id))
	const { progress, earned } = play([...roster.slice(0, -1), roster[0]])
	assert.ok(!earned.includes('full-roster'))
	assert.ok(play([...roster], progress).earned.includes('full-roster'))
})

test('an earned badge is reported once and stays marked with its date', () => {
	const first = play(times(5, shot()))
	assert.deepEqual(first.earned.filter(id => id === 'streak-5'), ['streak-5'])
	const again = play(times(6, shot()), first.progress)
	assert.ok(!again.earned.includes('streak-5'))
	assert.equal(again.progress.earned['streak-5'], DATE)
})


test('seeding credits saved bests once and never lowers anything', () => {
	const bests = { longest: 9.5, freeThrow: 10, clock: 46, threePoint: 21, cpuWins: { easy: 3, medium: 0, hard: 1 } }
	const seeded = seed(startProgress(), bests, DATE)
	for (const id of ['downtown', 'perfect-ten', 'clock-30', 'clock-45', 'contest-20', 'cpu-easy', 'cpu-hard']) assert.equal(seeded.earned[id], DATE, id)
	for (const id of ['logo', 'clock-60', 'cpu-medium', 'ten-from-deep']) assert.ok(!seeded.earned[id], id)
	const twice = seed(seeded, bests, DATE)
	assert.deepEqual(twice, seeded)
	assert.equal(seed(seeded, { longest: 3 }, DATE).stats.longest, 9.5)
})

test('saved progress survives a round trip, with the run starting again', () => {
	const { progress } = play([...times(7, shot({ swish: true })), shot({ dunk: 'flush' })])
	const loaded = parseProgress(JSON.stringify(progress))
	assert.equal(loaded.stats.run, 0)
	assert.equal(loaded.stats.bestRun, 7)
	assert.equal(loaded.stats.swishes, 7)
	assert.deepEqual(loaded.stats.dunks, ['flush'])
	assert.deepEqual(loaded.earned, progress.earned)
	assert.deepEqual(parseProgress('not json'), startProgress())
	assert.deepEqual(parseProgress(JSON.stringify({ stats: { makes: 'many', swishes: 4 }, earned: { nonsense: DATE } })).stats.makes, 0)
	assert.deepEqual(parseProgress(JSON.stringify({ earned: { nonsense: DATE } })).earned, {})
})

test('the closest badges are the unearned ones furthest along, never streaks', () => {
	const { progress } = play([...times(34, shot({ swish: true })), shot({ distance: 10.4 })])
	const names = closest(progress, 2).map(achievement => achievement.id)
	assert.deepEqual(names, ['logo', 'swish-50'])
	assert.ok(closest(startProgress(), 2).every(achievement => achievement.group !== 'streaks'))
})

test('the next streak step is the first one beyond a count', () => {
	assert.equal(nextStreak(0).goal, 5)
	assert.equal(nextStreak(5).goal, 10)
	assert.equal(nextStreak(18).title, 'Red hot')
	assert.equal(nextStreak(200), undefined)
})
