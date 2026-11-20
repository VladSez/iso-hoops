import { HOOP } from './physics.js?v=4'

export const BALLS_PER_RACK = 5
export const RACK_COUNT = 5
// The NBA's spots: a rack in each corner on the baseline, one on each wing at 45°, one at the top, and a deep ball between
// each wing and the top. The physics only cares about distance, so one band covers each kind of spot. Each is the run of
// clean swishes; test/three-point.test.js checks every power inside it scores.
const CORNER = { window: { min: 0.3775, max: 0.43 } }
const ARC = { distance: 7, window: { min: 0.4325, max: 0.48 } }
const DEEP = { distance: 8.5, window: { min: 0.5325, max: 0.5775 } }
// Between the corner line, 5.8 m to the side of the hoop, and the sideline at 6.7 m, a little in front of the backboard.
const cornerSpot = side => ({ x: HOOP.x + 0.8, y: HOOP.y + side * 6.2 })

function spotAt(distance, degrees) {
	const angle = degrees * Math.PI / 180
	return { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
}

const RACK_SPOTS = [
	{ spot: cornerSpot(1), window: CORNER.window },
	{ spot: spotAt(ARC.distance, 45), window: ARC.window },
	{ spot: spotAt(ARC.distance, 0), window: ARC.window },
	{ spot: spotAt(ARC.distance, -45), window: ARC.window },
	{ spot: cornerSpot(-1), window: CORNER.window },
]
const DEEP_ANGLES = [22, -22]

const rack = index => ({ rack: index, balls: BALLS_PER_RACK, ...RACK_SPOTS[index] })
const deep = index => ({ deep: index, balls: 1, spot: spotAt(DEEP.distance, DEEP_ANGLES[index]), window: DEEP.window })

/** The shooting order: the five racks round the arc, with a deep ball after the second rack and after the third. */
export const STATIONS = [rack(0), rack(1), deep(0), rack(2), deep(1), rack(3), rack(4)]
export const SHOT_COUNT = STATIONS.reduce((total, station) => total + station.balls, 0)

/**
 * Every ball in order, with the station it sits on and its place on the rack. A rack's last ball is the money ball,
 * worth 2; every ball on the money rack is. A deep ball is worth 3, and the rest 1.
 */
export const SHOTS = STATIONS.flatMap((station, stationIndex) => Array.from({ length: station.balls }, (_, ball) => ({ station: stationIndex, ball })))

export function valueOf(shot, moneyRack) {
	const station = STATIONS[shot.station]
	if (station.deep !== undefined) return 3
	return station.rack === moneyRack || shot.ball === BALLS_PER_RACK - 1 ? 2 : 1
}

export const maxPoints = moneyRack => SHOTS.reduce((total, shot) => total + valueOf(shot, moneyRack), 0)

/** The money rack a new contest starts on: any of the five, so it isn't always the same one until you pick. */
export const randomMoneyRack = (random = Math.random) => Math.floor(random() * RACK_COUNT)

/**
 * A 60-second contest. It shares its clock fields with Beat the clock (`points`, `best`, `endsAt`, `isOver`), so that
 * mode's clock and scoring functions run it too. `taken` counts balls off the racks; the money rack can be changed
 * until the first shot.
 */
export const startContest = (best, moneyRack = RACK_COUNT - 1) => ({ points: 0, best, endsAt: undefined, isOver: false, taken: 0, moneyRack })

export const hasStarted = contest => contest.endsAt !== undefined

export const chooseMoneyRack = (contest, moneyRack) => (hasStarted(contest) ? contest : { ...contest, moneyRack: (moneyRack + RACK_COUNT) % RACK_COUNT })

/** The next ball to shoot, or undefined once the racks are empty. */
export const nextShot = contest => SHOTS[contest.taken]

export const takeBall = contest => ({ ...contest, taken: Math.min(SHOT_COUNT, contest.taken + 1) })

/** How many balls are still on a station. */
export function ballsLeft(contest, stationIndex) {
	const shot = nextShot(contest)
	if (!shot || stationIndex < shot.station) return 0
	return stationIndex > shot.station ? STATIONS[stationIndex].balls : STATIONS[stationIndex].balls - shot.ball
}
