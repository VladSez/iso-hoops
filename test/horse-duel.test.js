import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyRecord, firstShooter, parseRecord, recordDuelShot, recordResult, startDuel, tossCoin, turnOf } from '../dist/horse-duel.js'

const spot = { x: 0, y: 2 }
const shot = (by, made, from = spot) => ({ by, made, from })
const youFirst = level => startDuel(level, 'you')

test('you call the coin, and calling it right means you set the first shot', () => {
	assert.equal(tossCoin(() => 0.2), 'heads')
	assert.equal(tossCoin(() => 0.8), 'tails')
	assert.equal(firstShooter('heads', 'heads'), 'you')
	assert.equal(firstShooter('heads', 'tails'), 'cpu')
	const duel = startDuel('easy', firstShooter('tails', 'heads'))
	assert.equal(duel.shooter, 'cpu')
	assert.equal(duel.phase, 'set')
})

test('a made set has to be matched from the same spot by the other player', () => {
	const duel = recordDuelShot(youFirst('medium'), shot('you', true, { x: 1.5, y: -3 }))
	assert.equal(duel.phase, 'match')
	assert.deepEqual(duel.spot, { x: 1.5, y: -3 })
	assert.equal(duel.shooter, 'you')
	assert.equal(turnOf(duel), 'cpu')
})

test('a missed set passes the ball', () => {
	const duel = recordDuelShot(youFirst('medium'), shot('you', false))
	assert.equal(duel.phase, 'set')
	assert.equal(duel.shooter, 'cpu')
	assert.deepEqual(duel.letters, { you: 0, cpu: 0 })
})

test('a made match keeps the ball with the setter and clears the spot', () => {
	let duel = recordDuelShot(youFirst('medium'), shot('you', true))
	duel = recordDuelShot(duel, shot('cpu', true))
	assert.equal(duel.phase, 'set')
	assert.equal(duel.shooter, 'you')
	assert.equal(duel.spot, null)
	assert.deepEqual(duel.letters, { you: 0, cpu: 0 })
})

test('a missed match earns a letter and the setter keeps the ball', () => {
	let duel = recordDuelShot(youFirst('medium'), shot('you', true))
	duel = recordDuelShot(duel, shot('cpu', false))
	assert.deepEqual(duel.letters, { you: 0, cpu: 1 })
	assert.equal(duel.shooter, 'you')
	assert.equal(turnOf(duel), 'you')
})

test('spelling HORSE ends the game, with one try at each match, the last letter included', () => {
	let duel = youFirst('hard')
	for (let i = 0; i < 5; i++) {
		duel = recordDuelShot(duel, shot('you', true))
		duel = recordDuelShot(duel, shot('cpu', false))
	}
	assert.deepEqual(duel.letters, { you: 0, cpu: 5 })
	assert.equal(duel.winner, 'you')
	assert.deepEqual(recordDuelShot(duel, shot('you', true)), duel)
})

test('a shot out of turn changes nothing', () => {
	const duel = youFirst('easy')
	assert.equal(recordDuelShot(duel, shot('cpu', true)), duel)
})

test('a duel survives a round trip through JSON at every step, so it can be saved or sent', () => {
	let duel = startDuel('hard', 'cpu')
	const script = [true, false, true, true, false, false, true, false]
	for (const made of script) {
		duel = recordDuelShot(duel, shot(turnOf(duel), made))
		assert.deepEqual(JSON.parse(JSON.stringify(duel)), duel)
	}
})

test('the record counts wins and losses per level and ignores anything it does not recognise', () => {
	let record = recordResult(emptyRecord(), 'hard', true)
	record = recordResult(record, 'hard', false)
	record = recordResult(record, 'hard', false)
	assert.deepEqual(record.hard, { won: 1, lost: 2 })
	assert.deepEqual(record.easy, { won: 0, lost: 0 })
	assert.deepEqual(parseRecord(JSON.stringify(record)), record)
	assert.deepEqual(parseRecord('not json'), emptyRecord())
	assert.deepEqual(parseRecord('{"hard":{"won":-3,"lost":"x"},"extra":1}'), emptyRecord())
})
