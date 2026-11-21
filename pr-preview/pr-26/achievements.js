import { THREE_POINT_DISTANCE } from './beat-the-clock.js?v=7'
import { CHARACTERS } from './characters.js?v=2'
import { COURTS } from './courts.js?v=14'
import { DUNKS } from './dunks.js?v=4'

// The Court Journal: quiet badges for what the player does. Nothing here touches the page. game.js feeds in what the
// player did and shows what comes back.
//
// `stats` is every number the badges are read from. Each badge is one row of ACHIEVEMENTS, earned once `of(stats)` reaches
// its `goal`, so the toast, the ladder and the progress bars all read the same table.

export const GROUPS = [
	{ id: 'streaks', label: 'Streaks' },
	{ id: 'shooting', label: 'Shooting' },
	{ id: 'dunks', label: 'Dunks' },
	{ id: 'modes', label: 'Modes' },
	{ id: 'courts', label: 'Courts' },
]

const DUNK_COUNT = Object.keys(DUNKS).length
const COURT_COUNT = Object.keys(COURTS).length
const PHASE_COUNT = 4

export const ACHIEVEMENTS = [
	{ id: 'streak-5', group: 'streaks', title: 'Heating up', detail: '5 makes in a row', goal: 5, of: stats => stats.bestRun },
	{ id: 'streak-10', group: 'streaks', title: 'On fire', detail: '10 makes in a row', goal: 10, of: stats => stats.bestRun },
	{ id: 'streak-20', group: 'streaks', title: 'Red hot', detail: '20 makes in a row', goal: 20, of: stats => stats.bestRun },
	{ id: 'streak-50', group: 'streaks', title: 'In the zone', detail: '50 makes in a row', goal: 50, of: stats => stats.bestRun },
	{ id: 'streak-100', group: 'streaks', title: 'Unconscious', detail: '100 makes in a row', goal: 100, of: stats => stats.bestRun },
	{ id: 'streak-200', group: 'streaks', title: 'Automatic', detail: '200 makes in a row', goal: 200, of: stats => stats.bestRun },

	{ id: 'swish-10', group: 'shooting', title: 'Nothing but net', detail: '10 swishes, touching nothing', goal: 10, of: stats => stats.swishes },
	{ id: 'swish-50', group: 'shooting', title: 'Nothing but net II', detail: '50 swishes', goal: 50, of: stats => stats.swishes },
	{ id: 'banks', group: 'shooting', title: 'Glass cleaner', detail: '10 bank shots', goal: 10, of: stats => stats.banks },
	{ id: 'downtown', group: 'shooting', title: 'Downtown', detail: 'A make from 9 m', goal: 9, unit: 'm', of: stats => stats.longest },
	{ id: 'logo', group: 'shooting', title: 'Logo range', detail: 'A make from 12 m', goal: 12, unit: 'm', of: stats => stats.longest },
	{ id: 'regular', group: 'shooting', title: 'Regular', detail: '100 baskets', goal: 100, of: stats => stats.makes },
	{ id: 'home-court', group: 'shooting', title: 'Home court', detail: '1,000 baskets', goal: 1000, of: stats => stats.makes },

	{ id: 'dunk-1', group: 'dunks', title: 'Rim rattler', detail: 'Your first dunk', goal: 1, of: stats => stats.dunks.length },
	{ id: 'dunk-all', group: 'dunks', title: 'Dunk contest', detail: `All ${DUNK_COUNT} kinds of dunk`, goal: DUNK_COUNT, of: stats => stats.dunks.length },

	{ id: 'perfect-ten', group: 'modes', title: 'Perfect ten', detail: '10 of 10 free throws', goal: 1, of: stats => stats.perfectTen },
	{ id: 'ten-from-deep', group: 'modes', title: 'Ten from deep', detail: '10 of 10 from the three-point line', goal: 1, of: stats => stats.perfectTenFar },
	{ id: 'clock-30', group: 'modes', title: 'Beat the clock', detail: '30 points in 60 seconds', goal: 30, unit: 'pts', of: stats => stats.clockBest },
	{ id: 'clock-45', group: 'modes', title: 'Beat the clock II', detail: '45 points in 60 seconds', goal: 45, unit: 'pts', of: stats => stats.clockBest },
	{ id: 'clock-60', group: 'modes', title: 'Beat the clock III', detail: '60 points in 60 seconds', goal: 60, unit: 'pts', of: stats => stats.clockBest },
	{ id: 'buzzer', group: 'modes', title: 'Buzzer beater', detail: 'A basket that drops after time is up', goal: 1, of: stats => stats.buzzer },
	{ id: 'contest-20', group: 'modes', title: '3PT contest', detail: '20 points in the 3PT contest', goal: 20, unit: 'pts', of: stats => stats.contestBest },
	{ id: 'contest-30', group: 'modes', title: '3PT contest II', detail: '30 points in the 3PT contest', goal: 30, unit: 'pts', of: stats => stats.contestBest },
	{ id: 'contest-40', group: 'modes', title: '3PT contest III', detail: '40 points, a perfect contest', goal: 40, unit: 'pts', of: stats => stats.contestBest },
	{ id: 'money-man', group: 'modes', title: 'Money man', detail: 'Every money ball in one contest', goal: 1, of: stats => stats.moneyAll },
	{ id: 'cpu-easy', group: 'modes', title: 'Beat the CPU on Easy', detail: 'Win HORSE against the CPU on Easy', goal: 1, of: stats => stats.cpuWins.easy },
	{ id: 'cpu-medium', group: 'modes', title: 'Beat the CPU on Medium', detail: 'Win HORSE against the CPU on Medium', goal: 1, of: stats => stats.cpuWins.medium },
	{ id: 'cpu-hard', group: 'modes', title: 'Beat the CPU on Hard', detail: 'Win HORSE against the CPU on Hard', goal: 1, of: stats => stats.cpuWins.hard },
	{ id: 'full-roster', group: 'modes', title: 'Full roster', detail: `Beat all ${CHARACTERS.length} CPU players`, goal: CHARACTERS.length, of: stats => stats.cpuBeaten.length },
	{ id: 'clean-sheet', group: 'modes', title: 'Clean sheet', detail: 'Beat the CPU without taking a letter', goal: 1, of: stats => stats.horseClean },

	{ id: 'tourist', group: 'courts', title: 'Tourist', detail: `A basket on all ${COURT_COUNT} courts`, goal: COURT_COUNT, of: stats => stats.courts.length },
	{ id: 'dawn-to-dusk', group: 'courts', title: 'Dawn to dusk', detail: 'Score in the morning, day, evening and night, with the time on Auto', goal: PHASE_COUNT, of: stats => stats.phases.length },
	{ id: 'night-owl', group: 'courts', title: 'Night owl', detail: '100 baskets at night', goal: 100, of: stats => stats.nightMakes },
	{ id: 'first-snow', group: 'courts', title: 'First snow', detail: 'A three on the winter court', goal: 1, of: stats => stats.winterThrees },
]

export const STREAKS = ACHIEVEMENTS.filter(achievement => achievement.group === 'streaks')

const KNOWN = new Set(ACHIEVEMENTS.map(achievement => achievement.id))

const freshStats = () => ({
	// `run` is makes in a row since the last miss. It lives in memory only, so a reload starts it again.
	// `runBase` is the best run when this one began, which says whether the run that just ended set a record.
	run: 0, runBase: 0, bestRun: 0,
	makes: 0, swishes: 0, banks: 0, longest: 0, buzzer: 0, nightMakes: 0, winterThrees: 0,
	dunks: [], courts: [], phases: [],
	perfectTen: 0, perfectTenFar: 0, clockBest: 0, contestBest: 0, moneyAll: 0, horseClean: 0,
	cpuWins: { easy: 0, medium: 0, hard: 0 }, cpuBeaten: [],
})

export const startProgress = () => ({ stats: freshStats(), earned: {} })

/** Reads saved progress, keeping only what it recognises, and starts the run again. */
export function parseProgress(text) {
	const progress = startProgress()
	let saved
	try { saved = JSON.parse(text) } catch { return progress }
	if (!saved || typeof saved !== 'object') return progress
	const base = progress.stats
	for (const [key, value] of Object.entries(saved.stats ?? {})) {
		if (!(key in base) || key === 'run' || key === 'runBase') continue
		if (Array.isArray(base[key])) {
			if (Array.isArray(value)) base[key] = value.filter(item => typeof item === 'string')
		} else if (typeof base[key] === 'object') {
			for (const level of Object.keys(base[key])) if (Number.isFinite(value?.[level])) base[key][level] = value[level]
		} else if (Number.isFinite(value)) {
			base[key] = value
		}
	}
	for (const [id, date] of Object.entries(saved.earned ?? {})) if (KNOWN.has(id) && typeof date === 'string') progress.earned[id] = date
	return progress
}

const addTo = (list, item) => (list.includes(item) ? list : [...list, item])

function afterShot(stats, shot) {
	const next = { ...stats }
	let ended
	if (shot.made) {
		next.makes++
		next.courts = addTo(stats.courts, shot.court)
		if (shot.autoTime) next.phases = addTo(stats.phases, shot.phase)
		if (shot.phase === 'night') next.nightMakes++
		if (shot.buzzer) next.buzzer++
	}
	if (shot.dunk) {
		// A dunk is never counted in the run, and never ends it.
		if (shot.made) next.dunks = addTo(stats.dunks, shot.dunk)
		return { stats: next }
	}
	if (shot.made) {
		if (stats.run === 0) next.runBase = stats.bestRun
		next.run = stats.run + 1
		next.bestRun = Math.max(stats.bestRun, next.run)
		if (shot.swish) next.swishes++
		if (shot.banked) next.banks++
		next.longest = Math.max(stats.longest, shot.distance)
		if (shot.three && shot.court === 'winter') next.winterThrees++
	} else if (stats.run > 0) {
		ended = { length: stats.run, best: stats.run > stats.runBase }
		next.run = 0
	}
	return { stats: next, ended }
}

function afterRound(stats, round) {
	const next = { ...stats }
	if (round.mode === 'free-throws') {
		if (round.made >= 10) next.perfectTen++
		if (round.made >= 10 && round.distance >= THREE_POINT_DISTANCE) next.perfectTenFar++
	} else if (round.mode === 'clock') {
		next.clockBest = Math.max(stats.clockBest, round.points)
	} else if (round.mode === 'three-point') {
		next.contestBest = Math.max(stats.contestBest, round.points)
		if (round.allMoney) next.moneyAll++
	} else if (round.mode === 'horse' && round.won) {
		next.cpuWins = { ...stats.cpuWins, [round.level]: stats.cpuWins[round.level] + 1 }
		next.cpuBeaten = addTo(stats.cpuBeaten, round.character)
		if (round.letters === 0) next.horseClean++
	}
	return { stats: next }
}

function award(progress, stats, date) {
	const earned = []
	const marks = {}
	for (const achievement of ACHIEVEMENTS) {
		if (progress.earned[achievement.id] || achievement.of(stats) < achievement.goal) continue
		marks[achievement.id] = date
		earned.push(achievement.id)
	}
	return { earned, progress: { stats, earned: { ...progress.earned, ...marks } } }
}

const today = () => {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Applies one thing the player did and says which badges it earned. A shot is `{ type: 'shot', made, swish, banked,
 * distance, three, dunk, buzzer, court, phase, autoTime }` where `dunk` is the dunk's id, and only the player's shots count.
 * A round is `{ type: 'round', mode, ... }` with what that mode's round ends on. `ended` is the run a miss just ended.
 */
export function record(progress, event, date = today()) {
	const { stats, ended } = event.type === 'shot' ? afterShot(progress.stats, event) : afterRound(progress.stats, event)
	return { ...award(progress, stats, date), ended }
}

/** Credits what the player saved before the Journal existed, so nobody starts from zero. Safe to repeat. */
export function seed(progress, bests, date = today()) {
	const stats = { ...progress.stats, cpuWins: { ...progress.stats.cpuWins } }
	stats.longest = Math.max(stats.longest, bests.longest ?? 0)
	stats.clockBest = Math.max(stats.clockBest, bests.clock ?? 0)
	stats.contestBest = Math.max(stats.contestBest, bests.threePoint ?? 0)
	if ((bests.freeThrow ?? 0) >= 10) stats.perfectTen = Math.max(stats.perfectTen, 1)
	for (const level of Object.keys(stats.cpuWins)) stats.cpuWins[level] = Math.max(stats.cpuWins[level], bests.cpuWins?.[level] ?? 0)
	return award(progress, stats, date).progress
}

/** How far along a badge is: the number shown, the goal, and a share from 0 to 1. */
export function progressOf(achievement, stats) {
	const value = achievement.of(stats)
	return { value, goal: achievement.goal, share: Math.min(1, value / achievement.goal) }
}

/** The unearned badges nearest to done, leaving out streaks, which have their own ladder. Badges not started come last. */
export function closest(progress, count) {
	return ACHIEVEMENTS
		.filter(achievement => achievement.group !== 'streaks' && !progress.earned[achievement.id])
		.map((achievement, index) => ({ achievement, index, share: progressOf(achievement, progress.stats).share }))
		.sort((a, b) => b.share - a.share || a.index - b.index)
		.slice(0, count)
		.map(entry => entry.achievement)
}

/** The first streak badge beyond `count` makes in a row. */
export const nextStreak = count => STREAKS.find(achievement => achievement.goal > count)
