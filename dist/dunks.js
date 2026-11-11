import { HOOP, createShot } from './physics.js?v=3'

// Running at the rim, a dunk starts from this far out; standing still or moving any other way, from closer in.
export const RUN_RANGE = 4
export const DUNK_RANGE = 2.5
// Within this angle of straight at the rim counts as running at it.
const TOWARD_RIM = 0.5
// The player's walking speed in game.js, so the run-up carries on at the pace the player was moving.
const RUN_SPEED = 4.4
const GATHER_D = 1.9
// Players dunk from the court side of the rim, so an approach from under or behind the board swings round to the front.
const MAX_APPROACH = 1.2
const STAND = { crouch: 0, lean: 0.05, armR: 0.7, armL: 0.6 }

// Times are seconds from the button press, `d` is metres from the hoop's centre along the approach, `z` lifts the feet.
// `spin` turns the body away from facing the rim, `air` adds poses between the gather and the rise.
// Arm and spin angles are kept continuous across a dunk, so a full circle is written as 2π more, not wrapped back.
// The hang has no feet position: it is solved from where the gripping hand meets the bent rim.
export const DUNKS = {
	'two-hand': {
		gather: { crouch: 0.6, lean: 0.3, armR: 0.45, armL: 0.45 },
		rise: { t: 0.42, d: 1.15, z: 0.8, crouch: 0.05, lean: 0.05, armR: 3.05, armL: 3.05 },
		slam: { t: 0.54, d: 1, z: 0.85, crouch: 0.1, lean: 0.2, armR: 2.6, armL: 2.6 },
		hang: { crouch: 0.15, lean: 0.25, armR: 2.75, armL: 2.75 },
		release: 1.13,
		land: { t: 1.43, d: 1.25, crouch: 0.5, lean: 0.15, armR: 0.6, armL: 0.6 },
		length: 1.78, bend: 0.14, carry: 'both', letGo: 0.48,
	},
	tomahawk: {
		gather: { crouch: 0.55, lean: 0.3, armR: 0.5, armL: 0.6 },
		rise: { t: 0.4, d: 1.2, z: 0.85, crouch: 0.05, lean: -0.15, armR: 4.1, armL: 1.5 },
		slam: { t: 0.52, d: 1, z: 0.9, crouch: 0.1, lean: 0.3, armR: 2.55, armL: 1.2 },
		hang: { crouch: 0.2, lean: 0.3, armR: 2.75, armL: 0.5 },
		release: 0.98,
		land: { t: 1.28, d: 1.25, crouch: 0.5, lean: 0.15, armR: 0.6, armL: 0.6 },
		length: 1.63, bend: 0.12, carry: 'right', letGo: 0.48,
	},
	flush: {
		gather: { crouch: 0.4, lean: 0.25, armR: 0.6, armL: 0.6 },
		rise: { t: 0.36, d: 1.15, z: 0.65, crouch: 0.05, lean: 0.1, armR: 2.95, armL: 1 },
		slam: { t: 0.44, d: 1, z: 0.7, crouch: 0.1, lean: 0.2, armR: 2.65, armL: 0.9 },
		hang: { crouch: 0.15, lean: 0.2, armR: 2.75, armL: 0.7 },
		release: 0.62,
		land: { t: 0.9, d: 1.2, crouch: 0.35, lean: 0.1, armR: 0.6, armL: 0.6 },
		length: 1.22, bend: 0.06, carry: 'right', letGo: 0.4,
	},
	swing: {
		gather: { crouch: 0.6, lean: 0.3, armR: 0.45, armL: 0.45 },
		rise: { t: 0.42, d: 1.15, z: 0.8, crouch: 0.05, lean: 0.05, armR: 3.05, armL: 3.05 },
		slam: { t: 0.54, d: 1, z: 0.85, crouch: 0.1, lean: 0.2, armR: 2.6, armL: 2.6 },
		hang: { crouch: 0.1, lean: 0.25, armR: 2.75, armL: 2.75, swing: true },
		release: 1.63,
		land: { t: 1.93, d: 1.3, crouch: 0.5, lean: 0.15, armR: 0.6, armL: 0.6 },
		length: 2.28, bend: 0.2, carry: 'both', letGo: 0.48,
	},
	windmill: {
		gather: { crouch: 0.6, lean: 0.3, armR: 0.45, armL: 0.6 },
		air: [{ t: 0.3, d: 1.5, z: 0.45, crouch: 0.1, lean: 0.05, armR: -1.2, armL: 1, ease: 'out' }],
		rise: { t: 0.44, d: 1.15, z: 0.85, crouch: 0.05, lean: 0, armR: -2.6, armL: 1.1 },
		slam: { t: 0.56, d: 1, z: 0.88, crouch: 0.1, lean: 0.25, armR: -3.68, armL: 1 },
		hang: { crouch: 0.2, lean: 0.3, armR: 2.75 - 2 * Math.PI, armL: 0.5 },
		release: 1.02,
		land: { t: 1.32, d: 1.25, crouch: 0.5, lean: 0.15, armR: 0.6 - 2 * Math.PI, armL: 0.6 },
		length: 1.67, bend: 0.13, carry: 'right', letGo: 0.5,
	},
	'three-sixty': {
		gather: { crouch: 0.65, lean: 0.3, armR: 0.45, armL: 0.45 },
		rise: { t: 0.48, d: 1.2, z: 0.95, crouch: 0.15, lean: 0.05, armR: 2.2, armL: 2.2, spin: 2 * Math.PI, ease: 'smooth' },
		slam: { t: 0.6, d: 1, z: 0.9, crouch: 0.1, lean: 0.2, armR: 2.6, armL: 2.6, spin: 2 * Math.PI },
		hang: { crouch: 0.15, lean: 0.25, armR: 2.75, armL: 2.75, spin: 2 * Math.PI },
		release: 1.12,
		land: { t: 1.42, d: 1.25, crouch: 0.5, lean: 0.15, armR: 0.6, armL: 0.6, spin: 2 * Math.PI },
		length: 1.77, bend: 0.14, carry: 'both', letGo: 0.54,
	},
	reverse: {
		gather: { crouch: 0.6, lean: 0.3, armR: 0.45, armL: 0.45 },
		rise: { t: 0.44, d: 1.15, z: 0.85, crouch: 0.05, lean: -0.05, armR: 3.0, armL: 3.0, spin: Math.PI, ease: 'smooth' },
		slam: { t: 0.56, d: 1.1, z: 0.85, crouch: 0.1, lean: -0.15, armR: 3.75, armL: 3.75, spin: Math.PI },
		hang: { crouch: 0.15, lean: -0.1, armR: 3.55, armL: 3.55, spin: Math.PI },
		release: 1.08,
		land: { t: 1.38, d: 1.35, crouch: 0.5, lean: 0.15, armR: 0.6, armL: 0.6, spin: Math.PI },
		length: 1.9, bend: 0.12, carry: 'both', letGo: 0.5,
	},
}
export const DUNK_IDS = Object.keys(DUNKS)
const GATHER_AT = 0.14
// The slam's last frames ease into the hang, so the body doesn't snap onto the rim.
const SETTLE = 0.1
const POSE_FIELDS = ['d', 'z', 'crouch', 'lean', 'armR', 'armL', 'spin']
const TURN = 2 * Math.PI

/**
 * The dunk a press of Shoot starts, or undefined for an ordinary shot. `moving` is the unit direction the player is
 * walking in, if they are. The dunk is random; from beyond the gather point the player runs in to it first.
 */
export function planDunk(player, moving, previous, random = Math.random) {
	const { angle, d } = approachFrom(player)
	const toward = moving ? -(moving.x * Math.cos(angle) + moving.y * Math.sin(angle)) : 0
	const inReach = toward >= TOWARD_RIM ? d <= RUN_RANGE : d <= DUNK_RANGE
	if (inReach) return plan(pickDunk(previous, random), angle, d, Math.max(0, (d - GATHER_D) / RUN_SPEED))
}

function plan(id, angle, d, run) {
	const dunk = DUNKS[id]
	return { id, angle, d, run, bend: dunk.bend, slamAt: run + dunk.slam.t, throughAt: run + dunk.slam.t + 0.01, releaseAt: run + dunk.release, length: run + dunk.length }
}

/** A random dunk, never the one just played. */
export function pickDunk(previous, random = Math.random) {
	const choices = DUNK_IDS.filter(id => id !== previous)
	return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}

function approachFrom(player) {
	const dx = player.x - HOOP.x, dy = player.y - HOOP.y
	const angle = Math.max(-MAX_APPROACH, Math.min(MAX_APPROACH, Math.atan2(dy, dx)))
	return { angle, d: Math.hypot(dx, dy) }
}

/** The ball the moment it leaves the hands: just above the hoop's centre, pushed straight down. */
export function dunkBall() {
	return { ...createShot({ x: HOOP.x, y: HOOP.y }, 0, 0), x: HOOP.x, y: HOOP.y, z: HOOP.z + 0.1, vx: 0, vy: 0, vz: -5, dunk: true }
}

// The same arm geometry as figure() in engine.js, which is a classic script this module can't import.
function handOf(pose, side) {
	const hipA = -pose.crouch * 0.15, hipZ = 1.28 - pose.crouch * 0.4
	const shA = hipA + Math.sin(pose.lean) * 0.95, shZ = hipZ + Math.cos(pose.lean) * 0.95
	const [arm, offset, reach, across] = side === 'R' ? [pose.armR, 0.18, 0.95, 0.42] : [pose.armL, 0.2, 0.9, -0.43]
	return { forward: shA + Math.sin(arm + offset) * reach, up: shZ - 0.03 - Math.cos(arm + offset) * reach, across }
}

// How far the rim's front, facing the player, is pulled down at a point `across` metres from its centre line.
function rimDip(across, bend) {
	const along = Math.sqrt(HOOP.radius ** 2 - across ** 2) / HOOP.radius
	return bend * ((1 + along) / 2) ** 2
}

export function rimBend(dunk, t) {
	if (t < dunk.slam.t) return 0
	if (t < dunk.release) return dunk.bend * (1 - Math.exp(-(t - dunk.slam.t) * 30))
	const s = t - dunk.release
	return s > 1.2 ? 0 : dunk.bend * Math.exp(-s * 5) * Math.cos(s * 30)
}

function hangPose(dunk, t) {
	const pose = { ...dunk.hang }
	if (dunk.hang.swing) {
		const s = t - dunk.slam.t
		const swing = Math.sin(s * 6.5) * Math.exp(-s * 1.4)
		pose.lean = dunk.hang.lean + swing * 0.45
		pose.crouch = dunk.hang.crouch + Math.max(0, -swing) * 0.3
	}
	const bend = rimBend(dunk, Math.min(t, dunk.release - 1e-6))
	const hand = handOf(pose, 'R')
	const gripAt = Math.sqrt(HOOP.radius ** 2 - hand.across ** 2) + 0.03
	pose.spin = dunk.hang.spin ?? 0
	pose.d = gripAt + hand.forward * Math.cos(pose.spin)
	pose.z = HOOP.z + 0.06 - rimDip(hand.across, bend) - hand.up
	return pose
}

const smooth = u => u * u * (3 - 2 * u)
const easings = { smooth, out: u => 1 - (1 - u) ** 2, in: u => u * u }
function blend(a, b, u, ease = 'smooth') {
	const e = easings[ease](Math.max(0, Math.min(1, u)))
	return Object.fromEntries(POSE_FIELDS.map(k => [k, (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * e]))
}

const RUNNING = { crouch: 0, lean: 0.12, armR: 0.95, armL: 0.95 }

/**
 * The player's pose `t` seconds into a planned dunk: the fields figure() takes plus `d`, the distance from the hoop,
 * the rim's bend, and where the ball is while it is still in hand, as { along, across, z } from the hoop's centre.
 */
export function dunkPose(plan, t) {
	if (t < plan.run) {
		const cycle = Math.sin(t * 13)
		const pose = { d: plan.d - RUN_SPEED * t, z: Math.abs(cycle) * 0.04, ...RUNNING, stance: 0.12 + cycle * 0.18, bend: 0 }
		pose.ball = ballInHand(plan.id, pose, 0)
		return pose
	}
	return landedPose(plan.id, plan.run ? { d: Math.min(plan.d, GATHER_D), z: 0, ...RUNNING } : { d: plan.d, z: 0, ...STAND }, t - plan.run)
}

function landedPose(id, start, t) {
	const dunk = DUNKS[id]
	const gather = { d: start.d, z: 0, ...dunk.gather }
	const air = [{ ...gather, t: GATHER_AT }, ...(dunk.air ?? []), { ease: dunk.air ? 'smooth' : 'out', ...dunk.rise }, { ease: id === 'tomahawk' ? 'in' : 'smooth', ...dunk.slam }]
	let pose
	if (t < GATHER_AT) pose = blend(start, gather, t / GATHER_AT)
	else if (t < dunk.slam.t) {
		const i = air.findIndex(key => key.t > t)
		pose = blend(air[i - 1], air[i], (t - air[i - 1].t) / (air[i].t - air[i - 1].t), air[i].ease)
	}
	else if (t < dunk.slam.t + SETTLE) pose = { ...hangPose(dunk, t), ...blend(dunk.slam, hangPose(dunk, t), (t - dunk.slam.t) / SETTLE) }
	else if (t < dunk.release) pose = hangPose(dunk, t)
	else if (t < dunk.land.t) pose = blend(hangPose(dunk, dunk.release - 1e-6), { ...dunk.land, z: 0 }, (t - dunk.release) / (dunk.land.t - dunk.release), 'in')
	else pose = blend({ ...dunk.land, z: 0 }, settled(dunk.land), (t - dunk.land.t) / (dunk.length - dunk.land.t))
	pose.stance = 0.12
	pose.bend = rimBend(dunk, t)
	pose.ball = t < dunk.slam.t + 0.01 ? ballInHand(id, pose, t) : undefined
	return pose
}

// Standing again after the landing, with arms and facing taken the short way round from wherever the dunk left them.
function settled(land) {
	const near = (value, target) => target + TURN * Math.round(((value ?? 0) - target) / TURN)
	return { d: land.d, z: 0, ...STAND, armR: near(land.armR, STAND.armR), armL: near(land.armL, STAND.armL), spin: near(land.spin, 0) }
}

function ballInHand(id, pose, t) {
	const dunk = DUNKS[id]
	const right = handOf(pose, 'R'), left = handOf(pose, 'L')
	const [forward, across, up] = dunk.carry === 'both'
		? [(right.forward + left.forward) / 2 + 0.1, (right.across + left.across) / 2, (right.up + left.up) / 2]
		: [right.forward + 0.12, right.across - 0.1, right.up + 0.05]
	const spin = pose.spin ?? 0
	const held = { along: pose.d - (forward * Math.cos(spin) - across * Math.sin(spin)), across: forward * Math.sin(spin) + across * Math.cos(spin), z: pose.z + up }
	if (t < dunk.letGo) return held
	// From the hands to just above the hoop's centre, where the ball drops through.
	const u = (t - dunk.letGo) / (dunk.slam.t + 0.01 - dunk.letGo)
	return { along: held.along * (1 - u), across: held.across * (1 - u), z: held.z + (HOOP.z + 0.1 - held.z) * u }
}
