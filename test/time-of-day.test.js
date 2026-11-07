import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHASES, hoursOf, phaseAt, resolvePhase } from '../dist/time-of-day.js'

const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

test('each local hour falls in the phase that has started by then', () => {
	const expected = {
		0: 'night', 4: 'night', 5: 'morning', 9: 'morning', 10: 'day', 16: 'day',
		17: 'evening', 19: 'evening', 20: 'night', 23: 'night',
	}
	for (const [hour, phase] of Object.entries(expected)) assert.equal(phaseAt(Number(hour)), phase, `${hour}:00`)
})

test('each phase names the hours it covers, night wrapping past midnight', () => {
	assert.deepEqual(Object.keys(PHASES).map(hoursOf), ['05–10', '10–17', '17–20', '20–05'])
})

test('a pinned phase wins over the clock, and auto follows it', () => {
	assert.equal(resolvePhase('morning', 23), 'morning')
	assert.equal(resolvePhase('auto', 23), 'night')
	assert.equal(resolvePhase('nonsense', 12), 'day')
})

for (const id of Object.keys(PHASES)) {
	test(`${id} has page colours and a Time menu option`, () => {
		assert.match(css, new RegExp(`\\[data-phase="${id}"\\]`), `style.css should colour the page for ${id}`)
		assert.match(html, new RegExp(`name="time" value="${id}"`), `index.html should offer ${id} in the Time menu`)
	})
}
