import test from 'node:test'
import assert from 'node:assert/strict'
import { BALL_RADIUS, HOOP, createShot, stepBall } from '../dist/physics.js'

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
