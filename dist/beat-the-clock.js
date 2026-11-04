export const ROUND_SECONDS = 60
// The ball comes back faster than in the other modes, since every second counts.
export const RETURN_AFTER_MAKE = 0.5
export const RETURN_AFTER_MISS = 0.3

/**
 * A 60-second round from the free throw line. The clock waits for the first shot, so `endsAt` (in game seconds)
 * stays undefined until then. Once time runs out the round still waits for a ball in the air, and only ends with
 * `finishRound`, which is when the best score moves.
 */
export const startClockRound = best => ({ made: 0, best, endsAt: undefined, isOver: false })

export const startClock = (round, now) => ({ ...round, endsAt: now + ROUND_SECONDS })

export const secondsLeft = (round, now) => (round.endsAt === undefined ? ROUND_SECONDS : Math.max(0, round.endsAt - now))

export const isTimeUp = (round, now) => round.endsAt !== undefined && now >= round.endsAt

// A shot released before the buzzer counts even if it drops after it, so makes are only refused once the round is over.
export const recordMake = round => (round.isOver ? round : { ...round, made: round.made + 1 })

export const finishRound = round => ({ ...round, isOver: true, best: Math.max(round.best, round.made) })
