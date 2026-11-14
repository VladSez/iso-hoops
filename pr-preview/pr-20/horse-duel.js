import { LETTERS } from './horse.js?v=4'

export const PLAYERS = ['you', 'cpu']
export const LEVELS = ['easy', 'medium', 'hard']

export const other = player => (player === 'you' ? 'cpu' : 'you')

export const SIDES = ['heads', 'tails']
export const tossCoin = (random = Math.random) => SIDES[random() < 0.5 ? 0 : 1]
/** You call the coin; calling it right means you shoot first. */
export const firstShooter = (called, landed) => (called === landed ? 'you' : 'cpu')

/**
 * A game of HORSE against the CPU, as plain data so it can be saved or sent. The shooter `set`s a shot from anywhere;
 * a make makes the other player `match` it from the same spot. A missed match earns a letter, and spelling HORSE loses.
 * `shooter` is whoever won the coin flip.
 */
export const startDuel = (level, shooter) => ({
	level,
	letters: { you: 0, cpu: 0 },
	shooter,
	phase: 'set',
	spot: null,
	winner: null,
})

/** Who takes the next shot: the shooter when setting, the other player when matching. */
export const turnOf = duel => (duel.phase === 'match' ? other(duel.shooter) : duel.shooter)

/** Moves the game on by one shot. `from` is where the shot was released, which a made set turns into the spot to match. */
export function recordDuelShot(duel, { by, made, from }) {
	if (duel.winner || by !== turnOf(duel)) return duel
	if (duel.phase === 'set') {
		return made
			? { ...duel, phase: 'match', spot: { x: from.x, y: from.y } }
			: { ...duel, shooter: other(duel.shooter) }
	}
	const cleared = { ...duel, phase: 'set', spot: null }
	if (made) return cleared
	const letters = { ...duel.letters, [by]: duel.letters[by] + 1 }
	const winner = letters[by] >= LETTERS.length ? duel.shooter : null
	return { ...cleared, letters, winner }
}

export const emptyRecord = () => Object.fromEntries(LEVELS.map(level => [level, { won: 0, lost: 0 }]))

/** Reads a saved win-loss record, keeping only counts it recognises. */
export function parseRecord(text) {
	const record = emptyRecord()
	let saved
	try { saved = JSON.parse(text) } catch { return record }
	for (const level of LEVELS) {
		for (const key of ['won', 'lost']) {
			const count = saved?.[level]?.[key]
			if (Number.isInteger(count) && count >= 0) record[level][key] = count
		}
	}
	return record
}

export const recordResult = (record, level, won) => ({
	...record,
	[level]: { ...record[level], [won ? 'won' : 'lost']: record[level][won ? 'won' : 'lost'] + 1 },
})
