import test from 'node:test'
import assert from 'node:assert/strict'
import { COURTS } from '../dist/courts.js'
import { TRACKS, trackFor, pickTrack } from '../dist/music.js'

const fresh = { picks: {}, everywhere: null }

test('every court owns a named track', () => {
	assert.deepEqual(TRACKS.map(track => track.id), Object.keys(COURTS))
	for (const track of TRACKS) assert.ok(track.name, `${track.id} needs a name`)
})

test('a court plays its own track until the player picks another', () => {
	assert.equal(trackFor('autumn', fresh), 'autumn')
	const choice = pickTrack(fresh, 'autumn', 'beach')
	assert.equal(trackFor('autumn', choice), 'beach')
	assert.equal(trackFor('winter', choice), 'winter')
})

test('picking the court\'s own track forgets the pick', () => {
	const choice = pickTrack(pickTrack(fresh, 'autumn', 'beach'), 'autumn', 'autumn')
	assert.deepEqual(choice.picks, {})
})

test('a track for every court wins over each court\'s pick, and they come back when it is cleared', () => {
	const picked = pickTrack(fresh, 'autumn', 'beach')
	const everywhere = pickTrack({ ...picked, everywhere: 'winter' }, 'rooftop', 'rooftop')
	assert.equal(trackFor('autumn', everywhere), 'rooftop')
	assert.equal(trackFor('neighborhood', everywhere), 'rooftop')
	assert.equal(trackFor('autumn', { ...everywhere, everywhere: null }), 'beach')
})
