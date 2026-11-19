export const HOOP = { x: -7, y: 0, z: 3.4, radius: 0.6 }
export const BALL_RADIUS = 0.24
export const GRAVITY = 11
export const LAUNCH_ANGLE = Math.PI * 0.32
export const BACKBOARD_X = -7.9
const MIN_SPEED = 5
const MAX_SPEED = 14.5
// Horizontal push per m/s of wind, in m/s². Tuned so a 3 m/s wind, the strongest, moves the power a make needs off the
// calm band from the three-point line. Stronger winds would line the shot up with the next band of makes again.
export const WIND_PUSH = 0.3

/**
 * The wind's push on a ball shot from `player`, in m/s². Wind only blows along the line to the hoop: positive `wind` is
 * a tailwind (toward the hoop), negative a headwind.
 */
export function windPush(player, wind) {
	if (!wind) return { x: 0, y: 0 }
	const dx = HOOP.x - player.x, dy = HOOP.y - player.y
	const length = Math.hypot(dx, dy) || 1
	return { x: dx / length * wind * WIND_PUSH, y: dy / length * wind * WIND_PUSH }
}

export const MAX_WIND = 3
const CALM_SHARE = 0.2

/** The wind for the next shot: calm about 1 shot in 5, otherwise 1 to 3 m/s, as a headwind (negative) or a tailwind. */
export function rollWind(random = Math.random) {
	if (random() < CALM_SHARE) return 0
	const speed = 1 + Math.min(MAX_WIND - 1, Math.floor(random() * MAX_WIND))
	return random() < 0.5 ? -speed : speed
}

/** How long the meter takes to fill, in seconds. It changes every shot, so a memorised hold time stops working. */
export const CHARGE_TIME = { min: 1.2, max: 2 }

export function rollChargeTime(random = Math.random) {
	return CHARGE_TIME.min + random() * (CHARGE_TIME.max - CHARGE_TIME.min)
}

/** Creates a ballistic shot. Power is 0–1; yaw is a world-space angle in radians; wind is in m/s, see windPush. */
export function createShot(player, yaw, power, wind = 0) {
	const speed = MIN_SPEED + Math.max(0, Math.min(1, power)) * (MAX_SPEED - MIN_SPEED)
	const push = windPush(player, wind)
	return {
		x: player.x + Math.cos(yaw) * 0.55,
		y: player.y + Math.sin(yaw) * 0.55,
		z: 2.5,
		vx: Math.cos(yaw) * Math.cos(LAUNCH_ANGLE) * speed,
		vy: Math.sin(yaw) * Math.cos(LAUNCH_ANGLE) * speed,
		vz: Math.sin(LAUNCH_ANGLE) * speed,
		age: 0,
		made: false,
		bounces: 0,
		ax: push.x,
		ay: push.y,
	}
}

/** Advances the ball with small physics steps, including swept basket/backboard crossings. */
export function stepBall(ball, delta) {
	const events = []
	const steps = Math.max(1, Math.ceil(delta / (1 / 240)))
	const dt = delta / steps
	for (let step = 0; step < steps; step++) {
		const previous = { x: ball.x, y: ball.y, z: ball.z }
		// Wind carries the ball only in open air, not once the net or the floor has it.
		if (!ball.made && !ball.bounces && (ball.ax || ball.ay)) {
			ball.vx += ball.ax * dt
			ball.vy += ball.ay * dt
		}
		ball.x += ball.vx * dt
		ball.y += ball.vy * dt
		ball.z += ball.vz * dt - GRAVITY * dt * dt * 0.5
		ball.vz -= GRAVITY * dt
		ball.age += dt

		if (!ball.made && previous.z > HOOP.z && ball.z <= HOOP.z) {
			const t = (previous.z - HOOP.z) / (previous.z - ball.z)
			const x = previous.x + (ball.x - previous.x) * t
			const y = previous.y + (ball.y - previous.y) * t
			if (Math.hypot(x - HOOP.x, y - HOOP.y) < HOOP.radius - BALL_RADIUS) {
				ball.made = true
				// The net catches the ball's forward momentum so it drops visibly below the rim.
				ball.vx *= 0.18
				ball.vy *= 0.18
				ball.vz *= 0.62
				events.push('score')
			}
		}

		if (ball.made && ball.z < HOOP.z && ball.z > HOOP.z - 1) {
			ball.vx += (HOOP.x - ball.x) * 30 * dt
			ball.vy += (HOOP.y - ball.y) * 30 * dt
			ball.vx *= Math.exp(-6 * dt)
			ball.vy *= Math.exp(-6 * dt)
		}

		const boardSide = ball.vx < 0 ? 1 : -1
		const boardContact = BACKBOARD_X + boardSide * (BALL_RADIUS + 0.06)
		if ((previous.x - boardContact) * boardSide > 0 && (ball.x - boardContact) * boardSide <= 0) {
			const t = (previous.x - boardContact) / (previous.x - ball.x)
			const y = previous.y + (ball.y - previous.y) * t
			const z = previous.z + (ball.z - previous.z) * t
			if (Math.abs(y) < 1.35 + BALL_RADIUS && z > 3 - BALL_RADIUS && z < 4.9 + BALL_RADIUS) {
				ball.x = boardContact
				ball.vx *= -0.72
				ball.vy *= 0.9
				events.push('board')
			}
		}

		// Resolve against the closest point on the rim, including its thin tube.
		const dx = ball.x - HOOP.x
		const dy = ball.y - HOOP.y
		const radialDistance = Math.hypot(dx, dy)
		if (radialDistance > 0.001 && !ball.made) {
			const rimX = HOOP.x + dx / radialDistance * HOOP.radius
			const rimY = HOOP.y + dy / radialDistance * HOOP.radius
			const nx = ball.x - rimX
			const ny = ball.y - rimY
			const nz = ball.z - HOOP.z
			const distance = Math.hypot(nx, ny, nz)
			const contactRadius = BALL_RADIUS + 0.055
			if (distance < contactRadius && distance > 0.0001) {
				const normal = { x: nx / distance, y: ny / distance, z: nz / distance }
				const impact = ball.vx * normal.x + ball.vy * normal.y + ball.vz * normal.z
				ball.x = rimX + normal.x * contactRadius
				ball.y = rimY + normal.y * contactRadius
				ball.z = HOOP.z + normal.z * contactRadius
				if (impact < 0) {
					ball.vx -= 1.65 * impact * normal.x
					ball.vy -= 1.65 * impact * normal.y
					ball.vz -= 1.65 * impact * normal.z
					events.push('rim')
				}
			}
		}

		if (ball.z < BALL_RADIUS) {
			ball.z = BALL_RADIUS
			if (ball.vz < -0.8) {
				ball.vz *= -0.56
				ball.vx *= 0.78
				ball.vy *= 0.78
				ball.bounces++
				events.push('bounce')
			} else {
				ball.vz = 0
				ball.vx *= Math.exp(-3 * dt)
				ball.vy *= Math.exp(-3 * dt)
			}
		}
	}
	return events
}

/** True once a shot can no longer score: it has hit the floor, or is falling with its top below the rim's tube. */
export function isDead(ball) {
	return !ball.made && (ball.bounces > 0 || (ball.vz < 0 && ball.z < HOOP.z - BALL_RADIUS - 0.055))
}

/** Floor distance from where a shot is taken to the hoop, in metres to one decimal (the three-point line is 6.7). */
export function shotDistance(player) {
	return Math.round(Math.hypot(player.x - HOOP.x, player.y - HOOP.y) * 10) / 10
}
