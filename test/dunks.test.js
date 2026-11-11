import test from 'node:test'
import assert from 'node:assert/strict'
import { HOOP, stepBall } from '../dist/physics.js'
import { DUNKS, DUNK_IDS, DUNK_RANGE, RUN_RANGE, drivingDunk, dunkBall, dunkPose, pickDunk, planDunk } from '../dist/dunks.js'

const TOWARD_HOOP = { x: -1, y: 0 }
const at = d => ({ x: HOOP.x + d, y: 0 })

test('running at the rim from up to 4 m starts a dunk with a run-up', () => {
	const plan = planDunk(at(RUN_RANGE - 0.1), TOWARD_HOOP)
	assert.ok(plan)
	assert.ok(plan.run > 0)
	assert.equal(planDunk(at(RUN_RANGE + 0.2), TOWARD_HOOP), undefined)
})

test('a charge held while running at the rim turns into a dunk once within reach', () => {
	assert.equal(drivingDunk(at(RUN_RANGE + 0.5), TOWARD_HOOP), undefined)
	assert.ok(drivingDunk(at(RUN_RANGE - 0.1), TOWARD_HOOP).run > 0)
	assert.equal(drivingDunk(at(1.5), undefined), undefined)
	assert.equal(drivingDunk(at(1.5), { x: 0, y: 1 }), undefined)
})

test('walking away from the rim or past it reaches only as far as standing', () => {
	assert.equal(planDunk(at(DUNK_RANGE + 0.3), { x: 1, y: 0 }), undefined)
	assert.equal(planDunk(at(DUNK_RANGE + 0.3), { x: 0, y: 1 }), undefined)
	assert.ok(planDunk(at(2), { x: 0, y: 1 }))
})

test('standing near the rim also dunks at random, jumping from where the player stands', () => {
	const close = planDunk(at(1), undefined, 'flush', () => 0)
	assert.equal(close.id, 'two-hand')
	assert.equal(close.run, 0)
	assert.equal(planDunk(at(DUNK_RANGE - 0.1), undefined).run, 0)
	assert.equal(planDunk(at(DUNK_RANGE + 0.2), undefined), undefined)
	assert.equal(planDunk({ x: 0.2, y: 0 }, undefined), undefined)
})

test('the same dunk never plays twice in a row, and every dunk comes up', () => {
	let previous
	const seen = new Set()
	for (let i = 0; i < 400; i++) {
		const next = pickDunk(previous)
		assert.notEqual(next, previous)
		seen.add(next)
		previous = next
	}
	assert.deepEqual([...seen].sort(), [...DUNK_IDS].sort())
	assert.notEqual(pickDunk('flush', () => 0.9999), 'flush')
})

test('from the side of the rim the player dunks from where they stand', () => {
	for (const y of [2.4, -2.4]) {
		const plan = planDunk({ x: HOOP.x, y }, undefined)
		assert.ok(Math.abs(plan.angle - Math.sign(y) * Math.PI / 2) < 1e-9)
		assert.ok(Math.abs(dunkPose(plan, 0).d - 2.4) < 1e-9)
	}
})

test('an approach from under or behind the board swings round to the side', () => {
	assert.ok(Math.abs(planDunk(at(1), undefined).angle) < 1e-9)
	assert.ok(Math.abs(planDunk({ x: HOOP.x - 0.8, y: 0.1 }, undefined).angle) <= 1.9)
	assert.ok(Math.abs(planDunk({ x: HOOP.x - 0.8, y: -0.1 }, undefined).angle) <= 1.9)
})

const plans = [
	...DUNK_IDS.map(id => ({ name: `${id} after a run-up`, plan: { ...planDunk(at(2.8), TOWARD_HOOP, undefined, () => 0), id }, from: 2.8 })),
	...DUNK_IDS.map(id => ({ name: `${id} from standing`, plan: { ...planDunk(at(1.4), undefined), id }, from: 1.4 })),
	...DUNK_IDS.map(id => ({ name: `${id} from standing at full reach`, plan: { ...planDunk(at(DUNK_RANGE), undefined), id }, from: DUNK_RANGE })),
]
for (const { name, plan: base, from } of plans) {
	const dunk = DUNKS[base.id]
	const start = base.run + base.leap
	const plan = { ...base, slamAt: start + dunk.slam.t, throughAt: start + dunk.slam.t + 0.01, releaseAt: start + dunk.release, length: start + dunk.length }

	test(`${name}: starts where the player was and ends standing on the floor`, () => {
		assert.ok(Math.abs(dunkPose(plan, 0).d - from) < 1e-9)
		const last = dunkPose(plan, plan.length)
		assert.equal(last.z, 0)
		assert.ok(Math.abs(last.crouch) < 1e-9)
		assert.equal(last.ball, undefined)
	})

	test(`${name}: moves smoothly, with no jumps between frames`, () => {
		let previous = dunkPose(plan, 0)
		for (let t = 1 / 120; t <= plan.length; t += 1 / 120) {
			const pose = dunkPose(plan, t)
			for (const key of ['d', 'z', 'crouch', 'lean']) {
				assert.ok(Math.abs(pose[key] - previous[key]) < 0.12, `${key} jumped at ${t.toFixed(3)} s`)
			}
			previous = pose
		}
	})

	test(`${name}: hangs on the rim, off the floor and with the rim pulled down`, () => {
		const pose = dunkPose(plan, start + (dunk.slam.t + dunk.release) / 2)
		assert.ok(pose.z > 0.1, 'feet off the floor')
		assert.ok(pose.bend > 0, 'rim bent')
		assert.ok(pose.d > HOOP.radius, 'body in front of the rim')
		assert.ok(dunkPose(plan, plan.length).bend < dunk.bend * 0.2, 'rim nearly back by the end')
	})

	test(`${name}: lands facing the rim again, arms back down`, () => {
		const last = dunkPose(plan, plan.length)
		const turns = value => Math.abs(Math.sin((value ?? 0) / 2))
		assert.ok(turns(last.spin) < 1e-9, 'facing the rim')
		assert.ok(Math.abs(Math.cos(last.armR) - Math.cos(0.7)) < 1e-9 && Math.abs(Math.sin(last.armR) - Math.sin(0.7)) < 1e-9, 'right arm at rest')
	})

	test(`${name}: the ball is in hand until it drops through`, () => {
		const before = dunkPose(plan, plan.throughAt - 0.02).ball
		assert.ok(before && before.z > HOOP.z, 'ball above the rim before the drop')
		assert.equal(dunkPose(plan, plan.throughAt).ball, undefined)
	})
}

test('the dunked ball drops through without touching the rim', () => {
	const ball = dunkBall()
	const events = []
	for (let i = 0; i < 30; i++) events.push(...stepBall(ball, 1 / 60))
	assert.ok(events.includes('score'))
	assert.equal(events.includes('rim'), false)
})

test('the reverse hangs with its back to the rim, and the 360 makes a full turn before the slam', () => {
	const reverse = { ...planDunk(at(1.4), undefined), id: 'reverse' }
	const hang = dunkPose({ ...reverse, run: 0 }, (DUNKS.reverse.slam.t + DUNKS.reverse.release) / 2)
	assert.ok(Math.abs(hang.spin - Math.PI) < 1e-9)
	assert.ok(hang.d > HOOP.radius, 'body still in front of the rim')
	const spin = { ...planDunk(at(1.4), undefined), id: 'three-sixty', run: 0 }
	assert.ok(Math.abs(dunkPose(spin, DUNKS['three-sixty'].slam.t - 0.01).spin - 2 * Math.PI) < 1e-6)
})

test('the windmill swings the ball arm all the way round, backwards', () => {
	const plan = { ...planDunk(at(1.4), undefined), id: 'windmill', run: 0 }
	const before = dunkPose(plan, 0.14).armR, atSlam = dunkPose(plan, DUNKS.windmill.slam.t - 0.01).armR
	assert.ok(before - atSlam > 3.5)
})
