import { HOOP } from './physics.js?v=3'

export const ROUND_SECONDS = 60
// The ball comes back faster than in free shooting, since every second counts.
export const RETURN_AFTER_MAKE = 0.35
export const RETURN_AFTER_MISS = 0.2
// The painted arc's radius. Behind the hoop the corner lines sit outside where the player can walk, so distance alone decides.
export const THREE_POINT_DISTANCE = 6.7

/** A make from beyond the three-point line is worth 3; one on the line or inside it is worth 2. */
export const pointsFor = spot => (Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y) > THREE_POINT_DISTANCE ? 3 : 2)

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
