import { HOOP, BALL_RADIUS, GRAVITY, BACKBOARD_X, createShot, isDead, shotDistance, stepBall } from './physics.js?v=3'
import { ROUND_SHOTS, isDone, levelOf, recordShot, startRound, wobble } from './free-throws.js?v=5'
import { createMusicBuffer } from './music.js?v=2'
import { COURTS } from './courts.js?v=4'

// The renderer's camera, rasterizer, figures and vegetation come from Pixel Plays.
const COURT = { x: 9, y: 7 }
const DRIBBLE_SPEED = 4.5
const PALETTE = {
	shirt: [194, 80, 46], stripe: [194, 80, 46], legs: [46, 56, 65],
	skin: [192, 133, 91], hair: [43, 33, 29],
}
const BALL_COLOR = [210, 111, 43]
const BALL_SEAM = [99, 56, 31]
const ARC_COLOR = [246, 150, 72]
const STEEL = [86, 99, 94]
const NET_COLOR = [255, 250, 230]
const nodes = Object.fromEntries([
	'makes', 'attempts', 'accuracy', 'feedback', 'power-value', 'power-fill',
	'power-meter', 'shoot', 'shoot-label', 'help', 'help-open', 'help-close', 'help-play', 'sound', 'sound-label', 'sound-options', 'court', 'court-label', 'court-options', 'stage', 'basket-callout',
	'mode', 'mode-label', 'mode-options', 'power-target', 'label-attempts', 'label-accuracy',
	'longest', 'longest-stat', 'longest-divider', 'callout-title', 'callout-detail', 'stick', 'stick-knob',
].map(id => [id, document.getElementById(id)]))

const state = {
	player: { x: 3.5, y: 0 }, yaw: Math.PI, pointer: undefined,
	keys: new Set(), stick: { x: 0, y: 0 }, phase: 'ready', chargeSource: undefined, charge: 0, power: 0,
	ball: undefined, returnTime: undefined, time: 0, followThrough: 0,
	attempts: 0, makes: 0, streak: 0, lastPower: 0, paused: false,
	feedbackTime: 0, walking: false, scoredAt: undefined,
	mode: 'free', round: startRound(0), longest: 0,
}

const COURT_KEY = 'iso-hoops:court'
let courtId = 'neighborhood'
try {
	const saved = localStorage.getItem(COURT_KEY)
	if (saved in COURTS) courtId = saved
} catch {}
let court = COURTS[courtId]

const MODES = { free: 'Free shooting', 'free-throws': '10 free throws' }
const MODE_KEY = 'iso-hoops:mode'
const FREE_THROW_BEST_KEY = 'iso-hoops:free-throw-best'
const LONGEST_KEY = 'iso-hoops:longest-basket'
// Phones and tablets get the on-screen stick and Shoot button instead of the keyboard hints.
const IS_TOUCH = matchMedia('(pointer: coarse)').matches
const CANVAS_LABELS = {
	free: canvas.getAttribute('aria-label'),
	'free-throws': 'Basketball court, free throw line. Your spot and aim are fixed. Hold Space or the mouse button to charge, release inside the band on the meter to shoot.',
}
try {
	const saved = localStorage.getItem(MODE_KEY)
	if (saved in MODES) state.mode = saved
	state.round = startRound(Math.max(0, Number.parseInt(localStorage.getItem(FREE_THROW_BEST_KEY), 10) || 0))
	state.longest = Math.max(0, Number.parseFloat(localStorage.getItem(LONGEST_KEY)) || 0)
} catch {}

// The ground fades out in dithered pixels once `reach` passes 1, like a vignette.
const fadesOut = (reach, ix, iy) => reach > 1.04 || (reach > 0.91 && hash(ix, iy) < (reach - 0.91) / 0.13)

// Sea pixels are recolored every wind step, so the swash and the wave crests move.
const seaPixels = []
let seaTime

function seaColor(x, y, ix, iy, time) {
	const shore = 9.1 + (noise(x * 0.35, 3.1) - 0.5) * 1.1
	const n = (hash(ix, iy) - 0.5) * 6
	const swash = shore + 0.2 * Math.sin(time * 1.1 + x * 0.3)
	if (y < swash) return rgb(178 + n, 150 + n, 108 + n)
	const depth = y - swash
	if (depth < 0.22 + noise(x * 2, 1 + time * 0.4) * 0.25) return rgb(242 + n, 244 + n, 236 + n)
	const t = clamp((y - shore) / 4.5, 0, 1)
	const crest = noise(x * 0.5 + y * 0.9 + time * 0.3, y * 2.4 - time * 0.45) > 0.68 && hash(ix * 3, iy) > 0.3 ? 26 : 0
	return rgb(lerp(104, 40, t) + n + crest, lerp(186, 104, t) + n + crest, lerp(186, 150, t) + n + crest)
}

function bakeSea(x, y, ix, iy, index) {
	const shore = 9.1 + (noise(x * 0.35, 3.1) - 0.5) * 1.1
	if (y < shore - 0.5) return undefined
	const reach = Math.pow((Math.abs(x) / 13.4) ** 6 + (Math.max(0, y - shore) / 4.6) ** 6, 1 / 6) + (noise(x * 1.3, y * 1.3) - 0.5) * 0.1
	if (fadesOut(reach, ix, iy)) return 0
	kinds[index] = 2
	seaPixels.push({ x, y, ix, iy, index, color: 0 })
	return seaColor(x, y, ix, iy, 0)
}

function drawSea(time) {
	if (time !== seaTime) {
		seaTime = time
		for (const p of seaPixels) {
			const color = seaColor(p.x, p.y, p.ix, p.iy, time)
			const shadow = staticShadow[p.index]
			const [r, g, b] = shadow === 1 ? [0.54, 0.52, 0.72] : shadow ? [0.36, 0.34, 0.56] : [1, 1, 1]
			p.color = rgb((color & 255) * r, (color >> 8 & 255) * g, (color >> 16 & 255) * b)
		}
	}
	for (const p of seaPixels) if (bakedZ[p.index] === groundZ[p.index]) pix[p.index] = p.color
}

function groundColor(x, y, ix, iy, index) {
	if (court.sea) {
		const water = bakeSea(x, y, ix, iy, index)
		if (water !== undefined) return water
	}
	const edge = Math.pow((Math.abs(x) / 12.9) ** 6 + (Math.abs(y) / 10.9) ** 6, 1 / 6)
	const rough = edge + (noise(x * 1.3, y * 1.3) - 0.5) * 0.1
	// A rooftop is a slab with hard edges; everywhere else the ground frays into the page.
	if (court.roof ? Math.max(Math.abs(x) / 12.4, Math.abs(y) / 10.4) > 1 : fadesOut(rough, ix, iy)) return 0
	const grain = (hash(ix, iy) - 0.5) * 9 + (noise(x * 1.2, y * 1.2) - 0.5) * 6
	if (Math.abs(x) <= COURT.x && Math.abs(y) <= COURT.y) {
		kinds[index] = 1
		const inKey = x < -2.8 && Math.abs(y) < 2.55
		let color = inKey ? court.key : court.court
		const nearBoundary = Math.abs(Math.abs(x) - 8.7) < 0.07 && Math.abs(y) < 6.75 || Math.abs(Math.abs(y) - 6.7) < 0.07 && Math.abs(x) < 8.75
		const keyBoundary = Math.abs(x + 2.8) < 0.07 && Math.abs(y) < 2.6 || Math.abs(Math.abs(y) - 2.55) < 0.07 && x < -2.75 && x > -8.7
		const freeThrow = Math.abs(Math.hypot(x + 2.8, y) - 2.1) < 0.07 && (x >= -2.8 || hash(Math.floor(x * 3), Math.floor(y * 3)) > 0.4)
		const threePoint = Math.abs(Math.hypot(x - HOOP.x, y) - 6.7) < 0.07 && x > HOOP.x
		const corner = x <= HOOP.x && Math.abs(Math.abs(y) - 6.7) < 0.07
		const center = Math.abs(Math.hypot(x - 8.7, y) - 2.15) < 0.07
		if (nearBoundary || keyBoundary || freeThrow || threePoint || corner || center) color = court.line
		if (court.fallenLeaves && hash(ix * 5, iy * 3) < 0.012 + Math.max(0, Math.abs(y) - 5) * 0.03) color = court.leaf[hash(ix, iy * 7) * 3 | 0]
		const faded = hash(ix * 7, iy * 9) < 0.018
		const shade = grain - (faded ? 16 : 0)
		return rgb(color[0] + shade, color[1] + shade, color[2] + shade)
	}
	if (Math.abs(x) < 9.8 && Math.abs(y) < 8.3 || y < -7.4 && y > -9.2 && Math.abs(x) < 11) {
		kinds[index] = 2
		const seam = court.boardwalk ? Math.abs((y + 25) % 0.45) < 0.05 : Math.abs((x + 25) % 2.5) < 0.04 || Math.abs((y + 25) % 2.5) < 0.04
		const shade = grain - (seam ? 14 : 0)
		return rgb(court.apron[0] + shade, court.apron[1] + shade, court.apron[2] + shade)
	}
	if (court.roof) {
		kinds[index] = 2
		const shade = grain - (Math.abs((x + 25) % 1.6) < 0.05 || Math.abs((y + 25) % 1.6) < 0.05 ? 12 : 0)
		return rgb(court.roof[0] + shade, court.roof[1] + shade, court.roof[2] + shade)
	}
	kinds[index] = KIND_GRASS
	const tone = clamp(Math.floor(noise(x * 0.8, y * 0.8) * 3.7 + hash(ix, iy) * 1.1), 0, 4)
	return rgb(...GRASS[tone])
}

function line3D(from, to, radius, color) {
	capsule(from, to, radius, radius, () => color, 'solid')
}

function drawHoop() {
	const board = [227, 225, 206]
	const rim = [192, 73, 36]
	line3D([-8.9, 0, 0], [-8.9, 0, 4.05], 0.13, STEEL)
	line3D([-8.9, 0, 4.05], [BACKBOARD_X, 0, 4.05], 0.1, STEEL)
	box(BACKBOARD_X - 0.06, -1.35, 3, BACKBOARD_X + 0.06, 1.35, 4.9, board)
	for (const y of [-1.35, 1.35]) line3D([BACKBOARD_X + 0.08, y, 3], [BACKBOARD_X + 0.08, y, 4.9], 0.045, STEEL)
	for (const z of [3, 4.9]) line3D([BACKBOARD_X + 0.08, -1.35, z], [BACKBOARD_X + 0.08, 1.35, z], 0.045, STEEL)
	for (const y of [-0.62, 0.62]) line3D([BACKBOARD_X + 0.1, y, 3.4], [BACKBOARD_X + 0.1, y, 4.2], 0.035, rim)
	for (const z of [3.4, 4.2]) line3D([BACKBOARD_X + 0.1, -0.62, z], [BACKBOARD_X + 0.1, 0.62, z], 0.035, rim)
	line3D([BACKBOARD_X, 0, HOOP.z], [HOOP.x - HOOP.radius, 0, HOOP.z], 0.07, rim)
	for (let i = 0; i < 40; i++) {
		const a = i / 40 * Math.PI * 2
		const b = (i + 1) / 40 * Math.PI * 2
		line3D([HOOP.x + Math.cos(a) * HOOP.radius, Math.sin(a) * HOOP.radius, HOOP.z], [HOOP.x + Math.cos(b) * HOOP.radius, Math.sin(b) * HOOP.radius, HOOP.z], 0.055, rim)
	}
}

function drawNet() {
	const age = state.scoredAt === undefined ? 2 : state.time - state.scoredAt
	const active = age < 1.3 && !STILL
	const stretch = active ? Math.sin(Math.min(age / 0.32, 1) * Math.PI) * 0.35 : 0
	const sway = active ? Math.sin(age * 18) * Math.exp(-age * 4) * 0.22 : 0
	function point(row, strand) {
		const t = row / 4
		const angle = strand / 12 * Math.PI * 2 + (row % 2) * Math.PI / 12
		const radius = lerp(0.57, 0.33, t) + stretch * t * 0.1
		return [
			HOOP.x + Math.cos(angle) * radius + sway * t,
			HOOP.y + Math.sin(angle) * radius,
			HOOP.z - 0.05 - t * (0.95 + stretch),
		]
	}
	for (let row = 0; row < 4; row++) {
		for (let strand = 0; strand < 12; strand++) {
			const from = point(row, strand)
			for (const next of [strand, strand + (row % 2 ? 1 : -1)]) {
				line3D(from, point(row + 1, next), 0.022, NET_COLOR)
			}
		}
	}
}

function drawFence() {
	if (court.fence === 'none') return
	if (court.fence === 'rail') {
		for (let x = -10; x <= 9.6; x += 1.6) line3D([x, -8.1, 0], [x, -8.1, 1.2], 0.05, STEEL)
		for (const z of [0.6, 1.2]) line3D([-10, -8.1, z], [9.6, -8.1, z], 0.045, STEEL)
		// a low parapet along the two far edges of the roof
		const wall = [132, 120, 132]
		box(-12.4, -10.4, 0, 12.4, -9.95, 0.7, wall)
		box(-12.4, -10.4, 0, -11.95, 10.4, 0.7, wall)
		return
	}
	const wire = rgb(110, 123, 105)
	for (let x = -10; x <= 9.6; x += 3.25) line3D([x, -8.1, 0], [x, -8.1, 2.5], 0.06, STEEL)
	for (const z of [0.25, 2.5]) line3D([-10, -8.1, z], [9.6, -8.1, z], 0.045, STEEL)
	for (let x = -10; x < 9.6; x += 0.4) {
		for (let z = 0.3; z < 2.5; z += 0.09) {
			const offset = ((z - 0.3) % 0.8) * 0.5
			plot(x + offset, -8.1, z, wire)
			plot(x - offset, -8.1, z, wire)
		}
	}
}

// The engine reads these palette arrays directly, so each court repaints them in place before a bake.
function applyPalette() {
	court.grass.forEach((color, i) => {
		GRASS[i].splice(0, 3, ...color)
		tuftLit[i] = rgb(...color)
		tuftDark[i] = rgb(color[0] * 0.54, color[1] * 0.52, color[2] * 0.72)
	})
	const pairs = [[LEAF_DEEP, court.leaf[0]], [LEAF_MID, court.leaf[1]], [LEAF_SILVER, court.leaf[2]], [BARK, court.bark], [COOL, court.cool], [WARM, court.warm]]
	for (const [target, color] of pairs) target.splice(0, 3, ...color)
}

const WOOD = [151, 113, 69]
function drawBench() {
	box(0, -9.45, 0.68, 4.2, -8.8, 0.83, WOOD)
	box(0, -9.5, 1, 4.2, -9.35, 1.65, WOOD)
	for (const x of [0.3, 3.7]) box(x, -9.35, 0, x + 0.13, -8.85, 0.7, STEEL)
	for (let x = 0; x < 4.2; x += 0.2) castShadow(x, -9.1, 0.9, 0.4)
}

function drawPalm(px, py, height, lean, seed) {
	const trunk = [140, 110, 80]
	const fronds = [[54, 112, 64], [78, 140, 70], [120, 168, 84]]
	let top = [px, py, 0]
	for (let k = 1; k <= 10; k++) {
		const t = k / 10
		const next = [px + lean * t * t, py - lean * 0.4 * t * t, height * t]
		capsule(top, next, 0.2 - t * 0.06, 0.2 - t * 0.07, () => trunk, 'rough')
		top = next
	}
	// Each frond is captured as one leaf, so drawLeaves sways it in the wind with the trees' leaves.
	for (let f = 0; f < 9; f++) {
		const angle = f / 9 * Math.PI * 2 + seed
		let from = top
		capture = []
		for (let k = 1; k <= 6; k++) {
			const droop = (k / 6) ** 2 * 1.6
			const to = [top[0] + Math.cos(angle) * k * 0.42, top[1] + Math.sin(angle) * k * 0.42, top[2] + 0.35 * Math.sin(k / 6 * Math.PI) - droop]
			line3D(from, to, 0.11 - k * 0.01, fronds[(f + k) % 3])
			from = to
		}
		const mid = [top[0] + Math.cos(angle) * 1.2, top[1] + Math.sin(angle) * 1.2]
		leaves.push({ x: mid[0], y: mid[1], z: top[2], k: f * 2, r: 0.4, pixels: capture })
		capture = null
	}
	sphere(top[0], top[1], top[2] - 0.1, 0.28, [92, 74, 52], 'rough')
}

// Props frame each court without covering play.
const PROPS = {
	neighborhood: parkProps,
	autumn: parkProps,
	winter() {
		parkProps()
		const snow = [240, 244, 250]
		sphere(10.6, -3, 0.65, 0.7, snow, 'solid')
		sphere(10.6, -3, 1.65, 0.5, snow, 'solid')
		sphere(10.6, -3, 2.4, 0.36, snow, 'solid')
		line3D([10.6, -3.36, 2.42], [10.6, -3.75, 2.38], 0.05, [230, 120, 40])
	},
	rooftop() {
		const tank = [128, 92, 66]
		for (const [x, y] of [[-10.6, -8.6], [-9.2, -8.6], [-10.6, -7.2], [-9.2, -7.2]]) line3D([x, y, 0], [x, y, 3], 0.08, STEEL)
		capsule([-9.9, -7.9, 3.2], [-9.9, -7.9, 5.6], 1.05, 1.05, () => tank, 'rough')
		sphere(-9.9, -7.9, 6.1, 0.75, [92, 66, 52], 'rough')
		box(4.6, -9.8, 0, 6.2, -8.6, 1.1, [176, 178, 182])
		box(7, -9.8, 0, 8.2, -8.8, 0.8, [176, 178, 182])
		for (let x = -8; x < 9.4; x += 0.55) plot(x, -8.1, 2.1 + Math.sin((x + 8) / 17.4 * Math.PI * 4) * 0.15, rgb(255, 214, 120))
		box(9.2, 5, 0, 11.2, 7, 0.6, [150, 120, 96])
		growTree(10.2, 6, 0.55, 240, 1000)
		drawBench()
	},
	beach() {
		box(4.9, -9.5, 0, 5.15, -8.7, 2.4, [72, 154, 196])
		box(5.6, -9.6, 0, 6.6, -8.9, 0.7, [214, 76, 64])
		box(5.55, -9.65, 0.7, 6.65, -8.85, 0.82, [240, 240, 236])
		line3D([8.8, -9.4, 0], [8.8, -9.4, 2.9], 0.06, [240, 240, 236])
		for (let i = 0; i < 14; i++) {
			const angle = i / 14 * Math.PI * 2
			sphere(8.8 + Math.cos(angle) * 1.1, -9.4 + Math.sin(angle) * 1.1, 2.75, 0.42, i % 2 ? [240, 236, 226] : [222, 92, 70], 'solid')
		}
		drawPalm(-7.7, -9.75, 6.4, 0.8, 0.3)
		drawPalm(11.6, 7.4, 4.8, 0.6, 0.9)
		drawBench()
	},
}

// A bench, a bottle and a pair of trees.
function parkProps() {
	drawBench()
	line3D([3.45, -9.1, 0.84], [3.45, -9.1, 1.3], 0.12, [80, 121, 135])
	box(5.1, -9.6, 0, 5.9, -8.8, 0.9, [108, 125, 101])
	box(5.05, -9.65, 0.9, 5.95, -8.75, 1, STEEL)
	growTree(-7.7, -9.75, 0.95, 380, 0)
	growTree(9.8, 5.5, 0.66, 220, 1000)
}

function bakeCourt() {
	resetScene()
	seaPixels.length = 0
	seaTime = undefined
	applyPalette()
	zb.fill(-1e9)
	pix.fill(rgb(255, 255, 255))
	for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
		const p = unproject(ix + 0.5, iy + 0.5)
		const index = iy * W + ix
		const color = groundColor(p.x, p.y, ix, iy, index)
		if (!color) continue
		pix[index] = color
		ground[index] = 1
		zb[index] = (p.x + p.y) / R2 * COS
	}
	groundZ.set(zb)
	growGrass()
	drawFence()
	drawHoop()
	PROPS[courtId]()
	for (let z = 0.2; z < 4.5; z += 0.15) castShadow(-8.9, 0, z, 0.15)
	for (let y = -1.35; y < 1.35; y += 0.15) castShadow(BACKBOARD_X, y, 4.4, 0.25)
	bakeOcclusion()
	staticShadow.set(shadowMask)
	applyShadows(groundZ)
	bakedPix.set(pix)
	bakedZ.set(zb)
}

function setFeedback(message, made = false) {
	nodes.feedback.textContent = message
	nodes.feedback.classList.toggle('made', made)
	state.feedbackTime = state.time
}

function updateStats() {
	if (state.mode === 'free-throws') {
		const pad = value => String(value).padStart(2, '0')
		nodes.makes.textContent = pad(state.round.made)
		nodes.attempts.textContent = pad(ROUND_SHOTS - state.round.taken)
		nodes.accuracy.textContent = pad(state.round.best)
		return
	}
	nodes.makes.textContent = String(state.makes).padStart(2, '0')
	nodes.attempts.textContent = String(state.attempts).padStart(2, '0')
	nodes.accuracy.textContent = state.attempts ? `${Math.round(state.makes / state.attempts * 100)}%` : '—'
	if (state.longest) nodes.longest.innerHTML = `${state.longest.toFixed(1)}<span class="unit">m</span>`
	else nodes.longest.textContent = '—'
}

let lastMeterPercent = -1
let lastMeterPhase
function updateMeter() {
	const percent = Math.round(state.power * 100)
	if (percent === lastMeterPercent && state.phase === lastMeterPhase) return
	lastMeterPercent = percent
	lastMeterPhase = state.phase
	nodes['power-value'].textContent = `${percent}%`
	nodes['power-fill'].style.width = `${percent}%`
	nodes['power-meter'].setAttribute('aria-valuenow', String(percent))
	document.body.classList.toggle('charging', state.phase === 'charging')
	nodes['shoot-label'].textContent = state.phase === 'charging' ? 'Release to let it fly' : state.phase === 'flight' ? 'Watch your shot…' : 'Hold to charge · release to shoot'
}

// Puts the player on this round's spot and the meter's band over its scoring range.
function placeForRound() {
	const { spot, window } = levelOf(state.round)
	state.player.x = spot.x
	state.player.y = spot.y
	state.yaw = Math.PI
	state.pointer = undefined
	nodes['power-target'].style.left = `${window.min * 100}%`
	nodes['power-target'].style.width = `${(window.max - window.min) * 100}%`
}

function beginCharge(source) {
	if (state.phase !== 'ready' || state.paused || nodes.help.open) return
	ensureAudio()
	// This press only starts the next round, so the player sees the new spot and band before shooting.
	if (state.mode === 'free-throws' && isDone(state.round)) {
		state.round = startRound(state.round.best, state.round.level + 1)
		placeForRound()
		setFeedback(`Round ${state.round.level}, from ${levelOf(state.round).distance} m. Ten shots.`)
		updateStats()
		return
	}
	state.phase = 'charging'
	state.chargeSource = source
	state.charge = 0
	state.power = 0
}

function releaseShot(source) {
	if (state.phase !== 'charging' || source !== state.chargeSource) return
	state.lastPower = state.power
	state.ball = createShot(state.player, state.yaw, state.power)
	state.ball.distance = shotDistance(state.player)
	state.returnTime = undefined
	state.phase = 'flight'
	state.chargeSource = undefined
	state.followThrough = 0.65
	if (state.mode === 'free') state.attempts++
	setFeedback('Let it fly.')
	updateStats()
	playSound('shoot')
}

function cancelInput() {
	state.keys.clear()
	releaseStick()
	if (state.phase === 'charging') state.phase = 'ready'
	state.chargeSource = undefined
	state.charge = 0
	state.power = 0
	updateMeter()
}

function returnBall() {
	state.ball = undefined
	state.phase = 'ready'
	state.charge = 0
	state.power = 0
	state.returnTime = undefined
	updateMeter()
}

function aimAtPointer(event) {
	const rect = canvas.getBoundingClientRect()
	const sx = (event.clientX - rect.left) * W / rect.width
	const sy = (event.clientY - rect.top) * H / rect.height
	// Aim on the rim's horizontal plane, so pointing at the visible hoop is literal.
	state.pointer = unproject(sx, sy + HOOP.z * COS * S)
	updateAim()
}

function updateAim() {
	if (!state.pointer || state.mode === 'free-throws') return
	const dx = state.pointer.x - state.player.x
	const dy = state.pointer.y - state.player.y
	if (Math.hypot(dx, dy) > 0.3) state.yaw = Math.atan2(dy, dx)
}

function takeFreeThrow(made) {
	const bestBefore = state.round.best
	state.round = recordShot(state.round, made)
	const { taken, best } = state.round
	if (best > bestBefore) {
		try { localStorage.setItem(FREE_THROW_BEST_KEY, String(best)) } catch {}
	}
	const score = `${state.round.made}/${taken}`
	if (isDone(state.round)) {
		const verdict = bestBefore === 0 ? 'That’s the one to beat.' : best > bestBefore ? 'New best!' : `Best ${best}/${ROUND_SHOTS}.`
		const next = { ...state.round, level: state.round.level + 1 }
		const farther = levelOf(next).distance > levelOf(state.round).distance ? `, from ${levelOf(next).distance} m` : ''
		setFeedback(`${score}. ${verdict} ${IS_TOUCH ? 'Tap Shoot' : 'Press Space'} for round ${next.level}${farther}.`, made)
	} else {
		setFeedback(made ? `Good. ${score}.` : `Off the mark. ${score}.`, made)
	}
}

function update(delta) {
	if (state.paused || nodes.help.open) return
	const previousDribble = Math.floor(state.time * DRIBBLE_SPEED / Math.PI)
	state.time += delta
	// Each zero crossing of the absolute sine is a floor contact.
	if (state.phase === 'ready' && Math.floor(state.time * DRIBBLE_SPEED / Math.PI) > previousDribble) {
		playSound('dribble')
	}
	state.followThrough = Math.max(0, state.followThrough - delta)
	const keys = state.keys
	let screenX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + state.stick.x
	let screenY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + state.stick.y
	const length = Math.hypot(screenX, screenY)
	const freeThrows = state.mode === 'free-throws'
	state.walking = length > 0 && !freeThrows
	if (state.walking) {
		// Keys always walk at full speed; a partly pushed stick walks slower, for small adjustments.
		if (length > 1) {
			screenX /= length
			screenY /= length
		}
		state.player.x = clamp(state.player.x + (screenX + screenY) / R2 * 4.4 * delta, -8.25, 8.3)
		state.player.y = clamp(state.player.y + (screenY - screenX) / R2 * 4.4 * delta, -6.3, 6.3)
		updateAim()
	}
	const turn = freeThrows ? 0 : Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))
	if (turn) {
		state.pointer = undefined
		state.yaw += turn * 1.4 * delta
	}
	if (state.phase === 'charging') {
		state.charge = Math.min(1, state.charge + delta / 1.6)
		state.power = freeThrows ? clamp(state.charge + wobble(state.time, levelOf(state.round)), 0, 1) : state.charge
	}
	if (state.ball) {
		const events = stepBall(state.ball, delta)
		for (const event of events) {
			playSound(event)
			if (event === 'score') {
				state.scoredAt = state.time
				nodes['callout-title'].textContent = 'BASKET!'
				nodes['callout-detail'].textContent = freeThrows ? '+1 MADE' : `+1 MADE · ${state.ball.distance.toFixed(1)} M`
				nodes['basket-callout'].hidden = false
				nodes['basket-callout'].classList.add('celebrate')
				nodes.makes.closest('.session-stats').classList.add('scored')
				if (freeThrows) {
					takeFreeThrow(true)
				} else {
					state.makes++
					state.streak++
					if (state.ball.distance > state.longest) {
						const previous = state.longest
						state.longest = state.ball.distance
						try { localStorage.setItem(LONGEST_KEY, String(state.longest)) } catch {}
						// The first basket only sets the bar; the callout is kept for beating a record.
						if (previous) {
							nodes['callout-title'].textContent = 'NEW LONGEST!'
							nodes['callout-detail'].textContent = `${state.longest.toFixed(1)} M · WAS ${previous.toFixed(1)} M`
							setFeedback(`New longest: ${state.longest.toFixed(1)} m, beating ${previous.toFixed(1)} m.`, true)
						} else {
							setFeedback(`Basket! Longest so far: ${state.longest.toFixed(1)} m.`, true)
						}
					} else {
						setFeedback(state.streak > 1 ? `Basket! ${state.streak} in a row.` : 'Basket! Nice shot.', true)
					}
				}
				state.returnTime = state.time + 1.5
				updateStats()
			}
		}
		if (isDead(state.ball) && state.returnTime === undefined) {
			state.streak = 0
			state.returnTime = state.time + 1.1
			if (freeThrows) {
				takeFreeThrow(false)
				updateStats()
			} else {
				setFeedback('Another one. The court isn’t going anywhere.')
			}
		}
		if (state.returnTime !== undefined && state.time >= state.returnTime) returnBall()
	}
	if (state.scoredAt !== undefined && state.time - state.scoredAt >= 1.8) {
		nodes['basket-callout'].hidden = true
		nodes['basket-callout'].classList.remove('celebrate')
		nodes.makes.closest('.session-stats').classList.remove('scored')
		state.scoredAt = undefined
	}
	if (state.phase === 'ready' && state.time - state.feedbackTime > 7 && !freeThrows) {
		setFeedback('Find your spot. Take your time.')
	}
	updateMeter()
}

function drawBasketball(x, y, z, time) {
	sphere(x, y, z, BALL_RADIUS, BALL_COLOR, 'solid')
	// The seams follow the visible hemisphere instead of drawing over hidden pixels.
	const p = project(x, y, z)
	for (let i = -2; i <= 2; i++) {
		const ix = Math.round(p.sx) + i
		const iy = Math.round(p.sy)
		if (ix >= 0 && ix < W && iy >= 0 && iy < H && Math.abs(zb[iy * W + ix] - p.d) < BALL_RADIUS * 1.2) pix[iy * W + ix] = rgb(...BALL_SEAM)
	}
	const offset = Math.round(Math.sin(time * 4))
	for (let i = -1; i <= 1; i++) {
		const ix = Math.round(p.sx) + offset
		const iy = Math.round(p.sy) + i
		if (ix >= 0 && ix < W && iy >= 0 && iy < H && Math.abs(zb[iy * W + ix] - p.d) < BALL_RADIUS * 1.2) pix[iy * W + ix] = rgb(...BALL_SEAM)
	}
}

function drawAimGuide() {
	if (state.phase === 'flight' || state.mode === 'free-throws') return
	const direction = { x: Math.cos(state.yaw), y: Math.sin(state.yaw) }
	const dots = []
	for (let d = 0.8; d < 4.2; d += 0.3) {
		const p = project(state.player.x + direction.x * d, state.player.y + direction.y * d, 0.04)
		dots.push([p.sx, p.sy])
	}
	drawDots(dots, rgb(239, 220, 175))
	if (state.phase !== 'charging') return
	const shot = createShot(state.player, state.yaw, state.power)
	const arc = []
	for (let t = 0.06; t < 3; t += 0.1) {
		const z = shot.z + shot.vz * t - GRAVITY * t * t * 0.5
		if (z < BALL_RADIUS) break
		const p = project(shot.x + shot.vx * t, shot.y + shot.vy * t, z)
		arc.push([p.sx, p.sy])
	}
	// Bright orange dots over a dark shadow pixel, so the arc reads on any court.
	const lit = rgb(...ARC_COLOR), dark = rgb(52, 38, 48)
	for (const [sx, sy] of arc) putPixel(sx, sy + 1, dark)
	for (const [sx, sy] of arc) putPixel(sx, sy, lit)
}

function putPixel(sx, sy, color) {
	const ix = sx | 0, iy = sy | 0
	if (ix >= 0 && iy >= 0 && ix < W && iy < H) pix[iy * W + ix] = color
}

function draw() {
	pix.set(bakedPix)
	zb.set(bakedZ)
	pendingShadows.length = 0
	const windTime = STILL ? 0 : Math.floor(state.time * WIND_FPS) / WIND_FPS
	drawSea(windTime)
	const charging = state.phase === 'charging'
	const shotPose = charging || state.followThrough > 0
	const armAngle = charging ? 2.25 + state.power * 0.25 : state.followThrough > 0 ? 2.85 : 0.7
	const walkCycle = state.walking ? Math.sin(state.time * 13) : 0
	figure(state.player.x, state.player.y, state.yaw, {
		crouch: charging ? state.power * 0.45 : 0,
		stance: 0.12 + walkCycle * 0.18,
		armR: armAngle, armL: shotPose ? armAngle : 0.6,
		z: state.walking ? Math.abs(walkCycle) * 0.04 : 0,
	}, PALETTE, dynamicAdd)
	if (state.ball) {
		drawBasketball(state.ball.x, state.ball.y, state.ball.z, state.time)
		castShadow(state.ball.x, state.ball.y, state.ball.z, BALL_RADIUS, 1, 0)
	} else {
		const dribble = charging ? 2.5 : BALL_RADIUS + Math.abs(Math.sin(state.time * DRIBBLE_SPEED)) * 0.99
		drawBasketball(state.player.x + Math.cos(state.yaw) * 0.55, state.player.y + Math.sin(state.yaw) * 0.55, dribble, state.time)
	}
	drawLeaves(windTime)
	drawTufts(windTime)
	flushShadows()
	applyShadows(bakedZ)
	shadeEdges()
	drawNet()
	drawAimGuide()
	ctx.putImageData(image, 0, 0)
}

function resizeCanvas() {
	const rect = nodes.stage.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	const available = Math.min(rect.width / W, rect.height / H)
	const scale = available < 1 ? available : Math.max(1, Math.floor(available * dpr)) / dpr
	canvas.style.width = `${W * scale}px`
	canvas.style.height = `${H * scale}px`
	const canvasRect = canvas.getBoundingClientRect()
	const hoop = project(HOOP.x, HOOP.y, HOOP.z)
	nodes['basket-callout'].style.left = `${canvasRect.left + hoop.sx / W * canvasRect.width}px`
	nodes['basket-callout'].style.top = `${canvasRect.top + (hoop.sy - 14) / H * canvasRect.height}px`
}

const MOVEMENT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyQ', 'KeyE', 'Space']
addEventListener('keydown', event => {
	if (nodes.help.open || event.ctrlKey || event.metaKey || event.altKey) return
	const interactive = event.target.closest?.('button, a, input, select, textarea')
	if (interactive && event.target !== nodes.shoot) return
	if (event.code === 'Escape') {
		if (state.phase === 'charging') return cancelInput()
		state.paused = !state.paused
		cancelInput()
		setFeedback(state.paused ? 'Taking a breather. Press Esc to resume.' : 'Welcome back to the court.')
		return
	}
	if (!MOVEMENT_KEYS.includes(event.code)) return
	event.preventDefault()
	state.keys.add(event.code)
	if (event.code === 'Space' && !event.repeat) beginCharge('keyboard')
})
addEventListener('keyup', event => {
	if (!MOVEMENT_KEYS.includes(event.code)) return
	state.keys.delete(event.code)
	if (event.code === 'Space') {
		event.preventDefault()
		releaseShot('keyboard')
	}
})
canvas.addEventListener('pointermove', aimAtPointer)
// Holding the left mouse button on the court charges a shot like Space; a quick click only aims or focuses it.
const CLICK_MS = 150
let mouseDownAt = 0
canvas.addEventListener('pointerdown', event => {
	canvas.focus({ preventScroll: true })
	aimAtPointer(event)
	if (event.pointerType === 'touch') canvas.setPointerCapture(event.pointerId)
	if (event.pointerType !== 'mouse' || event.button !== 0) return
	canvas.setPointerCapture(event.pointerId)
	mouseDownAt = performance.now()
	beginCharge('mouse')
})
canvas.addEventListener('pointerup', event => {
	if (event.pointerType !== 'mouse' || event.button !== 0 || state.chargeSource !== 'mouse') return
	if (performance.now() - mouseDownAt < CLICK_MS) cancelInput()
	else releaseShot('mouse')
})
canvas.addEventListener('pointercancel', () => { if (state.chargeSource === 'mouse') cancelInput() })
nodes.shoot.addEventListener('pointerdown', event => {
	if (event.button !== 0) return
	event.preventDefault()
	nodes.shoot.setPointerCapture(event.pointerId)
	beginCharge('pointer')
})
nodes.shoot.addEventListener('pointerup', () => releaseShot('pointer'))
// iOS opens its text-selection loupe on a long press unless the default is prevented.
nodes.shoot.addEventListener('contextmenu', event => event.preventDefault())
nodes.shoot.addEventListener('pointercancel', cancelInput)

// The stick's offset from its centre is a screen-space direction, like WASD, scaled to 0..1.
const STICK_DEAD_ZONE = 0.15
let stickPointerId
function moveStick(event) {
	const rect = nodes.stick.getBoundingClientRect()
	const radius = rect.width / 2
	let dx = (event.clientX - rect.left - radius) / radius
	let dy = (event.clientY - rect.top - radius) / radius
	const length = Math.hypot(dx, dy)
	if (length > 1) {
		dx /= length
		dy /= length
	}
	const isPushed = length > STICK_DEAD_ZONE
	state.stick.x = isPushed ? dx : 0
	state.stick.y = isPushed ? dy : 0
	// The knob travels half the base's radius, so it stays inside the ring.
	nodes['stick-knob'].style.transform = `translate(${dx * radius / 2}px, ${dy * radius / 2}px)`
}
function releaseStick() {
	stickPointerId = undefined
	state.stick.x = 0
	state.stick.y = 0
	nodes['stick-knob'].style.transform = ''
	nodes.stick.classList.remove('active')
}
nodes.stick.addEventListener('pointerdown', event => {
	if (stickPointerId !== undefined) return
	event.preventDefault()
	stickPointerId = event.pointerId
	nodes.stick.setPointerCapture(event.pointerId)
	nodes.stick.classList.add('active')
	moveStick(event)
})
nodes.stick.addEventListener('pointermove', event => { if (event.pointerId === stickPointerId) moveStick(event) })
nodes.stick.addEventListener('pointerup', event => { if (event.pointerId === stickPointerId) releaseStick() })
nodes.stick.addEventListener('pointercancel', event => { if (event.pointerId === stickPointerId) releaseStick() })
addEventListener('blur', cancelInput)
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput() })

function openHelp() {
	cancelInput()
	nodes.help.showModal()
}
function closeHelp() {
	nodes.help.close()
	canvas.focus({ preventScroll: true })
}
nodes['help-open'].addEventListener('click', openHelp)
nodes['help-close'].addEventListener('click', closeHelp)
nodes['help-play'].addEventListener('click', closeHelp)

const MUSIC_VOLUME = 0.135
const SOUND_MODES = { all: 'On', effects: 'Music off', off: 'Off' }
const SOUND_MODE_KEY = 'iso-hoops:sound-mode'
let soundMode = 'all'
try {
	const saved = localStorage.getItem(SOUND_MODE_KEY)
	if (saved in SOUND_MODES) soundMode = saved
} catch {}

let audio
let masterGain
let musicGain
let effectsBus
let echoGain
let music
const musicBuffers = {}
function ensureAudio() {
	if (soundMode === 'off') return
	const AudioContext = window.AudioContext || window.webkitAudioContext
	if (!AudioContext) return
	if (!audio) {
		audio = new AudioContext()
		masterGain = audio.createGain()
		masterGain.connect(audio.destination)
		musicGain = audio.createGain()
		musicGain.gain.value = soundMode === 'all' ? MUSIC_VOLUME : 0
		musicGain.connect(masterGain)
		// Effects reach the speakers directly and through a short feedback echo that each court tunes.
		effectsBus = audio.createGain()
		effectsBus.connect(masterGain)
		const delay = audio.createDelay(1)
		delay.delayTime.value = 0.16
		const feedback = audio.createGain()
		feedback.gain.value = 0.35
		echoGain = audio.createGain()
		effectsBus.connect(delay).connect(feedback).connect(delay)
		delay.connect(echoGain).connect(masterGain)
		playCourtSound()
	}
	if (audio.state === 'suspended' || audio.state === 'interrupted') audio.resume()
}

// Crossfades to the current court's loop and echo; loops are rendered once and reused.
function playCourtSound() {
	echoGain.gain.setTargetAtTime(court.sound.echo, audio.currentTime, 0.05)
	if (music?.courtId === courtId) return
	const now = audio.currentTime
	if (music) {
		const { source, gain } = music
		gain.gain.setTargetAtTime(0, now, 0.25)
		source.stop(now + 1.5)
		source.onended = () => { source.disconnect(); gain.disconnect() }
	}
	const source = audio.createBufferSource()
	source.buffer = musicBuffers[courtId] ??= createMusicBuffer(audio, courtId)
	source.loop = true
	const gain = audio.createGain()
	gain.gain.setValueAtTime(music ? 0 : 1, now)
	gain.gain.setTargetAtTime(1, now, 0.25)
	source.connect(gain).connect(musicGain)
	source.start(now)
	music = { courtId, source, gain }
}

function unlockAudio(event) {
	if (event.target.closest?.('#sound, #sound-options')) return
	if (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) return
	ensureAudio()
}
addEventListener('pointerdown', unlockAudio, { passive: true })
addEventListener('keydown', unlockAudio)

function playSound(kind) {
	if (!audio || soundMode === 'off' || audio.state !== 'running') return
	if (kind === 'score') playSwish()
	const sounds = {
		shoot: [280, 170, 0.08, 0.025, 'triangle'],
		bounce: [150, 55, 0.11, 0.12, 'sine'],
		dribble: [145, 52, 0.1, 0.065, 'sine'],
		rim: [1050, 420, 0.13, 0.045, 'triangle'],
		board: [240, 110, 0.09, 0.08, 'triangle'],
		score: [540, 810, 0.2, 0.045, 'sine'],
	}
	const [from, to, duration, volume, type] = sounds[kind]
	const { pitch, floor } = court.sound
	const onFloor = kind === 'bounce' || kind === 'dribble'
	const oscillator = audio.createOscillator()
	const gain = audio.createGain()
	const now = audio.currentTime
	oscillator.type = type
	oscillator.frequency.setValueAtTime(from * pitch, now)
	oscillator.frequency.exponentialRampToValueAtTime(to * pitch, now + duration)
	gain.gain.setValueAtTime(onFloor ? volume * floor : volume, now)
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
	oscillator.connect(gain).connect(effectsBus)
	oscillator.start(now)
	oscillator.stop(now + duration + 0.01)
	oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
}

function playSwish() {
	const duration = 0.28
	const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate)
	const samples = buffer.getChannelData(0)
	for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
	const source = audio.createBufferSource()
	const filter = audio.createBiquadFilter()
	const gain = audio.createGain()
	const now = audio.currentTime
	source.buffer = buffer
	filter.type = 'bandpass'
	filter.frequency.setValueAtTime(2200 * court.sound.pitch, now)
	filter.frequency.exponentialRampToValueAtTime(800 * court.sound.pitch, now + duration)
	filter.Q.value = 0.7
	gain.gain.setValueAtTime(0.0001, now)
	gain.gain.exponentialRampToValueAtTime(0.2, now + 0.035)
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
	source.connect(filter).connect(gain).connect(effectsBus)
	source.start(now)
	source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
}
// A footer menu is a button that opens a list of radio options above it.
function setupMenu(button, options, onPick) {
	function setOpen(open) {
		options.hidden = !open
		button.setAttribute('aria-expanded', String(open))
	}
	button.addEventListener('click', () => {
		setOpen(options.hidden)
		if (!options.hidden) options.querySelector(':checked').focus()
	})
	// A click or tap picks in one go, so the menu closes and Space shoots again; arrow keys keep browsing until Enter.
	let pickedByPointer = false
	options.addEventListener('pointerdown', () => { pickedByPointer = true })
	options.addEventListener('change', event => {
		onPick(event.target.value)
		if (!pickedByPointer) return
		setOpen(false)
		canvas.focus({ preventScroll: true })
	})
	options.addEventListener('keydown', event => {
		pickedByPointer = false
		if (event.key !== 'Escape' && event.key !== 'Enter') return
		// Without this, the same Enter press clicks the button once it has focus and reopens the menu.
		event.preventDefault()
		setOpen(false)
		button.focus()
	})
	addEventListener('pointerdown', event => {
		if (!button.parentElement.contains(event.target)) setOpen(false)
	})
}
function checkOption(options, value) {
	for (const radio of options.querySelectorAll('input')) radio.checked = radio.value === value
}

function showSoundMode() {
	nodes['sound-label'].textContent = SOUND_MODES[soundMode]
	checkOption(nodes['sound-options'], soundMode)
}
setupMenu(nodes.sound, nodes['sound-options'], mode => {
	soundMode = mode
	showSoundMode()
	try { localStorage.setItem(SOUND_MODE_KEY, soundMode) } catch {}
	ensureAudio()
	if (!audio) return
	masterGain.gain.setTargetAtTime(soundMode === 'off' ? 0 : 1, audio.currentTime, 0.025)
	musicGain.gain.setTargetAtTime(soundMode === 'all' ? MUSIC_VOLUME : 0, audio.currentTime, 0.025)
})
showSoundMode()

function showCourt() {
	nodes['court-label'].textContent = court.name
	checkOption(nodes['court-options'], courtId)
}
setupMenu(nodes.court, nodes['court-options'], id => {
	courtId = id
	court = COURTS[id]
	showCourt()
	try { localStorage.setItem(COURT_KEY, courtId) } catch {}
	bakeCourt()
	if (audio) playCourtSound()
})
showCourt()

function applyMode() {
	const freeThrows = state.mode === 'free-throws'
	nodes['mode-label'].textContent = MODES[state.mode]
	canvas.setAttribute('aria-label', CANVAS_LABELS[state.mode])
	checkOption(nodes['mode-options'], state.mode)
	nodes['power-target'].hidden = !freeThrows
	nodes.stick.classList.toggle('locked', freeThrows)
	nodes['label-attempts'].textContent = freeThrows ? 'SHOTS LEFT' : 'SHOTS'
	nodes['label-accuracy'].textContent = freeThrows ? 'BEST' : 'ACCURACY'
	nodes['longest-stat'].hidden = freeThrows
	nodes['longest-divider'].hidden = freeThrows
	if (freeThrows) {
		state.round = startRound(state.round.best)
		placeForRound()
	}
	updateStats()
}
setupMenu(nodes.mode, nodes['mode-options'], mode => {
	state.mode = mode
	try { localStorage.setItem(MODE_KEY, mode) } catch {}
	cancelInput()
	returnBall()
	applyMode()
	setFeedback(mode === 'free-throws' ? 'Ten free throws. Release inside the band.' : 'Find your spot. Take your time.')
})
applyMode()
// Keep the skeleton up for at least 300ms after navigation, so a fast load doesn't flash it.
setTimeout(() => document.querySelector('.settings').classList.add('ready'), Math.max(0, 300 - performance.now()))

// Try immediately where autoplay is allowed; the first gesture unlocks other browsers.
ensureAudio()

addEventListener('resize', resizeCanvas)
resizeCanvas()
bakeCourt()
updateStats()
let lastFrame = performance.now()
function frame(now) {
	update(Math.min(0.04, (now - lastFrame) / 1000))
	lastFrame = now
	draw()
	requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
