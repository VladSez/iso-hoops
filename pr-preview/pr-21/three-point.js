import { HOOP } from './physics.js?v=3'

export const BALLS_PER_RACK = 5
export const RACK_COUNT = 5
// Every rack is 7 m out and both deep spots 8.3 m, and the physics only cares about distance, so two bands cover all
// seven spots. Each is the run of clean swishes; test/three-point.test.js checks every power inside it scores.
const RACK = { distance: 7, window: { min: 0.4325, max: 0.48 } }
const DEEP = { distance: 8.3, window: { min: 0.52, max: 0.5625 } }
// The corners are 62° round from straight out: any farther and the spot would leave the walkable court.
const RACK_ANGLES = [62, 31, 0, -31, -62]
const DEEP_ANGLES = [16, -16]

function spotAt(distance, degrees) {
	const angle = degrees * Math.PI / 180
	return { x: HOOP.x + Math.cos(angle) * distance, y: HOOP.y + Math.sin(angle) * distance }
}

const rack = index => ({ rack: index, balls: BALLS_PER_RACK, spot: spotAt(RACK.distance, RACK_ANGLES[index]), window: RACK.window })
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
