import { PLACES } from './places.js?v=1'

// Every court follows the sun where the player lives: phases start at today's dawn, sunrise and sunset for the reference
// city of their time zone, so they shift with the seasons and with daylight saving. `from` is the fixed hour each phase
// starts at when the sun gives no answer (polar day or night).
// `grade` multiplies then offsets each rendered pixel's RGB, `shadow` is where the sun throws shadows,
// `daylight` swaps in a court's daylight palette when it has one, `lamps` is how bright the streetlights' and floodlight's pools are,
// `hoopGlow` how warmly the floodlight lights the hoop, and the page's sky colours for each phase live in style.css.
export const PHASES = {
	morning: { name: 'Morning', from: 5, grade: { mul: [1, 0.94, 0.92], add: [12, 6, 8] }, shadow: { x: -1.7, y: -0.6 }, daylight: true, lamps: 0, stars: false },
	day: { name: 'Day', from: 10, grade: { mul: [1, 1, 1], add: [0, 0, 0] }, shadow: { x: 1.05, y: -0.22 }, daylight: true, lamps: 0, stars: false },
	evening: { name: 'Evening', from: 17, grade: { mul: [1.08, 0.8, 0.66], add: [16, 2, 10] }, shadow: { x: 2.3, y: 0.5 }, lamps: 0.45, hoopGlow: 0.55, stars: false },
	night: { name: 'Night', from: 20, grade: { mul: [0.62, 0.7, 0.9], add: [8, 14, 36] }, shadow: { x: 0.5, y: -0.1 }, lamps: 0.8, hoopGlow: 0.9, stars: true },
}
export const PHASE_IDS = ['morning', 'day', 'evening', 'night']

// A schedule is the minute after local midnight each phase starts at.
export const FIXED = Object.fromEntries(PHASE_IDS.map(id => [id, PHASES[id].from * 60]))

// Morning lasts until two hours after sunrise, and evening's golden hour starts ninety minutes before sunset.
const AFTER_SUNRISE = 120
const BEFORE_SUNSET = 90
const CIVIL_TWILIGHT = -6
const HORIZON = -0.833

// Typical latitudes of where people live in each region, for zones places.js doesn't list.
const REGION_LATITUDE = { Africa: 5, America: 5, Asia: 30, Atlantic: 35, Australia: -32, Indian: -10, Pacific: -15, Antarctica: -75 }

// Europe, the US and Turkey use the time zone's reference city. Elsewhere it's an estimate: longitude from the standard
// UTC offset, and latitude from the region, moved poleward when the zone keeps daylight saving, in the hemisphere its
// summer gives away. `offsets` are getTimezoneOffset() in January and July.
export function placeFor(timeZone, offsets = offsetsOf(new Date().getFullYear())) {
	if (PLACES[timeZone]) return PLACES[timeZone]
	const standardOffset = Math.max(offsets.january, offsets.july)
	const longitude = -standardOffset / 4
	const region = timeZone?.split('/')[0]
	// In the Americas, UTC−3 and further east is South America (Uruguay, eastern Brazil).
	const regional = region === 'America' && standardOffset <= 180 ? -28 : REGION_LATITUDE[region] ?? 20
	if (offsets.january < offsets.july) return [Math.min(regional, -35), longitude]
	if (offsets.january > offsets.july) return [Math.max(regional, 40), longitude]
	return [regional, longitude]
}

function offsetsOf(year) {
	return { january: new Date(year, 0, 1).getTimezoneOffset(), july: new Date(year, 6, 1).getTimezoneOffset() }
}

// NOAA's approximation: minutes after local midnight when the sun rises through and sets below `altitude` degrees, or
// undefined when it stays above or below all day. `offset` is getTimezoneOffset() for the date, so daylight saving counts.
function sunCrossing(date, [lat, lon], altitude, offset) {
	const rad = Math.PI / 180
	const dayOfYear = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5)
	const g = 2 * Math.PI / 365 * (dayOfYear - 0.5)
	const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
	const declination = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
	const cosHour = (Math.sin(altitude * rad) - Math.sin(lat * rad) * Math.sin(declination)) / (Math.cos(lat * rad) * Math.cos(declination))
	if (cosHour < -1 || cosHour > 1) return undefined
	const halfDay = 4 * Math.acos(cosHour) / rad
	const noon = 720 - 4 * lon - equationOfTime - offset
	return { rise: Math.round(noon - halfDay), set: Math.round(noon + halfDay) }
}

export function scheduleFor(date, place, offset = date.getTimezoneOffset()) {
	const sun = sunCrossing(date, place, HORIZON, offset)
	const twilight = sunCrossing(date, place, CIVIL_TWILIGHT, offset)
	if (!sun || !twilight) return FIXED
	const schedule = { morning: twilight.rise, day: sun.rise + AFTER_SUNRISE, evening: sun.set - BEFORE_SUNSET, night: twilight.set }
	// On the shortest days morning runs straight into evening at solar noon.
	if (schedule.day > schedule.evening) schedule.day = schedule.evening = Math.round((sun.rise + sun.set) / 2)
	return schedule
}

export function phaseAt(minute, schedule = FIXED) {
	if (minute >= schedule.night || minute < schedule.morning) return 'night'
	if (minute >= schedule.evening) return 'evening'
	if (minute >= schedule.day) return 'day'
	return 'morning'
}

// The hours a phase covers, rounded to the nearest hour, such as '21–04', for the Time menu and tooltip.
export function hoursOf(id, schedule = FIXED) {
	const next = PHASE_IDS[(PHASE_IDS.indexOf(id) + 1) % PHASE_IDS.length]
	const hour = minute => String(((Math.round(minute / 60) % 24) + 24) % 24).padStart(2, '0')
	return `${hour(schedule[id])}–${hour(schedule[next])}`
}

// The player's time zone as a city and UTC offset, such as 'Warsaw · UTC+1' or 'Kolkata · UTC+5:30'.
// `offset` is getTimezoneOffset() for today.
export function zoneLabel(timeZone, offset = new Date().getTimezoneOffset()) {
	const city = (timeZone ?? '').split('/').pop().replaceAll('_', ' ')
	const east = -offset, size = Math.abs(east)
	const utc = `UTC${east < 0 ? '−' : '+'}${Math.floor(size / 60)}${size % 60 ? `:${String(size % 60).padStart(2, '0')}` : ''}`
	return city ? `${city} · ${utc}` : utc
}

// `choice` is 'auto' or a phase id the player pinned from the Time menu.
export function resolvePhase(choice, minute, schedule = FIXED) {
	return choice in PHASES ? choice : phaseAt(minute, schedule)
}
