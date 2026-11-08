import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { FIXED, PHASES, PHASE_IDS, hoursOf, phaseAt, placeFor, resolvePhase, scheduleFor, zoneLabel } from '../dist/time-of-day.js'

const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

const at = (hours, minutes = 0) => hours * 60 + minutes
const near = (actual, expected, label, slack = 4) => assert.ok(Math.abs(actual - expected) <= slack, `${label}: ${actual} vs ${expected}`)

test('phases follow published sunrise and sunset through the seasons and daylight saving', () => {
	const warsaw = placeFor('Europe/Warsaw')
	const june = scheduleFor(new Date(2026, 5, 21), warsaw, -120)
	near(june.day, at(4, 14) + 120, 'Warsaw midsummer sunrise + 2h')
	near(june.evening, at(21, 1) - 90, 'Warsaw midsummer sunset − 90 min')
	const december = scheduleFor(new Date(2026, 11, 21), warsaw, -60)
	near(december.day, at(7, 43) + 120, 'Warsaw midwinter sunrise + 2h')
	near(december.evening, at(15, 25) - 90, 'Warsaw midwinter sunset − 90 min')
	const sydney = scheduleFor(new Date(2026, 5, 21), placeFor('Australia/Sydney'), -600)
	near(sydney.evening, at(16, 54) - 90, 'Sydney midwinter sunset − 90 min')
})

test('each schedule runs morning, day, evening, night in order', () => {
	for (const month of [0, 3, 6, 9]) {
		const s = scheduleFor(new Date(2026, month, 15), placeFor('America/New_York'), month > 2 && month < 10 ? 240 : 300)
		assert.ok(s.morning < s.day && s.day <= s.evening && s.evening < s.night, `month ${month}: ${JSON.stringify(s)}`)
	}
})

test('where the sun never rises or sets, phases fall back to fixed hours', () => {
	const svalbard = [78.2, 15.6]
	assert.deepEqual(scheduleFor(new Date(2026, 11, 21), svalbard, -60), FIXED)
	assert.deepEqual(scheduleFor(new Date(2026, 5, 21), svalbard, -120), FIXED)
})

test('listed zones use their reference city, under old names too', () => {
	assert.deepEqual(placeFor('Europe/Kiev'), placeFor('Europe/Kyiv'))
	assert.deepEqual(placeFor('Asia/Calcutta'), placeFor('Asia/Kolkata'))
	assert.deepEqual(placeFor('US/Eastern'), placeFor('America/New_York'))
	assert.deepEqual(placeFor('Turkey'), placeFor('Europe/Istanbul'))
})

test('other zones are estimated from their offset, region and daylight saving', () => {
	const noDst = { january: -300, july: -300 }
	assert.deepEqual(placeFor('Asia/Bishkek_Example', noDst), [30, 75], 'longitude from UTC+5, latitude from Asia')
	assert.ok(placeFor('America/Asuncion', { january: 180, july: 240 })[0] <= -35, 'summer time in January means south of the equator')
	assert.ok(placeFor('America/Halifax', { january: 240, july: 180 })[0] >= 40, 'summer time in July means well north')
	assert.ok(placeFor('America/Montevideo', { january: 180, july: 180 })[0] < -20, 'UTC−3 in the Americas is South America')
	const [lat, lon] = placeFor('Mars/Olympus_Mons', { january: 0, july: 0 })
	assert.deepEqual([lat, lon], [20, -0])
})

test('each minute falls in the phase that has started by then', () => {
	const s = { morning: at(6), day: at(9), evening: at(17), night: at(19) }
	const expected = [[at(0), 'night'], [at(5, 59), 'night'], [at(6), 'morning'], [at(9), 'day'], [at(16, 59), 'day'], [at(17), 'evening'], [at(19), 'night'], [at(23, 59), 'night']]
	for (const [minute, phase] of expected) assert.equal(phaseAt(minute, s), phase, `minute ${minute}`)
})

test('each phase names the hours it covers, rounded, night wrapping past midnight', () => {
	assert.deepEqual(PHASE_IDS.map(id => hoursOf(id)), ['05–10', '10–17', '17–20', '20–05'])
	assert.equal(hoursOf('night', { morning: at(3, 24), day: at(6, 14), evening: at(19, 31), night: at(23, 51) }), '00–03')
	assert.equal(hoursOf('evening', { morning: at(3, 24), day: at(6, 14), evening: at(19, 31), night: at(21, 51) }), '20–22')
})

test('the time zone shows as a city and UTC offset', () => {
	assert.equal(zoneLabel('Europe/Warsaw', -60), 'Warsaw · UTC+1')
	assert.equal(zoneLabel('America/New_York', 300), 'New York · UTC−5')
	assert.equal(zoneLabel('Asia/Kolkata', -330), 'Kolkata · UTC+5:30')
	assert.equal(zoneLabel('UTC', 0), 'UTC · UTC+0')
})

test('a pinned phase wins over the clock, and auto follows it', () => {
	assert.equal(resolvePhase('morning', at(23)), 'morning')
	assert.equal(resolvePhase('auto', at(23)), 'night')
	assert.equal(resolvePhase('nonsense', at(12)), 'day')
})

// Runs index.html's early script, which paints the sky before game.js loads, for a given clock and saved settings.
function earlyPhase({ hours, minutes = 0, saved = {} }) {
	const script = html.match(/<body>\s*<script>([\s\S]*?)<\/script>/)[1]
	const RealDate = Date
	const now = new RealDate(2026, 10, 7, hours, minutes)
	const FakeDate = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])) } }
	const body = { dataset: {} }
	vm.runInNewContext(script, { Date: FakeDate, JSON, document: { body }, localStorage: { getItem: key => saved[key] ?? null } })
	return body.dataset.phase
}

test('before game.js loads, the page uses today\'s saved schedule', () => {
	const sky = JSON.stringify({ date: new Date(2026, 10, 7).toDateString(), starts: [at(6, 40), at(9, 10), at(14, 50), at(16, 50)] })
	assert.equal(earlyPhase({ hours: 15, saved: { 'iso-hoops:sky': sky } }), 'evening')
	assert.equal(earlyPhase({ hours: 17, saved: { 'iso-hoops:sky': sky } }), 'night')
	assert.equal(earlyPhase({ hours: 15, saved: { 'iso-hoops:sky': sky, 'iso-hoops:time': 'morning' } }), 'morning')
})

test('before game.js loads, a stale or missing schedule falls back to the fixed hours', () => {
	const stale = JSON.stringify({ date: 'Thu Jan 01 2026', starts: [0, 1, 2, 3] })
	for (const minute of [at(4), at(5), at(9, 59), at(10), at(17), at(20)]) {
		const hours = Math.floor(minute / 60), minutes = minute % 60
		assert.equal(earlyPhase({ hours, minutes }), phaseAt(minute), `no schedule at ${minute}`)
		assert.equal(earlyPhase({ hours, minutes, saved: { 'iso-hoops:sky': stale } }), phaseAt(minute), `stale schedule at ${minute}`)
	}
})

for (const id of PHASE_IDS) {
	test(`${id} has page colours and a Time menu option`, () => {
		assert.match(css, new RegExp(`\\[data-phase="${id}"\\]`), `style.css should colour the page for ${id}`)
		assert.match(html, new RegExp(`name="time" value="${id}"`), `index.html should offer ${id} in the Time menu`)
		assert.ok(PHASES[id], `${id} should be in the phase table`)
	})
}
