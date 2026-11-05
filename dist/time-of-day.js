// Every court follows the player's own clock. Each phase starts at a local hour, and night wraps past midnight.
// `grade` multiplies then offsets each rendered pixel's RGB, `shadow` is where the sun throws shadows,
// `daylight` swaps in a court's daylight palette when it has one, `lamps` is how bright the streetlights' and floodlight's pools are,
// `hoopGlow` how warmly the floodlight lights the hoop, and the page's sky colours for each phase live in style.css.
export const PHASES = {
	morning: { name: 'Morning', from: 5, grade: { mul: [1, 0.94, 0.92], add: [12, 6, 8] }, shadow: { x: -1.7, y: -0.6 }, daylight: true, lamps: 0, stars: false },
	day: { name: 'Day', from: 10, grade: { mul: [1, 1, 1], add: [0, 0, 0] }, shadow: { x: 1.05, y: -0.22 }, daylight: true, lamps: 0, stars: false },
	evening: { name: 'Evening', from: 17, grade: { mul: [1.08, 0.8, 0.66], add: [16, 2, 10] }, shadow: { x: 2.3, y: 0.5 }, lamps: 0.45, hoopGlow: 0.55, stars: false },
	night: { name: 'Night', from: 20, grade: { mul: [0.62, 0.7, 0.9], add: [8, 14, 36] }, shadow: { x: 0.5, y: -0.1 }, lamps: 0.8, hoopGlow: 0.9, stars: true },
}

const BY_START = Object.keys(PHASES).sort((a, b) => PHASES[b].from - PHASES[a].from)

export function phaseAt(hour) {
	return BY_START.find(id => hour >= PHASES[id].from) ?? BY_START[0]
}

// `choice` is 'auto' or a phase id the player pinned from the Time menu.
export function resolvePhase(choice, hour) {
	return choice in PHASES ? choice : phaseAt(hour)
}
