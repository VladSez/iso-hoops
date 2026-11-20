import { HOOP } from './physics.js?v=3'

export const ROUND_SECONDS = 60
// The ball comes back faster than in free shooting, since every second counts.
export const RETURN_AFTER_MAKE = 0.5
export const RETURN_AFTER_MISS = 0.3
// The painted arc's radius. Near the baseline the line runs straight instead, this far to either side of the hoop, until
// it meets the arc, so the corners have room for a three inside the sidelines.
export const THREE_POINT_DISTANCE = 6.7
export const CORNER_LINE = 5.8
export const CORNER_REACH = Math.sqrt(THREE_POINT_DISTANCE ** 2 - CORNER_LINE ** 2)

/** Whether a spot is beyond the three-point line: past a corner line near the baseline, past the arc elsewhere. */
export function isBeyondArc(spot) {
	const out = spot.x - HOOP.x, across = Math.abs(spot.y - HOOP.y)
	return out < CORNER_REACH ? across > CORNER_LINE : Math.hypot(out, across) > THREE_POINT_DISTANCE
}

/** A make from beyond the three-point line is worth 3; one on the line or inside it is worth 2. */
export const pointsFor = spot => (isBeyondArc(spot) ? 3 : 2)

// The painted key reaches the free throw line, 4.2 m out from the hoop, and 2.55 m to either side of it.
export const KEY_LENGTH = 4.2
export const KEY_HALF_WIDTH = 2.55

/** Where a shot came from, `out` metres from the hoop towards half court and `across` to the side of it. A dunk is in the paint. */
export const zoneOf = ({ out, across, points, dunk }) => {
	if (dunk) return 'paint'
	if (points === 3) return 'three'
	return out < KEY_LENGTH && Math.abs(across) < KEY_HALF_WIDTH ? 'paint' : 'mid'
}

/**
 * A 60-second round of free shooting for points. The clock waits for the first shot, so `endsAt` (in game seconds)
 * stays undefined until then. Once time runs out the round still waits for a ball in the air, and only ends with
 * `finishRound`, which is when the best score moves and the clock stops, at `now`.
 */
export const startClockRound = best => ({ points: 0, best, endsAt: undefined, isOver: false })

export const startClock = (round, now) => ({ ...round, endsAt: now + ROUND_SECONDS })

export const secondsLeft = (round, now) => (round.endsAt === undefined ? ROUND_SECONDS : Math.max(0, round.endsAt - (round.stoppedAt ?? now)))

export const isTimeUp = (round, now) => round.endsAt !== undefined && now >= round.endsAt

// A shot released before the buzzer counts even if it drops after it, so makes are only refused once the round is over.
export const recordMake = (round, points) => (round.isOver ? round : { ...round, points: round.points + points })

export const finishRound = (round, now) => ({ ...round, isOver: true, best: Math.max(round.best, round.points), stoppedAt: now })
