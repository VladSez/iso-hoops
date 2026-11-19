import test from 'node:test'
import assert from 'node:assert/strict'
import { COURTS } from '../dist/courts.js'
import { BALL_RADIUS, CHARGE_TIME, STEADY_CHARGE_TIME, HOOP, MAX_DRIFT, RIM_BOUNCE, missReason, MAX_FATIGUE, SETTLE_TIME, createShot, MAX_WIND, isDead, moveDrift, recover, rollChargeTime, rollWind, shotDistance, stepBall, tire, tiredChargeTime, windPush } from '../dist/physics.js'

function ballAt(position, velocity = {}) {
	return { ...createShot({ x: 0, y: 0 }, 0, 0), vx: 0, vy: 0, vz: 0, ...position, ...velocity }
}

test('a downward center crossing scores exactly once', () => {
	const ball = ballAt({ x: HOOP.x, y: HOOP.y, z: HOOP.z + 0.2 }, { vz: -2 })
	assert.ok(stepBall(ball, 0.2).includes('score'))
	assert.equal(ball.made, true)
	assert.equal(stepBall(ball, 0.3).includes('score'), false)
})

test('passing upward through the hoop does not score', () => {
	const ball = ballAt({ x: HOOP.x, y: HOOP.y, z: HOOP.z - 0.2 }, { vz: 4 })
	assert.equal(stepBall(ball, 0.1).includes('score'), false)
	assert.equal(ball.made, false)
})

test('the net catches a made shot and guides it below the rim', () => {
	const ball = ballAt({ x: HOOP.x + 0.05, y: 0.05, z: HOOP.z + 0.05 }, { vx: 1.5, vy: 0.5, vz: -3 })
	assert.ok(stepBall(ball, 0.2).includes('score'))
	assert.ok(ball.z < HOOP.z && ball.z > HOOP.z - 1)
	assert.ok(Math.hypot(ball.x - HOOP.x, ball.y - HOOP.y) < 0.3)
	assert.ok(Math.hypot(ball.vx, ball.vy) < 0.5)
	assert.equal(stepBall(ball, 0.3).includes('score'), false)
	assert.ok(ball.z < HOOP.z - 1, 'The net must release the ball below its opening')
})

test('a miss keeps its horizontal momentum beside the net', () => {
	const ball = ballAt({ x: HOOP.x, y: 2, z: HOOP.z + 0.05 }, { vx: 1.5, vy: 0.5, vz: -3 })
	assert.equal(stepBall(ball, 0.2).includes('score'), false)
	assert.equal(ball.vx, 1.5)
	assert.equal(ball.vy, 0.5)
})

test('a wide shot does not score', () => {
	const ball = ballAt({ x: HOOP.x, y: 1.8, z: HOOP.z + 0.2 }, { vz: -3 })
	assert.equal(stepBall(ball, 0.2).includes('score'), false)
})

test('an edge shot collides with the rim', () => {
	const ball = ballAt({ x: HOOP.x + HOOP.radius, y: 0, z: HOOP.z + 0.5 }, { vz: -3 })
	assert.ok(stepBall(ball, 0.15).includes('rim'))
	assert.equal(ball.made, false)
	assert.ok(ball.vz > 0)
})

test('a high-speed backboard crossing bounces rather than tunneling', () => {
	const ball = ballAt({ x: -6.5, y: 1, z: 4.3 }, { vx: -60 })
	assert.ok(stepBall(ball, 0.04).includes('board'))
	assert.ok(ball.vx > 0)
})

test('a shot outside the backboard bounds passes through its plane', () => {
	const ball = ballAt({ x: -6.5, y: 3, z: 4.3 }, { vx: -60 })
	assert.equal(stepBall(ball, 0.04).includes('board'), false)
	assert.ok(ball.vx < 0)
})

test('floor bounces lose energy and never fall under the surface', () => {
	const ball = ballAt({ x: 3, y: 0, z: 0.3 }, { vz: -6, vx: 3 })
	assert.ok(stepBall(ball, 0.1).includes('bounce'))
	assert.ok(ball.z >= BALL_RADIUS)
	assert.ok(ball.vz > 0 && ball.vz < 6)
	assert.ok(ball.vx < 3)
})

test('more shot power increases speed and aim controls direction', () => {
	const weak = createShot({ x: 3, y: 0 }, Math.PI, 0.2)
	const strong = createShot({ x: 3, y: 0 }, Math.PI, 0.8)
	const sideways = createShot({ x: 3, y: 0 }, Math.PI / 2, 0.8)
	assert.ok(strong.vx < weak.vx)
	assert.ok(strong.vz > weak.vz)
	assert.ok(sideways.vy > 0)
	assert.ok(Math.abs(sideways.vx) < 0.0001)
})

test('a manually aimed shot is makeable from the starting position', () => {
	const player = { x: 3.5, y: 0 }
	let madePower
	for (let power = 0.1; power < 1; power += 0.005) {
		const ball = createShot(player, Math.PI, power)
		for (let t = 0; t < 3; t += 1 / 60) stepBall(ball, 1 / 60)
		if (ball.made) { madePower = power; break }
	}
	assert.ok(madePower !== undefined, 'At least one ordinary power level must score from the starting spot')
})

test('physics is stable at different frame rates', () => {
	const a = createShot({ x: 3.5, y: 0 }, Math.PI, 0.5)
	const b = { ...a }
	for (let i = 0; i < 30; i++) stepBall(a, 1 / 30)
	for (let i = 0; i < 120; i++) stepBall(b, 1 / 120)
	assert.ok(Math.abs(a.x - b.x) < 0.001)
	assert.ok(Math.abs(a.z - b.z) < 0.001)
})

test('a shot called dead never scores afterwards, and every shot resolves', () => {
	const spots = []
	for (let x = -6; x <= 8; x += 1) for (let y = -6; y <= 6; y += 1.5) spots.push({ x, y })
	let lateScores = 0
	let unresolved = 0
	let shots = 0
	for (const player of spots) {
		const toHoop = Math.atan2(HOOP.y - player.y, HOOP.x - player.x)
		for (const offset of [-0.08, -0.03, 0, 0.03, 0.08]) {
			for (let power = 0; power <= 1; power += 0.02) {
				const ball = createShot(player, toHoop + offset, power)
				let deadAt
				for (let t = 0; t < 8; t += 1 / 60) {
					stepBall(ball, 1 / 60)
					if (deadAt === undefined && isDead(ball)) deadAt = t
					if (ball.made || (deadAt !== undefined && t - deadAt > 2)) break
				}
				shots++
				if (ball.made && deadAt !== undefined) lateScores++
				if (!ball.made && deadAt === undefined) unresolved++
			}
		}
	}
	assert.equal(lateScores, 0, `${lateScores} of ${shots} shots scored after being called dead`)
	assert.equal(unresolved, 0, `${unresolved} of ${shots} shots never resolved within 8s`)
})

test('shot distance is measured along the floor to the hoop, in tenths of a metre', () => {
	assert.equal(shotDistance({ x: HOOP.x + 4.5, y: 0 }), 4.5)
	assert.equal(shotDistance({ x: HOOP.x + 3, y: 4 }), 5)
	assert.equal(shotDistance({ x: 3.5, y: 0 }), 10.5)
	assert.equal(shotDistance({ x: HOOP.x + 6.66, y: 0 }), 6.7)
})

function landsAt(spot, power, wind) {
	const ball = createShot(spot, Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x), power, wind)
	let made = false
	for (let t = 0; t < 4 && !made; t += 1 / 60) made = stepBall(ball, 1 / 60).includes('score') || ball.made
	return made
}

test('a calm shot flies exactly as it did before wind', () => {
	const ball = createShot({ x: 0, y: 2 }, 3, 0.5)
	assert.deepEqual([ball.ax, ball.ay], [0, 0])
	assert.deepEqual(createShot({ x: 0, y: 2 }, 3, 0.5, 0), ball)
})

test('wind blows only along the line to the hoop', () => {
	const push = windPush({ x: HOOP.x, y: HOOP.y + 5 }, 2)
	assert.ok(Math.abs(push.x) < 1e-9)
	assert.ok(push.y < 0, 'A tailwind pushes toward the hoop')
	assert.ok(windPush({ x: HOOP.x, y: HOOP.y + 5 }, -2).y > 0, 'A headwind pushes away from it')
})

test('a headwind needs more power and a tailwind less', () => {
	const spot = { x: -0.3, y: 0 }
	// Inside the calm band from the three-point line (free-throws.js, round 4).
	assert.ok(landsAt(spot, 0.54, 0))
	assert.equal(landsAt(spot, 0.54, -3), false)
	assert.ok(landsAt(spot, 0.58, -3))
	assert.equal(landsAt(spot, 0.54, 3), false)
	assert.ok(landsAt(spot, 0.48, 3))
})

test('wind stops carrying the ball once it has bounced', () => {
	const ball = { ...createShot({ x: 0, y: 0 }, Math.PI, 0.5, 4), x: 0, y: 0, z: BALL_RADIUS, vx: 0, vy: 0, vz: 0, bounces: 1 }
	stepBall(ball, 0.5)
	assert.equal(ball.vx, 0)
})

test('the wind is calm about one shot in five, otherwise a whole 1 to 3 m/s either way', () => {
	let seed = 7
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
	const winds = Array.from({ length: 5000 }, () => rollWind(random))
	const calm = winds.filter(wind => wind === 0).length / winds.length
	assert.ok(calm > 0.17 && calm < 0.23, `calm share ${calm}`)
	for (let speed = 1; speed <= MAX_WIND; speed++) {
		assert.ok(winds.includes(speed) && winds.includes(-speed), `${speed} m/s both ways`)
	}
	assert.ok(winds.every(wind => Number.isInteger(wind) && Math.abs(wind) <= MAX_WIND))
})

test('the meter fills at a different speed each shot, within its range', () => {
	assert.equal(rollChargeTime(() => 0), CHARGE_TIME.min)
	assert.equal(rollChargeTime(() => 0.5), STEADY_CHARGE_TIME)
	let seed = 11
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
	const times = Array.from({ length: 2000 }, () => rollChargeTime(random))
	assert.ok(times.every(time => time >= CHARGE_TIME.min && time < CHARGE_TIME.max))
	assert.ok(Math.min(...times) < 1.25 && Math.max(...times) > 1.95, 'Both ends of the range come up')
})

test('a shot straight off a step drifts sideways, and settled feet shoot straight', () => {
	assert.equal(moveDrift(0, () => 1), MAX_DRIFT)
	assert.equal(moveDrift(0, () => 0), -MAX_DRIFT)
	assert.ok(Math.abs(moveDrift(SETTLE_TIME / 2, () => 1) - MAX_DRIFT / 2) < 1e-12)
	assert.equal(moveDrift(SETTLE_TIME, () => 1), 0)
	assert.equal(moveDrift(Infinity, () => 1), 0)
})

test('the full drift misses from the three-point line, and settled feet still score', () => {
	const spot = { x: -0.3, y: 0 }
	const lands = yaw => {
		const ball = createShot(spot, yaw, 0.53)
		for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
		return ball.made
	}
	assert.ok(lands(Math.PI))
	assert.equal(lands(Math.PI + MAX_DRIFT), false)
	assert.equal(lands(Math.PI - MAX_DRIFT), false)
})

test('rapid shots tire you and the meter fills faster, and rest wears it off', () => {
	let fatigue = 0
	for (let shot = 0; shot < 10; shot++) fatigue = recover(tire(fatigue), 1.5)
	assert.ok(fatigue > 2, `fatigue after quick shots ${fatigue}`)
	assert.ok(fatigue <= MAX_FATIGUE)
	assert.ok(tiredChargeTime(1.6, fatigue) < 1.6)
	assert.equal(tiredChargeTime(1.6, 0), 1.6)
	let steady = 0
	for (let shot = 0; shot < 10; shot++) steady = recover(tire(steady), 3)
	assert.ok(steady === 0, 'One shot every 3 seconds never tires you')
	assert.equal(recover(MAX_FATIGUE, 20), 0)
})

test('a stiff rim kicks the ball back harder than a soft one', () => {
	const bounce = rimBounce => {
		const ball = { ...ballAt({ x: HOOP.x + HOOP.radius, y: 0, z: HOOP.z + 0.5 }, { vz: -3 }), rimBounce }
		stepBall(ball, 0.15)
		return ball.vz
	}
	assert.ok(bounce(0.85) > bounce(RIM_BOUNCE))
	assert.ok(bounce(RIM_BOUNCE) > bounce(0.45))
})

test('a soft rim lets more shots roll in than a stiff one', () => {
	const makes = rim => {
		let made = 0
		for (const offset of [-0.04, 0, 0.04]) for (let power = 0.4; power <= 0.65; power += 0.0025) {
			const ball = createShot({ x: -0.3, y: 0 }, Math.PI + offset, power, 0, rim)
			for (let t = 0; t < 4 && !ball.made; t += 1 / 60) stepBall(ball, 1 / 60)
			made += ball.made
		}
		return made
	}
	assert.ok(makes(COURTS.beach.rim) > makes(COURTS.neighborhood.rim))
	assert.ok(makes(COURTS.neighborhood.rim) > makes(COURTS.rooftop.rim))
})

test('every court has a rim, and the neighborhood keeps the original one', () => {
	for (const [id, court] of Object.entries(COURTS)) assert.ok(court.rim >= 0.4 && court.rim <= 0.9, `${id} rim ${court.rim}`)
	assert.equal(COURTS.neighborhood.rim, RIM_BOUNCE)
})

test('a miss names what cost it, most likely cause first, and a plain miss stays plain', () => {
	assert.equal(missReason({}), undefined)
	assert.equal(missReason({ drift: 0.01, wind: 1, rimHits: 1, fatigue: 2 }), undefined)
	assert.equal(missReason({ drift: -0.05, wind: -3, fatigue: 4 }), 'feet')
	assert.equal(missReason({ wind: -2, rimHits: 1, rimBounce: 0.85 }), 'headwind')
	assert.equal(missReason({ wind: 3 }), 'tailwind')
	assert.equal(missReason({ rimHits: 2, rimBounce: COURTS.rooftop.rim }), 'rim')
	assert.equal(missReason({ rimHits: 2, rimBounce: COURTS.beach.rim }), undefined)
	assert.equal(missReason({ fatigue: 3.5 }), 'tired')
})

test('the ball counts its rim hits', () => {
	const ball = ballAt({ x: HOOP.x + HOOP.radius, y: 0, z: HOOP.z + 0.5 }, { vz: -3 })
	assert.equal(ball.rimHits, 0)
	stepBall(ball, 0.15)
	assert.ok(ball.rimHits >= 1)
})
