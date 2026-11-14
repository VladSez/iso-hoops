import { HOOP, BALL_RADIUS, GRAVITY, BACKBOARD_X, createShot, isDead, shotDistance, stepBall } from './physics.js?v=3'
import { ROUND_SHOTS, isDone, levelOf, recordShot, startRound, wobble } from './free-throws.js?v=5'
import { CORNER_LINE, CORNER_REACH, ROUND_SECONDS, RETURN_AFTER_MAKE, RETURN_AFTER_MISS, THREE_POINT_DISTANCE, finishRound, isTimeUp, pointsFor, recordMake, secondsLeft, startClock, startClockRound } from './beat-the-clock.js?v=6'
import { LETTERS, SPOT_RADIUS, TIERS, isOnSpot, recordHorseShot, startHorse, tierOf } from './horse.js?v=4'
import { RACK_COUNT, STATIONS, ballsLeft, chooseMoneyRack, hasStarted, nextShot, startContest, takeBall, valueOf } from './three-point.js?v=1'
import { clockResults, contestResults, courtOf, duelResults, freeThrowResults, horseResults } from './results.js?v=12'
import { LEVELS as CPU_LEVELS, emptyRecord, firstShooter, other, parseRecord, recordDuelShot, recordResult, startDuel, tossCoin, turnOf } from './horse-duel.js?v=2'
import { aimShot, chooseSpot, yawTo } from './cpu.js?v=3'
import { CHARACTERS, HAIRSTYLES, characterOf, colorOf, kitOf, paletteOf } from './characters.js?v=2'
import { createMusicBuffer, TRACKS, trackFor, pickTrack } from './music.js?v=3'
import { COURTS } from './courts.js?v=6'
import { drivingDunk, dunkBall, dunkPose, planDunk } from './dunks.js?v=3'
import { playSlam } from './slam.js?v=3'
import { PHASES, PHASE_IDS, hoursOf, placeFor, resolvePhase, scheduleFor, zoneLabel } from './time-of-day.js?v=7'

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
// The money balls are blue and the deep balls gold, so the valuable ones read on the rack and in the air.
const MONEY_BALL_COLOR = [58, 104, 196]
const DEEP_BALL_COLOR = [232, 186, 58]
const BALL_COLORS = { 1: BALL_COLOR, 2: MONEY_BALL_COLOR, 3: DEEP_BALL_COLOR }
const nodes = Object.fromEntries([
	'makes', 'attempts', 'accuracy', 'feedback', 'power-value', 'power-fill',
	'power-meter', 'shoot', 'shoot-label', 'help', 'help-open', 'help-close', 'help-play', 'sound', 'sound-label', 'sound-options', 'audio-options', 'now-playing-label', 'track-prev', 'track-next', 'track-name', 'track-note', 'track-dots', 'track-own', 'track-own-label', 'track-everywhere', 'court', 'court-label', 'court-options', 'stage', 'basket-callout',
	'time', 'time-label', 'time-options', 'time-zone', 'time-tip-name', 'time-tip-hours', 'time-tip-zone', 'time-tip-mode',
	'mode', 'mode-label', 'mode-options', 'power-target', 'label-attempts', 'label-accuracy',
	'label-makes', 'longest', 'callout-title', 'callout-detail', 'stick', 'stick-knob', 'turn',
	'results', 'results-label', 'results-side', 'results-score', 'results-note', 'results-stamp', 'results-stamp-text',
	'results-stamp-detail', 'results-chart', 'results-stats', 'results-foot-note', 'results-again', 'results-action',
	'results-action-detail', 'session-open', 'session-panel', 'session-summary', 'session-court', 'session-zones', 'session-reset',
	'opponent', 'opponent-label', 'opponent-options', 'cpu-characters', 'cpu-character-name', 'coin', 'coin-call', 'coin-versus', 'call-heads', 'call-tails', 'opponent-play', 'opponent-play-label', 'opponent-play-detail',
	'switch-warn', 'warn-versus', 'warn-body', 'warn-you', 'warn-cpu', 'warn-cpu-name', 'warn-keep', 'warn-confirm', 'warn-confirm-label',
].map(id => [id, document.getElementById(id)]))

const state = {
	// Just behind the three-point arc at the top of the key (7.2 m), so the first shot is a realistic three.
	player: { x: 0.2, y: 0 }, yaw: Math.PI, pointer: undefined,
	keys: new Set(), stick: { x: 0, y: 0 }, phase: 'ready', chargeSource: undefined, charge: 0, power: 0,
	ball: undefined, returnTime: undefined, time: 0, followThrough: 0,
	attempts: 0, makes: 0, streak: 0, lastPower: 0, paused: false,
	// Free shooting's shots since the page opened, or since Start over, for the session court.
	session: [],
	feedbackTime: 0, walking: false, scoredAt: undefined,
	mode: 'free', round: startRound(0), clock: startClockRound(0), horse: startHorse(0), longest: 0,
	// The contest lets the next ball go while earlier ones are still in the air, so its balls live in `flying`.
	contest: startContest(0), flying: [], reloadAt: undefined,
	// A dunk in progress, from planDunk plus when it started. The last one is never repeated. `moving` is the walking direction.
	dunk: undefined, lastDunk: undefined, moving: undefined,
	// The current round's shots, one entry each, for the results card at its end.
	log: [],
	// HORSE against the CPU: the game (see horse-duel.js), the CPU player on the court, and where you walk to on your own
	// when the CPU needs the spot you are standing on.
	duel: null,
	// The opening coin flip: waiting for your call, then in the air until `lands`.
	coin: null,
	cpu: { x: -2.2, y: 5.6, yaw: Math.PI, task: 'idle', until: 0, target: undefined, aim: undefined, chargeStart: 0, followThrough: 0, walking: false, rest: { x: -2.2, y: 5.6 } },
	stepAside: undefined,
}

const COURT_KEY = 'iso-hoops:court'
let courtId = 'neighborhood'
try {
	const saved = localStorage.getItem(COURT_KEY)
	if (saved in COURTS) courtId = saved
} catch {}
let court = COURTS[courtId]

const MODES = { free: 'Free shooting', 'free-throws': '10 free throws', clock: 'Beat the clock', horse: 'HORSE', 'three-point': '3PT contest' }
const MODE_KEY = 'iso-hoops:mode'
const FREE_THROW_BEST_KEY = 'iso-hoops:free-throw-best'
const CLOCK_BEST_KEY = 'iso-hoops:clock-best-points'
const HORSE_BEST_KEY = 'iso-hoops:horse-best'
const THREE_POINT_BEST_KEY = 'iso-hoops:three-point-best'
const LONGEST_KEY = 'iso-hoops:longest-basket'
// Phones and tablets get the on-screen stick and Shoot button instead of the keyboard hints.
const IS_TOUCH = matchMedia('(pointer: coarse)').matches
const HOOP_SNAP_PX = 28
const CANVAS_LABELS = {
	free: canvas.getAttribute('aria-label'),
	'free-throws': 'Basketball court, free throw line. Your spot and aim are fixed. Hold Space or the mouse button to charge, release inside the band on the meter to shoot.',
	horse: 'Basketball court with a marked spot. Walk into the ring and make the shot; each miss earns a letter of HORSE, and five letters end the game. Move with WASD or arrows. Aim with the mouse or Q and E. Hold Space or the mouse button to charge, release to shoot.',
	'three-point': 'Basketball court with five ball racks round the three-point line and two deep spots, 60 seconds on the clock. You move from rack to rack on your own and always face the rim. Hold Space or the mouse button to charge, release inside the band on the meter to shoot.',
	clock: 'Basketball practice court, 60 seconds on the clock. Score 2 for a make, 3 from beyond the arc. Move with WASD or arrows. Aim with the mouse or Q and E. Hold Space or the mouse button to charge, release to shoot.',
}
try {
	const saved = localStorage.getItem(MODE_KEY)
	if (saved in MODES) state.mode = saved
	state.round = startRound(Math.max(0, Number.parseInt(localStorage.getItem(FREE_THROW_BEST_KEY), 10) || 0))
	state.clock = startClockRound(Math.max(0, Number.parseInt(localStorage.getItem(CLOCK_BEST_KEY), 10) || 0))
	state.horse = startHorse(Math.max(0, Number.parseInt(localStorage.getItem(HORSE_BEST_KEY), 10) || 0))
	state.contest = startContest(Math.max(0, Number.parseInt(localStorage.getItem(THREE_POINT_BEST_KEY), 10) || 0))
	state.longest = Math.max(0, Number.parseFloat(localStorage.getItem(LONGEST_KEY)) || 0)
} catch {}

// Who you play HORSE against.
const OPPONENT_KEY = 'iso-hoops:opponent'
const CPU_LEVEL_KEY = 'iso-hoops:cpu-level'
const CPU_CHARACTER_KEY = 'iso-hoops:cpu-character'
const CPU_RECORD_KEY = 'iso-hoops:horse-cpu-record'
const cpuSetup = { opponent: 'solo', level: 'medium', character: CHARACTERS[0].id }
let cpuRecord = emptyRecord()
try {
	if (localStorage.getItem(OPPONENT_KEY) === 'cpu') cpuSetup.opponent = 'cpu'
	const level = localStorage.getItem(CPU_LEVEL_KEY)
	if (CPU_LEVELS.includes(level)) cpuSetup.level = level
	cpuSetup.character = characterOf(localStorage.getItem(CPU_CHARACTER_KEY)).id
	cpuRecord = parseRecord(localStorage.getItem(CPU_RECORD_KEY))
} catch {}
const isDuel = () => state.mode === 'horse' && cpuSetup.opponent === 'cpu'
const cpuCharacter = () => characterOf(cpuSetup.character)
const cpuJersey = () => kitOf(cpuCharacter())
const cpuName = () => cpuCharacter().name
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

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
		const threePoint = Math.abs(Math.hypot(x - HOOP.x, y) - THREE_POINT_DISTANCE) < 0.07 && x - HOOP.x >= CORNER_REACH
		const corner = Math.abs(Math.abs(y) - CORNER_LINE) < 0.07 && x - HOOP.x < CORNER_REACH && x > -8.75
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

const RIM_COLOR = [192, 73, 36]
function drawHoop() {
	const board = [227, 225, 206]
	const rim = RIM_COLOR
	line3D([-8.9, 0, 0], [-8.9, 0, 4.05], 0.13, STEEL)
	line3D([-8.9, 0, 4.05], [BACKBOARD_X, 0, 4.05], 0.1, STEEL)
	box(BACKBOARD_X - 0.06, -1.35, 3, BACKBOARD_X + 0.06, 1.35, 4.9, board)
	for (const y of [-1.35, 1.35]) line3D([BACKBOARD_X + 0.08, y, 3], [BACKBOARD_X + 0.08, y, 4.9], 0.045, STEEL)
	for (const z of [3, 4.9]) line3D([BACKBOARD_X + 0.08, -1.35, z], [BACKBOARD_X + 0.08, 1.35, z], 0.045, STEEL)
	for (const y of [-0.62, 0.62]) line3D([BACKBOARD_X + 0.1, y, 3.4], [BACKBOARD_X + 0.1, y, 4.2], 0.035, rim)
	for (const z of [3.4, 4.2]) line3D([BACKBOARD_X + 0.1, -0.62, z], [BACKBOARD_X + 0.1, 0.62, z], 0.035, rim)
}

// How far a dunk pulls the rim down at an angle round it: most at the front the player hangs on, none at the board.
function rimDip(angle, bend, toward) {
	return bend * ((1 + Math.cos(angle - toward)) / 2) ** 2
}

// Drawn every frame rather than baked, so a dunk can bend it.
function drawRim(bend = 0, toward = 0) {
	line3D([BACKBOARD_X, 0, HOOP.z], [HOOP.x - HOOP.radius, 0, HOOP.z], 0.07, RIM_COLOR)
	const point = a => [HOOP.x + Math.cos(a) * HOOP.radius, Math.sin(a) * HOOP.radius, HOOP.z - rimDip(a, bend, toward)]
	for (let i = 0; i < 40; i++) line3D(point(i / 40 * Math.PI * 2), point((i + 1) / 40 * Math.PI * 2), 0.055, RIM_COLOR)
}

function drawNet(bend = 0, toward = 0) {
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
			HOOP.z - 0.05 - t * (0.95 + stretch) - rimDip(angle, bend, toward) * (1 - t * 0.6),
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
		for (let x = -8; x < 9.4; x += 0.55) plot(x, -8.1, 2.1 + Math.sin((x + 8) / 17.4 * Math.PI * 4) * 0.15, phase.lamps ? LAMP_LIT : rgb(255, 214, 120))
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

// Posts ring the neighborhood court with their arms reaching in over the lines, and each pool lands just inside its arm.
const STREETLIGHTS = [
	{ post: [-4.6, -9.4], head: [-4.6, -8.4], pool: [-4.6, -7] },
	{ post: [2.6, -9.6], head: [2.6, -8.6], pool: [2.6, -7.2] },
	{ post: [10.7, -4.4], head: [9.7, -4.4], pool: [8.3, -4.4] },
	{ post: [10.7, 2.8], head: [9.7, 2.8], pool: [8.3, 2.8] },
	{ post: [-11.1, 2.4], head: [-10.1, 2.4], pool: [-8.7, 2.4] },
]
// A taller light behind the hoop, aimed at the basket, so the board and the key are the brightest part of the court.
const FLOODLIGHT = { post: [-11.6, -2.2], height: 6.2, arm: [-10.9, -1.6], pool: [-6.6, 0], radius: 3.8, strength: 1.7 }
const LAMP_POST = [70, 78, 80]
const LAMP_LIT = rgb(255, 238, 176)
const LAMP_OFF = rgb(214, 212, 198)
const POOL_RADIUS = 3.7
const STAR = rgb(255, 240, 232)
// The canvas pixels the hoop covers, found at bake time, so the floodlight can light them.
const hoopPixels = new Uint8Array(W * H)

function drawStreetlights() {
	const glass = phase.lamps ? LAMP_LIT : LAMP_OFF
	for (const { post: [px, py], head: [hx, hy] } of STREETLIGHTS) {
		line3D([px, py, 0], [px, py, 5.3], 0.07, LAMP_POST)
		line3D([px, py, 5.3], [hx, hy, 5.25], 0.05, LAMP_POST)
		for (let a = -0.18; a <= 0.18; a += 0.06) for (let b = -0.18; b <= 0.18; b += 0.06) plot(hx + a, hy + b, 5.1, glass)
	}
}

function drawFloodlight() {
	const { post: [px, py], height, arm: [ax, ay] } = FLOODLIGHT
	line3D([px, py, 0], [px, py, height], 0.09, LAMP_POST)
	line3D([px, py, height], [ax, ay, height - 0.1], 0.07, LAMP_POST)
	const glass = phase.lamps ? LAMP_LIT : LAMP_OFF
	for (let a = -0.3; a <= 0.3; a += 0.06) for (let b = -0.2; b <= 0.2; b += 0.06) plot(ax + 0.1 + a * 0.4, ay + 0.1 + a, height - 0.25 + b, glass)
}

// How much lamplight reaches each canvas pixel, stepped into bands so the pools read as pixel art, not an airbrush.
let poolLight
function poolLightMap() {
	if (poolLight) return poolLight
	poolLight = new Float32Array(W * H)
	for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
		const p = unproject(ix + 0.5, iy + 0.5)
		let light = 0
		for (const { pool: [x, y] } of STREETLIGHTS) light += Math.exp(-((p.x - x) ** 2 + (p.y - y) ** 2) / POOL_RADIUS ** 2)
		const { pool: [fx, fy], radius, strength } = FLOODLIGHT
		light += strength * Math.exp(-((p.x - fx) ** 2 + (p.y - fy) ** 2) / radius ** 2)
		poolLight[iy * W + ix] = Math.round(Math.min(1, light) * 5) / 5
	}
	return poolLight
}

// Lights the finished frame for the phase. The white page around the court turns transparent so the sky behind the canvas shows.
function gradeFrame() {
	const { mul: [mr, mg, mb], add: [ar, ag, ab] } = court.paintedForDusk && phaseId === 'evening' ? PHASES.day.grade : phase.grade
	const light = phase.lamps ? poolLightMap() : undefined
	for (let i = 0; i < pix.length; i++) {
		const c = pix[i]
		if (!c) {
			const ix = i % W, iy = i / W | 0
			pix[i] = phase.stars && iy < 120 && hash(ix * 7, iy * 13) > 0.9965 ? STAR : 0
			continue
		}
		if (c === LAMP_LIT) continue
		const r = c & 255, g = c >> 8 & 255, b = c >> 16 & 255
		// The floodlight keeps the backboard, rim and pole bright and warm instead of darkening them with the court.
		if (phase.hoopGlow && hoopPixels[i]) {
			const k = phase.hoopGlow
			pix[i] = rgb(r * (1 + 0.12 * k) + 22 * k, g * (1 + 0.06 * k) + 16 * k, b * (1 - 0.08 * k) + 4 * k)
			continue
		}
		const lit = light ? light[i] * phase.lamps * (court.lampScale ?? 1) : 0
		pix[i] = rgb(r * (mr + lit * 0.95) + ar, g * (mg + lit * 0.72) + ag, b * (mb + lit * 0.38) + ab)
	}
}

function bakeCourt() {
	resetScene()
	seaPixels.length = 0
	seaTime = undefined
	applyPalette()
	zb.fill(-1e9)
	// Transparent, so the court's drop shadow in style.css follows its edge instead of the canvas box.
	pix.fill(0)
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
	const beforeHoop = pix.slice()
	drawHoop()
	const withoutRim = [pix.slice(), zb.slice()]
	drawRim()
	for (let i = 0; i < pix.length; i++) hoopPixels[i] = pix[i] === beforeHoop[i] ? 0 : 1
	pix.set(withoutRim[0])
	zb.set(withoutRim[1])
	PROPS[courtId]()
	drawStreetlights()
	drawFloodlight()
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
	const pad = value => String(value).padStart(2, '0')
	if (state.mode === 'clock' || state.mode === 'three-point') {
		const round = state.mode === 'clock' ? state.clock : state.contest
		nodes.makes.textContent = pad(round.points)
		const seconds = Math.ceil(secondsLeft(round, state.time))
		nodes.attempts.textContent = pad(seconds)
		nodes.accuracy.textContent = pad(round.best)
		// The seconds turn red for the last ten, while the clock is running.
		const isHurrying = round.endsAt !== undefined && !round.isOver && seconds <= 10
		nodes.attempts.classList.toggle('hurry', isHurrying)
		return
	}
	if (isDuel()) {
		// Your letters on the left, the CPU's on the right, and in the middle what the next shot is and whose ball it is.
		const duel = state.duel ?? { letters: { you: 0, cpu: 0 } }
		const name = cpuName().toUpperCase()
		const letters = count => LETTERS.map((letter, i) => `<span class="letter${i < count ? ' earned' : ''}">${letter}</span>`).join('')
		nodes.makes.innerHTML = letters(duel.letters.you)
		nodes.accuracy.innerHTML = letters(duel.letters.cpu)
		nodes['label-makes'].textContent = 'YOU'
		nodes['label-accuracy'].textContent = name
		if (state.coin) {
			nodes.attempts.textContent = 'TOSS'
			nodes['label-attempts'].textContent = state.coin.phase === 'call' ? 'CALL IT' : 'IN THE AIR'
		} else if (duel.winner) {
			nodes.attempts.textContent = duel.winner === 'you' ? 'WIN' : 'LOSS'
			nodes['label-attempts'].textContent = 'GAME OVER'
		} else {
			nodes.attempts.textContent = duel.phase === 'match' ? 'MATCH' : 'SET'
			nodes['label-attempts'].textContent = turnOf(duel) === 'you' ? 'YOUR BALL' : `${name}’S BALL`
		}
		return
	}
	if (state.mode === 'horse') {
		nodes.makes.textContent = pad(state.horse.made)
		// All five letters show, with the earned ones lit, so you can see how many misses are left.
		nodes.attempts.innerHTML = LETTERS.map((letter, i) => `<span class="letter${i < state.horse.letters ? ' earned' : ''}">${letter}</span>`).join('')
		nodes.accuracy.textContent = pad(state.horse.best)
		return
	}
	if (state.mode === 'free-throws') {
		nodes.makes.textContent = pad(state.round.made)
		nodes.attempts.textContent = pad(ROUND_SHOTS - state.round.taken)
		nodes.accuracy.textContent = pad(state.round.best)
		return
	}
	nodes.makes.textContent = pad(state.makes)
	nodes.attempts.textContent = pad(state.attempts)
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
	document.body.dataset.charge = state.phase === 'charging' ? state.chargeSource : ''
	nodes['shoot-label'].textContent = state.phase === 'charging' ? 'Release to let it fly' : state.ball?.by === 'cpu' ? 'Watch the shot…' : state.phase === 'flight' || state.phase === 'dunk' ? 'Watch your shot…' : 'Hold to charge · release to shoot'
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

// Puts the player at the next ball's rack, facing the rim, with the meter's band over that spot's scoring range.
function placeForStation() {
	const shot = nextShot(state.contest)
	if (!shot) return
	const { spot, window } = STATIONS[shot.station]
	state.player.x = spot.x
	state.player.y = spot.y
	state.yaw = Math.atan2(HOOP.y - spot.y, HOOP.x - spot.x)
	state.pointer = undefined
	nodes['power-target'].style.left = `${window.min * 100}%`
	nodes['power-target'].style.width = `${(window.max - window.min) * 100}%`
}

const PICK_HINT = IS_TOUCH ? 'Tap a rack to make it your money rack' : 'Pick your money rack with ← →'
function pickMoneyRack(rack) {
	if (state.mode !== 'three-point' || hasStarted(state.contest) || state.contest.isOver) return
	state.contest = chooseMoneyRack(state.contest, rack)
	setFeedback(`Money rack: rack ${state.contest.moneyRack + 1}. ${IS_TOUCH ? 'Tap Shoot' : 'Shoot'} to start.`)
}

function beginCharge(source) {
	if (state.phase !== 'ready' || state.paused || nodes.help.open) return
	ensureAudio()
	if (state.mode === 'three-point') {
		// Like a new free throw round, this press only resets the racks, so the player can pick a money rack again.
		if (state.contest.isOver) {
			state.contest = startContest(state.contest.best, state.contest.moneyRack)
			startLog()
			placeForStation()
			setFeedback(`${PICK_HINT}, then shoot to start.`)
			updateStats()
			return
		}
		if (isTimeUp(state.contest, state.time) || !nextShot(state.contest)) return
		if (!hasStarted(state.contest)) state.contest = startClock(state.contest, state.time)
	}
	// This press only starts the next round, so the player sees the new spot and band before shooting.
	if (state.mode === 'free-throws' && isDone(state.round)) {
		state.round = startRound(state.round.best, state.round.level + 1)
		startLog()
		placeForRound()
		setFeedback(`Round ${state.round.level}, from ${levelOf(state.round).distance} m. Ten shots.`)
		updateStats()
		return
	}
	if (isDuel()) {
		if (!state.duel) return
		// Like a new free throw round, this press only starts a new game, which opens with the coin flip.
		// A rematch skips the coin: the loser of the last game shoots first.
		if (state.duel.winner) return startNewDuel(other(state.duel.winner))
		if (turnOf(state.duel) !== 'you') {
			setFeedback(`${cpuName()}’s ball.`)
			return
		}
		if (state.duel.phase === 'match' && !isOnSpot(state.player, state.duel.spot)) {
			setFeedback('Step into the ring to match the shot.')
			return
		}
	} else if (state.mode === 'horse') {
		// Like a new free throw round, this press only starts a new game, so the player sees the first spot first.
		if (state.horse.isOver) {
			state.horse = startHorse(state.horse.best)
			startLog()
			setFeedback('New game. Walk into the ring.')
			updateStats()
			return
		}
		if (!isOnSpot(state.player, state.horse.spot)) {
			setFeedback('Step into the ring to shoot.')
			return
		}
	}
	if (state.mode === 'clock') {
		// Like a new free throw round, this press only resets the score, so the 60 seconds start with the next shot.
		if (state.clock.isOver) {
			state.clock = startClockRound(state.clock.best)
			startLog()
			setFeedback('60 seconds again. Your first shot starts it.')
			updateStats()
			return
		}
		if (state.clock.endsAt === undefined) state.clock = startClock(state.clock, state.time)
	}
	// A dunk needs no charge: it starts on the press, with no meter or aim guide.
	const dunk = canDunk() && planDunk(state.player, state.moving, state.lastDunk)
	if (dunk) return startDunk(dunk)
	state.phase = 'charging'
	state.chargeSource = source
	state.charge = 0
	state.power = 0
}

function releaseShot(source) {
	if (state.phase !== 'charging' || source !== state.chargeSource) return
	state.lastPower = state.power
	if (state.mode === 'three-point') return releaseContestBall()
	state.ball = createShot(state.player, state.yaw, state.power)
	state.ball.distance = shotDistance(state.player)
	state.ball.from = { x: state.player.x, y: state.player.y }
	state.ball.by = 'you'
	// Scored from where the shot was released, since the player can walk while the ball is in the air.
	state.ball.points = pointsFor(state.player)
	state.ball.releasedAt = state.time
	state.returnTime = undefined
	state.phase = 'flight'
	state.chargeSource = undefined
	state.followThrough = 0.65
	setFeedback('Let it fly.')
	updateStats()
	playSound('shoot')
}

const canDunk = () => state.mode === 'free' || state.mode === 'clock'

// Timed from the press, so in beat the clock a dunk started before the buzzer counts like a shot released before it.
// It's a two from inside the arc, with no distance, so it never shows as a longest make.
function dunkThrough(pressedAt, from) {
	return { ...dunkBall(), releasedAt: pressedAt, points: 2, distance: 0, from }
}

function startDunk(plan) {
	state.returnTime = undefined
	// With reduced motion there is no jump: the ball just drops through the hoop.
	if (STILL) {
		state.ball = dunkThrough(state.time, { x: state.player.x, y: state.player.y })
		state.phase = 'flight'
		playDunkSound(plan.bend)
		return
	}
	state.lastDunk = plan.id
	state.dunk = { ...plan, start: state.time, from: { x: state.player.x, y: state.player.y }, grabbed: false, letGo: false }
	state.yaw = plan.angle + Math.PI
	state.phase = 'dunk'
}

function updateDunk() {
	const dunk = state.dunk
	const t = state.time - dunk.start
	const pose = dunkPose(dunk, t)
	state.player.x = HOOP.x + Math.cos(dunk.angle) * pose.d
	state.player.y = HOOP.y + Math.sin(dunk.angle) * pose.d
	state.yaw = dunk.angle + Math.PI + (pose.spin ?? 0)
	if (!dunk.grabbed && t >= dunk.slamAt) {
		dunk.grabbed = true
		playDunkSound(dunk.bend)
	}
	if (!dunk.letGo && t >= dunk.releaseAt) {
		dunk.letGo = true
		playSound('spring')
	}
	if (!state.ball && t >= dunk.throughAt) state.ball = dunkThrough(dunk.start, dunk.from)
	if (t >= dunk.length) {
		state.dunk = undefined
		state.phase = 'flight'
	}
}

// The ball leaves the rack and the next one is picked up straight away, or after the walk to the next rack.
const RELOAD = 0.3
const STATION_MOVE = 0.7
function releaseContestBall() {
	const shot = nextShot(state.contest)
	const ball = createShot(state.player, state.yaw, state.power)
	ball.value = valueOf(shot, state.contest.moneyRack)
	ball.shot = state.contest.taken
	state.flying.push(ball)
	state.contest = takeBall(state.contest)
	const next = nextShot(state.contest)
	state.reloadAt = next ? state.time + (next.station === shot.station ? RELOAD : STATION_MOVE) : undefined
	state.phase = 'flight'
	state.chargeSource = undefined
	state.followThrough = 0.65
	if (!next) setFeedback('Last ball…')
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
	state.dunk = undefined
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
	// The rim is about 10px wide on a phone, smaller than a fingertip, so a touch near it aims dead centre.
	const hoop = project(HOOP.x, HOOP.y, HOOP.z)
	const pixelsFromHoop = Math.hypot(sx - hoop.sx, sy - hoop.sy) * rect.width / W
	if (event.pointerType !== 'mouse' && pixelsFromHoop < HOOP_SNAP_PX) state.pointer = { x: HOOP.x, y: HOOP.y }
	updateAim()
}

function updateAim() {
	// Touch screens have no hovering cursor to follow, so until the player taps somewhere else they keep facing the rim.
	const target = state.pointer ?? (IS_TOUCH ? HOOP : undefined)
	if (!target || state.mode === 'free-throws' || state.mode === 'three-point' || state.phase === 'dunk') return
	const dx = target.x - state.player.x
	const dy = target.y - state.player.y
	if (Math.hypot(dx, dy) > 0.3) state.yaw = Math.atan2(dy, dx)
}

function takeFreeThrow(made) {
	const bestBefore = state.round.best
	state.log.push({ made })
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
		showResults(freeThrowResults({
			log: state.log, made: state.round.made, level: state.round.level, best, bestBefore,
			distance: levelOf(state.round).distance, nextDistance: levelOf(next).distance,
		}))
	} else {
		setFeedback(made ? `Good. ${score}.` : `Off the mark. ${score}.`, made)
	}
}

function finishClock() {
	const bestBefore = state.clock.best
	state.clock = finishRound(state.clock, state.time)
	const { points, best } = state.clock
	if (best > bestBefore) {
		try { localStorage.setItem(CLOCK_BEST_KEY, String(best)) } catch {}
	}
	// Kept short so the message fits on one line on a phone.
	let verdict = `Best ${best}.`
	if (bestBefore === 0) verdict = 'One to beat.'
	else if (best > bestBefore) verdict = 'New best!'
	setFeedback(`Time! ${points} points. ${verdict} ${IS_TOUCH ? 'Tap Shoot' : 'Press Space'} to restart.`, best > bestBefore)
	updateStats()
	showResults(clockResults({ log: state.log, points, best, bestBefore }))
}

// Where a shot was released from, for the court charts.
function shotSpot(ball, made) {
	const from = ball.from ?? HOOP
	return { made, points: ball.points, distance: ball.distance, out: from.x - HOOP.x, across: from.y - HOOP.y, dunk: !!ball.dunk }
}

function logClockShot(made) {
	const { ball, clock } = state
	state.log.push({ at: ball.releasedAt - (clock.endsAt - ROUND_SECONDS), ...shotSpot(ball, made) })
}

function logFreeShot(made) {
	state.session.push(shotSpot(state.ball, made))
	renderSession()
}

// Free shooting's header stats open a court of the session so far.
function renderSession() {
	if (nodes['session-panel'].hidden) return
	const { shots, zones } = courtOf(state.session)
	const made = state.session.filter(shot => shot.made).length
	nodes['session-summary'].textContent = state.session.length ? `${made} of ${state.session.length} · ${Math.round(made / state.session.length * 100)}%` : 'No shots yet'
	nodes['session-court'].replaceChildren(courtChart(shots, zones))
	nodes['session-zones'].replaceChildren(zoneTallies(zones))
}

function setSessionOpen(open) {
	nodes['session-panel'].hidden = !open
	nodes['session-open'].setAttribute('aria-expanded', String(open))
	renderSession()
}

function finishContest() {
	const bestBefore = state.contest.best
	state.contest = finishRound(state.contest, state.time)
	const { points, best } = state.contest
	if (best > bestBefore) {
		try { localStorage.setItem(THREE_POINT_BEST_KEY, String(best)) } catch {}
	}
	state.phase = 'ready'
	state.reloadAt = undefined
	// Kept short so the message fits on one line on a phone.
	let verdict = `Best ${best}.`
	if (bestBefore === 0) verdict = 'One to beat.'
	else if (best > bestBefore) verdict = 'New best!'
	const ending = nextShot(state.contest) ? 'Time!' : 'Racks done!'
	setFeedback(`${ending} ${pointsText(points)}. ${verdict} ${IS_TOUCH ? 'Tap Shoot' : 'Press Space'} to restart.`, best > bestBefore)
	updateStats()
	showResults(contestResults({
		log: state.log, moneyRack: state.contest.moneyRack, points, best, bestBefore,
		secondsLeft: secondsLeft(state.contest, state.time), racksDone: !nextShot(state.contest),
	}))
}

const pointsText = points => `${points} ${points === 1 ? 'point' : 'points'}`

const CONTEST_CALLOUTS = { 1: 'BASKET!', 2: 'MONEY BALL!', 3: 'DEEP THREE!' }
function scoreContestBall(ball) {
	state.contest = recordMake(state.contest, ball.value)
	state.log.push({ shot: ball.shot, made: true })
	const title = ball.value === 1 && ball.banked ? 'BANK SHOT!' : CONTEST_CALLOUTS[ball.value]
	showCallout(title, `+${ball.value} · ${state.contest.points} PTS`)
	setFeedback(`${pointsText(state.contest.points)}.`, true)
	updateStats()
}

function updateContest(delta) {
	for (const ball of state.flying) {
		for (const event of stepBall(ball, delta)) {
			playSound(event)
			if (event === 'board') ball.banked = true
			if (event === 'score') scoreContestBall(ball)
		}
		if (ball.goneAt === undefined && (ball.made || isDead(ball))) {
			ball.goneAt = state.time + (ball.made ? 1.2 : 0.9)
			if (!ball.made) state.log.push({ shot: ball.shot, made: false })
		}
	}
	state.flying = state.flying.filter(ball => ball.goneAt === undefined || state.time < ball.goneAt)
	if (state.reloadAt !== undefined && state.time >= state.reloadAt) {
		state.reloadAt = undefined
		placeForStation()
		state.phase = 'ready'
	}
	const contest = state.contest
	if (contest.isOver || !hasStarted(contest)) return
	const timeUp = isTimeUp(contest, state.time)
	// At the buzzer a charge is lost, but balls already in the air play out and can still count.
	if (timeUp && state.phase === 'charging') cancelInput()
	if ((timeUp || !nextShot(contest)) && state.flying.length === 0 && state.phase !== 'charging') finishContest()
}

function showCallout(title, detail) {
	state.scoredAt = state.time
	nodes['callout-title'].textContent = title
	nodes['callout-detail'].textContent = detail
	nodes['basket-callout'].hidden = false
	replayAnimation(nodes['basket-callout'], 'celebrate')
	replayAnimation(nodes.makes.closest('.session-stats'), 'scored')
}

function startLog() {
	state.log = []
	nodes.results.hidden = true
}

const el = (tag, className = '', text = '') => Object.assign(document.createElement(tag), { className, textContent: text })

// The card shown when a round ends: see results.js for what each mode puts on it.
function showResults(results) {
	nodes.results.dataset.mode = state.mode
	nodes['results-label'].textContent = results.label
	nodes['results-side'].textContent = results.side
	nodes['results-score'].replaceChildren(results.score, ...(results.scoreUnit ? [el('small', '', results.scoreUnit)] : []))
	nodes['results-note'].textContent = results.scoreNote
	nodes['results-stamp'].hidden = !results.stamp
	if (results.stamp) {
		nodes['results-stamp-text'].textContent = results.stamp.text
		nodes['results-stamp-detail'].textContent = results.stamp.detail
	}
	nodes['results-chart'].replaceChildren(...CHARTS[results.chart.type](results.chart))
	nodes['results-stats'].replaceChildren(...results.stats.map(stat => {
		const value = el('strong', '', String(stat.value))
		if (stat.of !== undefined) value.append(el('small', '', `/${stat.of}`))
		if (stat.unit) value.append(el('small', '', stat.unit))
		const slot = el('div')
		slot.append(value, el('span', '', stat.label))
		return slot
	}))
	nodes['results-foot-note'].textContent = results.note
	nodes['results-action'].textContent = results.action ?? 'Play again'
	nodes['results-action-detail'].textContent = results.actionDetail ?? ''
	nodes['results-action-detail'].hidden = !results.actionDetail
	// The card takes over from the last basket's popup, which would otherwise poke out above it.
	nodes['basket-callout'].hidden = true
	nodes.results.hidden = false
}

const ballMark = (value, outcome) => el('span', `ball v${value} ${outcome}`)

// The beat the clock card opens on the court, and remembers the tab picked last time.
let clockView = 'court'

function legendItems(view) {
	return [[3, 'Three'], [2, 'Two'], [0, 'Miss']].map(([points, text]) => {
		const item = el('span')
		const mark = view === 'court' ? el('span', `spot${points ? ' made' : ' missed'}${points === 3 ? ' three' : ''}`) : el('span', `tick p${points}`)
		item.append(mark, text)
		return item
	})
}

// The half court from above with the basket at the bottom, in decimetres: 6.7 m to each sideline, from the baseline
// 1.7 m behind the hoop to 12 m out, so the arc sits about as far up the chart as it does on the game's court.
// Shots from farther out sit on the top edge.
const COURT_W = 134
const COURT_H = 137
const COURT_TOP = 12
const COURT_LINES = `<svg viewBox="0 0 ${COURT_W} ${COURT_H}" aria-hidden="true">
	<path class="zone" d="M0 0H134V137H125V86.5A67 67 0 0 0 9 86.5V137H0Z" />
	<rect class="zone paint" x="41.5" y="78" width="51" height="59" />
	<path class="lines" d="M0.3 0V136.7H133.7V0M41.5 136.7V78H92.5V136.7M9 136.7V86.5A67 67 0 0 1 125 86.5V136.7M46 78A21 21 0 0 1 88 78" />
	<path class="lines dashed" d="M46 78A21 21 0 0 0 88 78" />
	<path class="board" d="M58 129H76" />
	<circle class="rim" cx="67" cy="120" r="2.3" />
</svg>`

function courtChart(shots, zones) {
	const court = el('div', 'court')
	court.setAttribute('role', 'img')
	court.setAttribute('aria-label', `Shot chart: ${zones.map(zone => `${zone.label.toLowerCase()} ${zone.made} of ${zone.taken}`).join(', ')}`)
	court.innerHTML = COURT_LINES
	for (const shot of shots) {
		const spot = shot.letter ? el('span', 'spot letter', shot.letter) : el('span', `spot ${shot.made ? 'made' : 'missed'}${shot.three ? ' three' : ''}`)
		spot.style.left = `${(shot.across * 10 + COURT_W / 2) / COURT_W * 100}%`
		spot.style.top = `${clamp((COURT_TOP - shot.out) * 10, 1, COURT_H - 1) / COURT_H * 100}%`
		court.append(spot)
	}
	return court
}

// Makes by zone with the make rate, kept under the court so nothing covers the shots.
function zoneTallies(zones) {
	const row = el('div', 'zone-tallies')
	row.setAttribute('aria-hidden', 'true')
	row.append(...zones.map(zone => {
		const rate = zone.taken ? Math.round(zone.made / zone.taken * 100) : 0
		const value = el('strong', '', String(zone.made))
		value.append(el('small', '', `/${zone.taken}`))
		const top = el('div', 'zone-tally-top')
		top.append(value, el('span', '', zone.taken ? `${rate}%` : '—'))
		const fill = el('i')
		fill.style.width = `${rate}%`
		const bar = el('div', 'zone-bar')
		bar.append(fill)
		const slot = el('div', zone.id)
		slot.append(top, bar, el('span', 'zone-name', zone.label))
		return slot
	}))
	return row
}

const CHARTS = {
	racks({ columns }) {
		const racks = el('div', 'racks')
		for (const column of columns) {
			const rack = el('div', `rack${column.isMoney ? ' money' : ''}`)
			const made = column.balls.filter(b => b.outcome === 'made').length
			rack.setAttribute('aria-label', `${column.label.toLowerCase()}: ${made} of ${column.balls.length}, ${pointsText(column.points)}`)
			const balls = el('div', 'rack-balls')
			balls.append(...column.balls.map(b => ballMark(b.value, b.outcome)))
			rack.append(el('span', 'rack-label', column.label), balls, el('strong', '', String(column.points)), el('span', 'rack-tag', column.isMoney ? 'MONEY' : ''))
			racks.append(rack)
		}
		const legend = el('div', 'results-legend')
		legend.setAttribute('aria-hidden', 'true')
		for (const [value, outcome, text] of [[1, 'made', '1 pt'], [2, 'made', 'Money ball, 2'], [3, 'made', 'Deep ball, 3'], [1, 'missed', 'Missed']]) {
			const item = el('span')
			item.append(ballMark(value, outcome), text)
			legend.append(item)
		}
		return [racks, legend]
	},
	timeline({ shots }) {
		const line = el('div', 'timeline')
		line.setAttribute('aria-label', `${shots.length} shots over 60 seconds`)
		for (const shot of shots) {
			const tick = el('span', `tick p${shot.points}`)
			tick.style.left = `${shot.at / ROUND_SECONDS * 100}%`
			line.append(tick)
		}
		const axis = el('div', 'timeline-axis')
		axis.append(el('span', '', '0 s'), el('span', '', '30 s'), el('span', '', '60 s'))
		const legend = el('div', 'results-legend')
		legend.setAttribute('aria-hidden', 'true')
		for (const [points, text] of [[3, 'Three'], [2, 'Two'], [0, 'Miss']]) {
			const item = el('span')
			item.append(el('span', `tick p${points}`), text)
			legend.append(item)
		}
		return [line, axis, legend]
	},
	clock({ shots, zones }) {
		const court = el('div', 'court-view')
		court.append(courtChart(shots, zones))
		const timeline = el('div', 'timeline-view')
		timeline.append(...CHARTS.timeline({ shots }).slice(0, 2))
		const views = { court, timeline }
		const tabs = el('div', 'chart-tabs')
		tabs.setAttribute('role', 'tablist')
		tabs.setAttribute('aria-label', 'Chart')
		const buttons = Object.entries({ court: 'Court', timeline: 'Timeline' }).map(([id, text]) => {
			const button = el('button', '', text)
			button.type = 'button'
			button.setAttribute('role', 'tab')
			// A mouse click leaves focus on the court, so Space still starts the next round.
			button.addEventListener('mousedown', event => event.preventDefault())
			button.addEventListener('click', () => showView(id))
			return button
		})
		tabs.append(...buttons)
		const showView = id => {
			clockView = id
			buttons.forEach((button, i) => button.setAttribute('aria-selected', String(Object.keys(views)[i] === id)))
			for (const [key, view] of Object.entries(views)) view.hidden = key !== id
			legend.replaceChildren(...legendItems(id))
		}
		const stack = el('div', 'chart-views')
		stack.append(court, timeline)
		const legend = el('div', 'results-legend')
		legend.setAttribute('aria-hidden', 'true')
		const foot = el('div', 'chart-foot')
		foot.append(legend, tabs)
		showView(clockView)
		return [stack, foot]
	},
	shots({ shots }) {
		const row = el('ol', 'shot-row')
		row.setAttribute('aria-label', 'Shot by shot')
		shots.forEach((made, i) => {
			const item = el('li')
			item.setAttribute('aria-label', `${i + 1}: ${made ? 'made' : 'missed'}`)
			item.append(ballMark(1, made ? 'made' : 'missed'), el('span', '', String(i + 1)))
			row.append(item)
		})
		return [row]
	},
	// Each miss shows the letter it earned where it was taken, so the court tells the whole game.
	horse({ shots, zones }) {
		const legend = el('div', 'results-legend')
		legend.setAttribute('aria-hidden', 'true')
		for (const [className, text, mark] of [['spot made', 'Made', ''], ['spot letter', 'Letter', 'H']]) {
			const item = el('span')
			item.append(el('span', className, mark), text)
			legend.append(item)
		}
		return [courtChart(shots, zones), zoneTallies(zones), legend]
	},
	// Every shot that was set, in the setter's colour, with the letter the other player took where they missed the match.
	duel({ sets, letters, name }) {
		const mine = sets.filter(set => set.by === 'you').length
		const court = el('div', 'court')
		court.setAttribute('role', 'img')
		court.setAttribute('aria-label', `Shot chart: you set ${mine} shots and ${name} set ${sets.length - mine}`)
		court.innerHTML = COURT_LINES
		for (const set of sets) {
			const spot = el('span', `spot set ${set.by}${set.letter ? ' letter' : ''}`, set.letter)
			spot.style.left = `${(set.across * 10 + COURT_W / 2) / COURT_W * 100}%`
			spot.style.top = `${clamp((COURT_TOP - set.out) * 10, 1, COURT_H - 1) / COURT_H * 100}%`
			court.append(spot)
		}
		const rows = el('div', 'duel-letters')
		for (const [who, label] of [['you', 'YOU'], ['cpu', name.toUpperCase()]]) {
			const row = el('div', 'duel-row')
			row.setAttribute('aria-label', `${label}: ${letters[who] ? LETTERS.slice(0, letters[who]).join('-') : 'no letters'}`)
			row.append(el('span', `duel-name ${who}`, label), ...LETTERS.map((letter, i) => el('span', `letter${i < letters[who] ? ' earned' : ''}`, letter)))
			rows.append(row)
		}
		const legend = el('div', 'results-legend')
		legend.setAttribute('aria-hidden', 'true')
		for (const [className, text, mark] of [['spot set you', 'You set', ''], ['spot set cpu', `${name} set`, ''], ['spot letter', 'Missed match', 'H']]) {
			const item = el('span')
			item.append(el('span', className, mark), text)
			legend.append(item)
		}
		return [court, rows, legend]
	},
}

// A make can land while the last one's popup is still showing, so the class is already on and the animation would not
// restart. Reading layout in between makes the browser start it again.
function replayAnimation(node, className) {
	node.classList.remove(className)
	void node.offsetWidth
	node.classList.add(className)
}

function takeHorseShot(made) {
	const before = state.horse
	state.horse = recordHorseShot(state.horse, made)
	const { made: makes, letters, best, isOver } = state.horse
	state.log.push({ ...shotSpot(state.ball, made), tier: TIERS.indexOf(tierOf(before.made)), letter: made ? '' : LETTERS[letters - 1] })
	if (isOver) {
		if (best > before.best) {
			try { localStorage.setItem(HORSE_BEST_KEY, String(best)) } catch {}
		}
		// Kept short so the message fits on one line on a phone.
		let verdict = `Best ${best}.`
		if (before.best === 0) verdict = 'One to beat.'
		else if (best > before.best) verdict = 'New best!'
		setFeedback(`HORSE. ${makes} made. ${verdict} ${IS_TOUCH ? 'Tap Shoot' : 'Press Space'} to restart.`, best > before.best)
		showResults(horseResults({ log: state.log, made: makes, best, bestBefore: before.best }))
		return
	}
	if (!made) {
		setFeedback(`Missed. That’s ${LETTERS.slice(0, letters).join('-')}. Next spot.`)
		return
	}
	const movedBack = tierOf(makes) !== tierOf(before.made)
	setFeedback(movedBack ? `${makes} made. The spots move back.` : `${makes} made. Next spot.`, true)
}

// The CPU walks to its spot, settles, charges for a moment like a held Space, and lets it go.
const CPU_SPEED = 3.4
const CPU_SETTLE = 0.5
const CPU_CHARGE = 0.9
// Between turns it waits on the sideline, across from you.
const restSpot = () => ({ x: -2.2, y: state.player.y > 0 ? -5.6 : 5.6 })

// A new matchup opens with the coin flip; a rematch passes `first`, whoever lost the last game.
function startNewDuel(first) {
	startLog()
	state.stepAside = undefined
	Object.assign(state.cpu, { task: 'idle', until: 0, followThrough: 0, rest: restSpot() })
	if (first) {
		state.coin = null
		state.duel = startDuel(cpuSetup.level, first)
		state.cpu.until = state.time + 1.2
		const name = cpuName()
		showCallout('REMATCH', first === 'you' ? 'YOU START' : `${name.toUpperCase()} STARTS`)
		setFeedback(first === 'you' ? 'Rematch. You lost the last one, so you start. Make a shot from anywhere to set it.' : `Rematch. ${name} lost the last one, so ${name} starts.`)
		updateStats()
		return
	}
	state.duel = null
	state.coin = { phase: 'call' }
	nodes['coin-versus'].textContent = `VS ${cpuName().toUpperCase()} · ${LEVEL_NAMES[cpuSetup.level].toUpperCase()}`
	nodes['coin-call'].hidden = false
	nodes.coin.hidden = true
	setFeedback('Heads or tails? Call it to start the game.')
	updateStats()
}

const COIN_FLIGHT = 1.55
const menuIsOpen = () => Boolean(document.querySelector('.menu-options:not([hidden]), .audio-panel:not([hidden])'))
function callCoin(called) {
	if (!isDuel() || state.coin?.phase !== 'call' || menuIsOpen()) return
	const landed = tossCoin()
	state.coin = { phase: 'flip', called, landed, lands: state.time + COIN_FLIGHT }
	nodes['coin-call'].hidden = true
	// The face it lands on is the front, so the spin ends showing it.
	const [front, back] = nodes.coin.querySelectorAll('canvas')
	paintCoin(front, landed)
	paintCoin(back, landed === 'heads' ? 'tails' : 'heads')
	nodes.coin.hidden = false
	replayAnimation(nodes.coin, 'tossing')
	canvas.focus({ preventScroll: true })
	setFeedback(`You called ${called}…`)
	updateStats()
}

function landCoin() {
	const { called, landed } = state.coin
	const first = firstShooter(called, landed)
	state.coin = null
	state.duel = startDuel(cpuSetup.level, first)
	state.cpu.until = state.time + 1.2
	const name = cpuName()
	showCallout(landed.toUpperCase(), first === 'you' ? 'YOU CALLED IT · YOUR BALL' : `YOU CALLED ${called.toUpperCase()} · ${name.toUpperCase()} STARTS`)
	setFeedback(first === 'you' ? 'You called it. Make a shot from anywhere to set it.' : `It’s ${landed}. ${name} sets the first shot.`, first === 'you')
	updateStats()
}

// The coin's faces, 16 pixels across: a basketball on heads, a hoop and net on tails.
function paintCoin(target, side) {
	const pixels = new Uint32Array(16 * 16)
	for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
		const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy)
		if (d > 7.7) continue
		let color = d > 6.6 ? [138, 106, 28] : [232, 186, 58]
		if (d > 5.6 && d <= 6.6 && dx + dy < -4) color = [248, 227, 160]
		if (side === 'heads' && d <= 3.6) color = x === 7 || y === 7 || (d > 2.4 && d < 3.4 && Math.abs(dx) > 2.2) ? [74, 38, 20] : [192, 96, 47]
		if (side === 'tails' && y === 4 && x >= 4 && x <= 11) color = [191, 91, 50]
		if (side === 'tails' && y >= 5 && y <= 10 && Math.abs(dx) <= 4 - Math.floor((y - 5) * 0.6) && (x + y) % 2 === 0) color = [255, 250, 240]
		pixels[y * 16 + x] = rgb(...color)
	}
	target.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), 16, 16), 0, 0)
}

function takeDuelShot(made) {
	const { ball } = state
	const by = ball.by ?? 'you'
	const before = state.duel
	state.duel = recordDuelShot(before, { by, made, from: ball.from })
	const { duel } = state
	const missedMatch = before.phase === 'match' && !made
	state.log.push({ ...shotSpot(ball, made), by, phase: before.phase, letter: missedMatch ? LETTERS[duel.letters[by] - 1] : '' })
	if (duel.winner) return finishDuel()
	const name = cpuName()
	const spelled = count => LETTERS.slice(0, count).join('-')
	const lastTry = duel.phase === 'match' && duel.letters[turnOf(duel)] === LETTERS.length - 1
	if (before.phase === 'set' && made && by === 'you') {
		setFeedback(`Set from ${ball.distance.toFixed(1)} m. ${name} has to make it from there.`, true)
	} else if (before.phase === 'set' && made) {
		setFeedback(`${name} made it from ${ball.distance.toFixed(1)} m. ${lastTry ? 'Make it from the ring, or that’s E.' : 'Match it from the ring.'}`)
	} else if (before.phase === 'set') {
		setFeedback(by === 'you' ? `Missed. ${name}’s ball.` : `${name} missed. Your ball. Shoot from anywhere.`)
	} else if (made) {
		setFeedback(by === 'you' ? `Matched. ${name}’s ball again.` : `${name} matched it. Your ball again.`, by === 'you')
	} else {
		setFeedback(by === 'you' ? `Missed. That’s ${spelled(duel.letters.you)}. ${name}’s ball.` : `${name} missed. That’s ${spelled(duel.letters.cpu)} for ${name}. Your ball.`, by === 'cpu')
	}
}

function finishDuel() {
	const { duel } = state
	const won = duel.winner === 'you'
	const recordBefore = cpuRecord
	cpuRecord = recordResult(cpuRecord, duel.level, won)
	try { localStorage.setItem(CPU_RECORD_KEY, JSON.stringify(cpuRecord)) } catch {}
	showRecord()
	const name = cpuName()
	const { won: wins, lost } = cpuRecord[duel.level]
	setFeedback(`${won ? `HORSE for ${name}. You win.` : `HORSE. ${name} wins.`} ${wins}–${lost} on ${LEVEL_NAMES[duel.level]}. ${IS_TOUCH ? 'Tap Shoot' : 'Press Space'} to play again.`, won)
	updateStats()
	nodes.results.style.setProperty('--cpu', `rgb(${cpuJersey().shirt.join(' ')})`)
	showResults(duelResults({ log: state.log, duel, name, level: duel.level, record: cpuRecord, recordBefore }))
}

// You can stand where the CPU needs to shoot from, so you step out of its way on your own.
function stepAsideFrom(spot) {
	const away = { x: state.player.x - spot.x, y: state.player.y - spot.y }
	const gap = Math.hypot(away.x, away.y)
	if (gap > 1.5) return
	const direction = gap > 0.1 ? { x: away.x / gap, y: away.y / gap } : { x: 0, y: spot.y > 0 ? -1 : 1 }
	state.stepAside = { x: clamp(spot.x + direction.x * 2.6, -8.25, 8.3), y: clamp(spot.y + direction.y * 2.6, -6.5, 6.5) }
}

function walkToward(actor, target, speed, delta) {
	const dx = target.x - actor.x, dy = target.y - actor.y
	const gap = Math.hypot(dx, dy)
	const step = Math.min(gap, speed * delta)
	if (gap > 0) {
		actor.x += dx / gap * step
		actor.y += dy / gap * step
	}
	return gap - step < 0.02
}

function updateCpu(delta) {
	const { cpu, duel } = state
	cpu.followThrough = Math.max(0, cpu.followThrough - delta)
	cpu.walking = false
	const canAct = !duel.winner && turnOf(duel) === 'cpu' && !state.ball && state.phase === 'ready' && nodes.results.hidden
	if (cpu.task === 'idle' && canAct && state.time >= cpu.until) {
		cpu.target = duel.phase === 'match' ? duel.spot : chooseSpot(duel)
		cpu.task = 'walk'
		stepAsideFrom(cpu.target)
	}
	if (cpu.task === 'walk') {
		cpu.walking = true
		cpu.yaw = Math.atan2(cpu.target.y - cpu.y, cpu.target.x - cpu.x)
		if (walkToward(cpu, cpu.target, CPU_SPEED, delta)) {
			cpu.task = 'settle'
			cpu.yaw = yawTo(cpu)
			cpu.until = state.time + CPU_SETTLE
		}
	} else if (cpu.task === 'settle' && state.time >= cpu.until) {
		cpu.aim = aimShot(cpu, duel.level)
		cpu.yaw = cpu.aim.yaw
		cpu.task = 'charge'
		cpu.chargeStart = state.time
	} else if (cpu.task === 'charge' && state.time - cpu.chargeStart >= CPU_CHARGE) {
		state.ball = createShot(cpu, cpu.aim.yaw, cpu.aim.power)
		state.ball.distance = shotDistance(cpu)
		state.ball.from = { x: cpu.x, y: cpu.y }
		state.ball.by = 'cpu'
		state.ball.points = pointsFor(cpu)
		state.ball.releasedAt = state.time
		state.returnTime = undefined
		state.phase = 'flight'
		cpu.task = 'idle'
		cpu.followThrough = 0.65
		cpu.until = state.time + 0.9
		cpu.rest = restSpot()
		playSound('shoot')
	} else if (cpu.task === 'idle' && !canAct && !(state.ball?.by === 'cpu')) {
		// Off the ball, it waits on the sideline facing the play.
		cpu.walking = !walkToward(cpu, cpu.rest, CPU_SPEED, delta)
		cpu.yaw = cpu.walking ? Math.atan2(cpu.rest.y - cpu.y, cpu.rest.x - cpu.x) : Math.atan2(state.player.y - cpu.y, state.player.x - cpu.x)
	}
}

function update(delta) {
	if (state.paused || nodes.help.open) return
	const previousDribble = Math.floor(state.time * DRIBBLE_SPEED / Math.PI)
	state.time += delta
	// Each zero crossing of the absolute sine is a floor contact.
	const contest = state.mode === 'three-point'
	// In the contest the player holds the ball from the rack instead of dribbling it.
	if (state.phase === 'ready' && !contest && Math.floor(state.time * DRIBBLE_SPEED / Math.PI) > previousDribble) {
		playSound('dribble')
	}
	state.followThrough = Math.max(0, state.followThrough - delta)
	const keys = state.keys
	let screenX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + state.stick.x
	let screenY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + state.stick.y
	const length = Math.hypot(screenX, screenY)
	const freeThrows = state.mode === 'free-throws'
	const clock = state.mode === 'clock'
	const horse = state.mode === 'horse'
	// In HORSE you plant your feet once you start charging, so a shot is always released from inside the ring.
	const isPlanted = horse && state.phase === 'charging'
	const isFixed = freeThrows || contest || state.phase === 'dunk'
	state.walking = length > 0 && !isFixed && !isPlanted
	state.moving = undefined
	if (state.walking) {
		// Keys always walk at full speed; a partly pushed stick walks slower, for small adjustments.
		if (length > 1) {
			screenX /= length
			screenY /= length
		}
		state.moving = { x: (screenX + screenY) / Math.hypot(screenX, screenY) / R2, y: (screenY - screenX) / Math.hypot(screenX, screenY) / R2 }
		state.player.x = clamp(state.player.x + (screenX + screenY) / R2 * 4.4 * delta, -8.25, 8.3)
		state.player.y = clamp(state.player.y + (screenY - screenX) / R2 * 4.4 * delta, -6.5, 6.5)
		updateAim()
		state.stepAside = undefined
	} else if (state.stepAside && state.phase !== 'charging') {
		state.walking = true
		if (walkToward(state.player, state.stepAside, 3.5, delta)) state.stepAside = undefined
		updateAim()
	}
	if (state.coin?.phase === 'flip' && state.time >= state.coin.lands) landCoin()
	if (isDuel() && state.duel) updateCpu(delta)
	const turn = isFixed ? 0 : Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))
	if (turn) {
		state.pointer = undefined
		state.yaw += turn * 1.4 * delta
	}
	const drive = state.phase === 'charging' && canDunk() && drivingDunk(state.player, state.moving, state.lastDunk)
	if (drive) {
		state.chargeSource = undefined
		startDunk(drive)
	}
	if (state.phase === 'charging') {
		state.charge = Math.min(1, state.charge + delta / 1.6)
		let level
		if (freeThrows) level = levelOf(state.round)
		if (contest) level = STATIONS[nextShot(state.contest).station]
		state.power = level ? clamp(state.charge + wobble(state.time, level), 0, 1) : state.charge
	}
	if (state.dunk) updateDunk()
	if (state.ball) {
		const events = stepBall(state.ball, delta)
		for (const event of events) {
			playSound(event)
			if (event === 'board') state.ball.banked = true
			if (event === 'score' && state.ball.dunk && clock) {
				showCallout('DUNK!', '+2 PT')
				state.clock = recordMake(state.clock, 2)
				logClockShot(true)
				setFeedback(`Dunk! ${state.clock.points} points.`, true)
				state.returnTime = state.time + RETURN_AFTER_MAKE
				updateStats()
				continue
			}
			if (event === 'score' && state.ball.dunk) {
				showCallout('DUNK!', '+1 MADE')
				logFreeShot(true)
				state.attempts++
				state.makes++
				state.streak++
				setFeedback(state.streak > 1 ? `Dunk! ${state.streak} in a row.` : 'Dunk!', true)
				state.returnTime = state.time + 1.5
				updateStats()
				continue
			}
			if (event === 'score') {
				const distance = `${state.ball.distance.toFixed(1)} M`
				let detail = `+1 MADE · ${distance}`
				if (freeThrows) detail = '+1 MADE'
				if (clock) detail = `+${state.ball.points} PT · ${distance}`
				if (horse && isDuel()) detail = state.ball.by === 'cpu' ? `${cpuName().toUpperCase()} · ${distance}` : distance
				const banked = state.ball.banked
				showCallout(banked ? 'BANK SHOT!' : 'BASKET!', detail)
				if (freeThrows) {
					takeFreeThrow(true)
				} else if (horse && isDuel()) {
					takeDuelShot(true)
				} else if (horse) {
					takeHorseShot(true)
				} else if (clock) {
					state.clock = recordMake(state.clock, state.ball.points)
					logClockShot(true)
					const shot = state.ball.points === 3 ? 'Three!' : 'Basket!'
					setFeedback(`${shot} ${state.clock.points} points.`, true)
				} else {
					logFreeShot(true)
					state.attempts++
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
						const opener = banked ? 'Off the glass and in.' : 'Basket!'
						setFeedback(state.streak > 1 ? `${opener} ${state.streak} in a row.` : banked ? `${opener} Basket!` : 'Basket! Nice shot.', true)
					}
				}
				state.returnTime = state.time + (clock ? RETURN_AFTER_MAKE : 1.5)
				updateStats()
			}
		}
		if (isDead(state.ball) && state.returnTime === undefined) {
			state.streak = 0
			state.returnTime = state.time + (clock ? RETURN_AFTER_MISS : 1.1)
			if (freeThrows) {
				takeFreeThrow(false)
				updateStats()
			} else if (horse) {
				if (isDuel()) takeDuelShot(false)
				else takeHorseShot(false)
				updateStats()
			} else if (clock) {
				logClockShot(false)
				setFeedback('Next one, quick.')
			} else {
				logFreeShot(false)
				state.attempts++
				setFeedback('Another one. The court isn’t going anywhere.')
				updateStats()
			}
		}
		if (state.returnTime !== undefined && state.time >= state.returnTime && state.phase !== 'dunk') returnBall()
	}
	if (contest) updateContest(delta)
	if (clock && !state.clock.isOver && isTimeUp(state.clock, state.time)) {
		// At the buzzer a charge is lost, but a ball already in the air plays out and can still count.
		if (state.phase === 'charging') cancelInput()
		if (state.phase === 'ready') finishClock()
	}
	// The header shows whole seconds, so only touch the DOM when the shown second changes.
	const timed = clock ? state.clock : contest ? state.contest : undefined
	if (timed && Math.ceil(secondsLeft(timed, state.time)) !== Number(nodes.attempts.textContent)) updateStats()
	if (state.scoredAt !== undefined && state.time - state.scoredAt >= 1.8) {
		nodes['basket-callout'].hidden = true
		nodes['basket-callout'].classList.remove('celebrate')
		if (!state.coin) nodes.coin.hidden = true
		nodes.makes.closest('.session-stats').classList.remove('scored')
		state.scoredAt = undefined
	}
	if (state.phase === 'ready' && state.time - state.feedbackTime > 7 && state.mode === 'free') {
		setFeedback('Find your spot. Take your time.')
	}
	updateMeter()
}

function drawBasketball(x, y, z, time, color = BALL_COLOR) {
	sphere(x, y, z, BALL_RADIUS, color, 'solid')
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
	if (state.phase === 'flight' || state.phase === 'dunk' || state.mode === 'free-throws') return
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

// A ring on the ground round the called spot: a thick bright band between dark outlines, like the aim arc,
// so it reads on every court, including the terracotta key and the snow. It's drawn before the player, so the depth
// test lets the player stand in front of it. It turns white once the player is inside and can shoot.
const MARKER_OUTLINE = [52, 38, 48]
function drawSpotMarker(spot, yours = true) {
	const bright = yours && isOnSpot(state.player, spot) ? rgb(...NET_COLOR) : rgb(...ARC_COLOR)
	const dark = rgb(...MARKER_OUTLINE)
	const rings = [
		[SPOT_RADIUS + 0.07, dark],
		[SPOT_RADIUS, bright], [SPOT_RADIUS - 0.05, bright], [SPOT_RADIUS - 0.1, bright],
		[SPOT_RADIUS - 0.17, dark],
	]
	for (const [radius, color] of rings) {
		// Enough points that even the outer ring has no gaps between pixels.
		for (let i = 0; i < 96; i++) {
			const angle = i / 96 * Math.PI * 2
			plot(spot.x + Math.cos(angle) * radius, spot.y + Math.sin(angle) * radius, 0.02, color)
		}
	}
}

// Each rack stands just behind its spot, its balls in a row across the line of the shot, money balls at the end.
// A deep spot has its one ball on a short stand.
const RACK_SPACING = 0.5
function drawRacks() {
	const { moneyRack } = state.contest
	STATIONS.forEach((station, stationIndex) => {
		const { spot } = station
		const out = Math.hypot(spot.x - HOOP.x, spot.y - HOOP.y)
		const back = { x: (spot.x - HOOP.x) / out, y: (spot.y - HOOP.y) / out }
		const side = { x: -back.y, y: back.x }
		const base = { x: spot.x + back.x * 0.85, y: spot.y + back.y * 0.85 }
		const at = (offset, z) => [base.x + side.x * offset, base.y + side.y * offset, z]
		const left = ballsLeft(state.contest, stationIndex)
		if (station.deep !== undefined) {
			line3D(at(0, 0), at(0, 0.62), 0.06, STEEL)
			if (left) drawBasketball(...at(0, 0.62 + BALL_RADIUS), state.time, DEEP_BALL_COLOR)
			return
		}
		const half = (station.balls - 1) / 2 * RACK_SPACING + 0.3
		for (const end of [-half, half]) line3D(at(end, 0), at(end, 0.7), 0.05, STEEL)
		line3D(at(-half, 0.7), at(half, 0.7), 0.05, STEEL)
		// The rack empties from the far end, so the money ball is always the last one taken.
		for (let ball = station.balls - left; ball < station.balls; ball++) {
			const value = valueOf({ station: stationIndex, ball }, moneyRack)
			drawBasketball(...at((ball - (station.balls - 1) / 2) * RACK_SPACING, 0.7 + BALL_RADIUS), state.time, BALL_COLORS[value])
		}
	})
}

// The extra hair shapes go round the head figure() draws, so this follows its head placement for an upright pose.
function drawHair(px, py, yaw, pose, character, add) {
	const k = pose.scale || 1, base = pose.z || 0, crouch = pose.crouch || 0
	const fx = Math.cos(yaw), fy = Math.sin(yaw)
	const along = -crouch * 0.15, up = 1.28 - crouch * 0.4 + 0.95 + 0.36
	const at = ([a, b, c]) => [px + (fx * (along + a) - fy * b) * k, py + (fy * (along + a) + fx * b) * k, (up + c) * k + base]
	for (const shape of HAIRSTYLES[character.style]) {
		const color = colorOf(character, shape.color)
		const [from, to] = shape.ball ? [at(shape.ball), at(shape.ball)] : shape.strand.map(at)
		add(from, to, (shape.r ?? shape.r0) * k, (shape.r ?? shape.r1) * k, () => color)
	}
}

function cpuPose() {
	const { cpu } = state
	const charging = cpu.task === 'charge'
	const power = charging ? clamp((state.time - cpu.chargeStart) / CPU_CHARGE, 0, 1) * cpu.aim.power : 0
	const arm = charging ? 2.25 + power * 0.25 : cpu.followThrough > 0 ? 2.85 : 0.7
	const walk = cpu.walking ? Math.sin(state.time * 13) : 0
	return {
		crouch: charging ? power * 0.45 : 0,
		stance: 0.12 + walk * 0.18,
		armR: arm, armL: charging || cpu.followThrough > 0 ? arm : 0.6,
		z: cpu.walking ? Math.abs(walk) * 0.04 : 0,
	}
}

function drawCpu() {
	const { cpu } = state
	const character = cpuCharacter()
	const pose = cpuPose()
	figure(cpu.x, cpu.y, cpu.yaw, pose, paletteOf(character, cpuJersey()), dynamicAdd)
	drawHair(cpu.x, cpu.y, cpu.yaw, pose, character, dynamicAdd)
}

// A character standing in its kit, drawn by the engine into the canvas's buffers and copied out, for the picker.
// The court's frame is put back straight after, so nothing on screen changes.
const PORTRAIT = { w: 18, h: 32 }
function drawPortrait(target, character) {
	const savedPix = pix.slice(), savedZ = zb.slice()
	pix.fill(0)
	zb.fill(-1e9)
	const yaw = Math.PI / 4 - 0.35
	const pose = { stance: 0.14, armR: 0.7, armL: 0.6 }
	const solid = (a, b, r0, r1, f) => capsule(a, b, r0, r1, f, 'solid')
	figure(0, 0, yaw, pose, paletteOf(character, kitOf(character)), solid)
	drawHair(0, 0, yaw, pose, character, solid)
	const feet = project(0, 0, 0)
	const left = Math.round(feet.sx) - 8, top = Math.round(feet.sy) - 29
	const cropped = new Uint32Array(PORTRAIT.w * PORTRAIT.h)
	for (let y = 0; y < PORTRAIT.h; y++) cropped.set(pix.subarray((top + y) * W + left, (top + y) * W + left + PORTRAIT.w), y * PORTRAIT.w)
	pix.set(savedPix)
	zb.set(savedZ)
	target.width = PORTRAIT.w
	target.height = PORTRAIT.h
	target.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(cropped.buffer), PORTRAIT.w, PORTRAIT.h), 0, 0)
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
	const duel = isDuel() && state.duel
	const cpuHasBall = duel && !duel.winner && turnOf(duel) === 'cpu'
	if (isDuel()) {
		// The ring only marks a set shot waiting to be matched; setting one is from anywhere.
		if (duel && duel.phase === 'match' && !duel.winner) drawSpotMarker(duel.spot, turnOf(duel) === 'you')
		drawCpu()
	} else if (state.mode === 'horse' && !state.horse.isOver) drawSpotMarker(state.horse.spot)
	const contest = state.mode === 'three-point'
	if (contest) drawRacks()
	const dunk = state.dunk && dunkPose(state.dunk, state.time - state.dunk.start)
	drawRim(dunk?.bend, state.dunk?.angle)
	figure(state.player.x, state.player.y, state.yaw, dunk ?? {
		crouch: charging ? state.power * 0.45 : 0,
		stance: 0.12 + walkCycle * 0.18,
		armR: armAngle, armL: shotPose ? armAngle : 0.6,
		z: state.walking ? Math.abs(walkCycle) * 0.04 : 0,
	}, PALETTE, dynamicAdd)
	if (dunk?.ball) {
		const { along, across, z } = dunk.ball
		// `across` is measured facing the rim, before any spin.
		const x = HOOP.x + Math.cos(state.dunk.angle) * along + Math.sin(state.dunk.angle) * across
		const y = HOOP.y + Math.sin(state.dunk.angle) * along - Math.cos(state.dunk.angle) * across
		drawBasketball(x, y, z, state.time)
		castShadow(x, y, z, BALL_RADIUS, 1, 0)
	}
	for (const ball of state.ball ? [state.ball, ...state.flying] : state.flying) {
		drawBasketball(ball.x, ball.y, ball.z, state.time, BALL_COLORS[ball.value ?? 1])
		castShadow(ball.x, ball.y, ball.z, BALL_RADIUS, 1, 0)
	}
	const inHand = contest ? state.phase !== 'flight' && nextShot(state.contest) : !state.ball && !state.dunk
	if (inHand && cpuHasBall) {
		const { cpu } = state
		const held = cpu.task === 'charge' ? 2.5 : BALL_RADIUS + Math.abs(Math.sin(state.time * DRIBBLE_SPEED)) * 0.99
		drawBasketball(cpu.x + Math.cos(cpu.yaw) * 0.55, cpu.y + Math.sin(cpu.yaw) * 0.55, held, state.time)
	} else if (inHand) {
		const held = contest ? 1.3 : BALL_RADIUS + Math.abs(Math.sin(state.time * DRIBBLE_SPEED)) * 0.99
		const color = contest ? BALL_COLORS[valueOf(nextShot(state.contest), state.contest.moneyRack)] : BALL_COLOR
		drawBasketball(state.player.x + Math.cos(state.yaw) * 0.55, state.player.y + Math.sin(state.yaw) * 0.55, charging ? 2.5 : held, state.time, color)
	}
	drawLeaves(windTime)
	drawTufts(windTime)
	flushShadows()
	applyShadows(bakedZ)
	shadeEdges()
	drawNet(dunk?.bend, state.dunk?.angle)
	drawAimGuide()
	gradeFrame()
	ctx.putImageData(image, 0, 0)
}

// The court's pavement (with room for the player's height) and the backboard, in canvas pixels.
// Touch screens fit this box instead of the whole scene, cropping the grass and trees around it,
// which makes the court about 1.6× bigger in a phone held upright and 2× bigger sideways.
const COURT_BOX = (() => {
	const corners = [[-COURT.x, -COURT.y], [COURT.x, -COURT.y], [-COURT.x, COURT.y], [COURT.x, COURT.y]]
	const points = [
		...corners.flatMap(([x, y]) => [project(x, y, 0), project(x, y, 2.2)]),
		project(BACKBOARD_X, -1.35, 4.9), project(BACKBOARD_X, 1.35, 4.9),
	]
	const xs = points.map(point => point.sx)
	const ys = points.map(point => point.sy)
	return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
})()
const TOUCH_GUTTER_PX = 8

// Some phone browsers keep 100svh at the height from before their toolbar appeared, which pushes the controls
// under it until a reload. The window's own height is always current.
function fitPageHeight() {
	document.documentElement.style.setProperty('--page-height', `${innerHeight}px`)
}

function resizeCanvas() {
	fitPageHeight()
	const rect = nodes.stage.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	if (IS_TOUCH) {
		const boxWidth = COURT_BOX.right - COURT_BOX.left
		const boxHeight = COURT_BOX.bottom - COURT_BOX.top
		const fit = Math.min((rect.width - TOUCH_GUTTER_PX * 2) / boxWidth, rect.height / boxHeight)
		// Whole device pixels per game pixel keep the pixel art even.
		const scale = Math.max(1, Math.floor(fit * dpr)) / dpr
		canvas.style.width = `${W * scale}px`
		canvas.style.height = `${H * scale}px`
		// The canvas is centred in the stage by CSS; this shifts it so the court box is centred instead.
		const shiftX = (W / 2 - (COURT_BOX.left + COURT_BOX.right) / 2) * scale
		const shiftY = (H / 2 - (COURT_BOX.top + COURT_BOX.bottom) / 2) * scale
		canvas.style.translate = `calc(-50% + ${shiftX}px) calc(-50% + ${shiftY}px)`
	} else {
		const available = Math.min(rect.width / W, rect.height / H)
		const scale = available < 1 ? available : Math.max(1, Math.floor(available * dpr)) / dpr
		canvas.style.width = `${W * scale}px`
		canvas.style.height = `${H * scale}px`
	}
	const canvasRect = canvas.getBoundingClientRect()
	const hoop = project(HOOP.x, HOOP.y, HOOP.z)
	nodes['basket-callout'].style.left = `${canvasRect.left + hoop.sx / W * canvasRect.width}px`
	nodes['basket-callout'].style.top = `${canvasRect.top + (hoop.sy - 14) / H * canvasRect.height}px`
	// Tossed over open floor behind where you start, clear of you, the CPU on the sideline and the streetlight.
	const toss = project(3.6, -0.7, 0.6)
	nodes.coin.style.left = `${canvasRect.left + toss.sx / W * canvasRect.width}px`
	nodes.coin.style.top = `${canvasRect.top + toss.sy / H * canvasRect.height}px`
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
	if (state.coin?.phase === 'call') {
		const side = { KeyH: 'heads', ArrowLeft: 'heads', KeyT: 'tails', ArrowRight: 'tails' }[event.code]
		if (side) {
			event.preventDefault()
			callCoin(side)
		}
		return
	}
	const rackKey = /^Digit([1-5])$/.exec(event.code)
	if (rackKey) return pickMoneyRack(Number(rackKey[1]) - 1)
	if (!MOVEMENT_KEYS.includes(event.code)) return
	event.preventDefault()
	const rackStep = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[event.code]
	if (rackStep && !event.repeat) pickMoneyRack(state.contest.moneyRack + rackStep)
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
// Before the contest starts, a click or tap on a rack makes it the money rack.
const RACK_PICK_PX = 40
function pickRackAt(event) {
	if (state.mode !== 'three-point' || hasStarted(state.contest) || state.contest.isOver) return false
	const rect = canvas.getBoundingClientRect()
	const sx = (event.clientX - rect.left) * W / rect.width
	const sy = (event.clientY - rect.top) * H / rect.height
	let picked, nearest = RACK_PICK_PX
	for (const { rack, spot } of STATIONS) {
		if (rack === undefined) continue
		const p = project(spot.x, spot.y, 0.8)
		const pixels = Math.hypot(sx - p.sx, sy - p.sy) * rect.width / W
		if (pixels < nearest) [picked, nearest] = [rack, pixels]
	}
	if (picked === undefined) return false
	pickMoneyRack(picked)
	return true
}
canvas.addEventListener('pointermove', aimAtPointer)
// Holding the left mouse button on the court charges a shot like Space; a quick click only aims or focuses it.
const CLICK_MS = 150
let mouseDownAt = 0
canvas.addEventListener('pointerdown', event => {
	canvas.focus({ preventScroll: true })
	if (pickRackAt(event)) return
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
// The round is over while the card shows, so this only starts the next one, like Space.
nodes['results-again'].addEventListener('click', () => beginCharge('button'))
nodes.shoot.addEventListener('pointercancel', cancelInput)
// iOS starts its long-press text selection and Copy menu from touch events, which user-select: none and a
// prevented pointerdown don't always stop, so the held controls cancel the touch itself. Pointer events still fire.
for (const control of [nodes.shoot, nodes.stick, ...nodes.turn.children]) {
	for (const type of ['touchstart', 'contextmenu', 'selectstart']) {
		control.addEventListener(type, event => event.preventDefault(), { passive: false })
	}
}

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
// The ↺ / ↻ buttons hold Q / E, so they turn the aim exactly like the keys do.
for (const button of nodes.turn.children) {
	const key = button.dataset.key
	button.addEventListener('pointerdown', event => {
		event.preventDefault()
		button.setPointerCapture(event.pointerId)
		button.classList.add('active')
		state.keys.add(key)
	})
	for (const type of ['pointerup', 'pointercancel']) {
		button.addEventListener(type, () => {
			button.classList.remove('active')
			state.keys.delete(key)
		})
	}
}
// iOS Safari can still start a pinch-zoom when a second finger lands outside the controls, such as on the footer,
// while a thumb holds the stick, Shoot or a turn button. Only block it while a control is held, so the page can
// still be zoomed the rest of the time.
document.addEventListener('gesturestart', event => {
	const isHoldingControl = stickPointerId !== undefined || state.chargeSource === 'pointer' || nodes.turn.querySelector('.active') !== null
	if (isHoldingControl) event.preventDefault()
})
addEventListener('blur', cancelInput)
// Switching apps on a phone can land a stray touch on the court, which reads as aiming at that spot and stops the
// player facing the rim. Coming back starts from facing the rim again.
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) return
	cancelInput()
	state.pointer = undefined
	updateAim()
})

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
// A click on the dimmed page around the dialog closes it. Such clicks land on the dialog element itself, outside its box.
nodes.help.addEventListener('click', event => {
	if (event.target !== nodes.help) return
	const box = nodes.help.getBoundingClientRect()
	const isOutside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
	if (isOutside) closeHelp()
})

const MUSIC_VOLUME = 0.135
const SOUND_MODES = { all: 'On', effects: 'Effects only', off: 'Off' }
const SOUND_MODE_KEY = 'iso-hoops:sound-mode'
let soundMode = 'all'
try {
	const saved = localStorage.getItem(SOUND_MODE_KEY)
	if (saved in SOUND_MODES) soundMode = saved
} catch {}

const MUSIC_KEY = 'iso-hoops:music'
let musicChoice = { picks: {}, everywhere: null }
try {
	const saved = JSON.parse(localStorage.getItem(MUSIC_KEY))
	const known = id => TRACKS.some(track => track.id === id)
	if (saved) musicChoice = {
		picks: Object.fromEntries(Object.entries(saved.picks ?? {}).filter(([court, track]) => court in COURTS && known(track))),
		everywhere: known(saved.everywhere) ? saved.everywhere : null,
	}
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
	const trackId = trackFor(courtId, musicChoice)
	if (music?.trackId === trackId) return
	const now = audio.currentTime
	if (music) {
		const { source, gain } = music
		gain.gain.setTargetAtTime(0, now, 0.25)
		source.stop(now + 1.5)
		source.onended = () => { source.disconnect(); gain.disconnect() }
	}
	const source = audio.createBufferSource()
	source.buffer = musicBuffers[trackId] ??= createMusicBuffer(audio, trackId)
	source.loop = true
	const gain = audio.createGain()
	gain.gain.setValueAtTime(music ? 0 : 1, now)
	gain.gain.setTargetAtTime(1, now, 0.25)
	source.connect(gain).connect(musicGain)
	source.start(now)
	music = { trackId, source, gain }
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
		// The rim snapping back up when a dunker lets go.
		spring: [330, 190, 0.16, 0.035, 'triangle'],
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

function playDunkSound(weight) {
	if (!audio || soundMode === 'off' || audio.state !== 'running') return
	playSlam(audio, effectsBus, { pitch: court.sound.pitch, weight })
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
// A press on the court that only closes an open menu stops there, so the tap and any drag that follows don't also aim.
let dismissingPointer
for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
	addEventListener(type, event => {
		if (event.pointerId !== dismissingPointer) return
		event.stopPropagation()
		if (type !== 'pointermove') dismissingPointer = undefined
	}, { capture: true })
}

// A button that opens a panel beside it; a press outside closes it.
function setupPopover(button, panel) {
	function setOpen(open) {
		panel.hidden = !open
		button.setAttribute('aria-expanded', String(open))
	}
	button.addEventListener('click', () => {
		setOpen(panel.hidden)
		if (!panel.hidden) panel.querySelector(':checked, button:not([hidden])').focus()
	})
	addEventListener('pointerdown', event => {
		if (panel.hidden || button.parentElement.contains(event.target)) return
		setOpen(false)
		if (event.target !== canvas) return
		event.stopPropagation()
		dismissingPointer = event.pointerId
	}, { capture: true })
	return setOpen
}

// A menu is a button that opens a list of radio options.
function setupMenu(button, options, onPick) {
	const setOpen = setupPopover(button, options)
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
}
function checkOption(options, value) {
	for (const radio of options.querySelectorAll('input')) radio.checked = radio.value === value
}

// A mouse click on these leaves focus on the court, so Space still shoots instead of pressing them again.
for (const button of [nodes['session-open'], nodes['session-reset']]) button.addEventListener('mousedown', event => event.preventDefault())
nodes['session-open'].addEventListener('click', () => setSessionOpen(nodes['session-panel'].hidden))
nodes['session-reset'].addEventListener('click', () => {
	state.session = []
	state.attempts = 0
	state.makes = 0
	state.streak = 0
	updateStats()
	renderSession()
})
// A press outside closes the session court, and one on the court only closes it, like the header menus.
addEventListener('pointerdown', event => {
	const panel = nodes['session-panel']
	if (panel.hidden || panel.contains(event.target) || nodes['session-open'].contains(event.target)) return
	setSessionOpen(false)
	if (event.target !== canvas) return
	event.stopPropagation()
	dismissingPointer = event.pointerId
}, { capture: true })

// Sound and music share one header panel. Unlike the footer menus it stays open while the player changes things.
const setAudioOpen = setupPopover(nodes.sound, nodes['audio-options'])
nodes['audio-options'].addEventListener('keydown', event => {
	if (event.key !== 'Escape') return
	setAudioOpen(false)
	nodes.sound.focus()
})
nodes['track-dots'].append(...TRACKS.map(() => document.createElement('span')))

function showSoundMode() {
	nodes.sound.dataset.sound = soundMode
	nodes['audio-options'].dataset.sound = soundMode
	checkOption(nodes['sound-options'], soundMode)
	showMusic()
}
nodes['sound-options'].addEventListener('change', event => {
	soundMode = event.target.value
	showSoundMode()
	try { localStorage.setItem(SOUND_MODE_KEY, soundMode) } catch {}
	ensureAudio()
	if (!audio) return
	masterGain.gain.setTargetAtTime(soundMode === 'off' ? 0 : 1, audio.currentTime, 0.025)
	musicGain.gain.setTargetAtTime(soundMode === 'all' ? MUSIC_VOLUME : 0, audio.currentTime, 0.025)
})

function showMusic() {
	const trackId = trackFor(courtId, musicChoice)
	const index = TRACKS.findIndex(track => track.id === trackId)
	const track = TRACKS[index]
	const playing = soundMode === 'all'
	nodes['sound-label'].textContent = playing ? `${SOUND_MODES[soundMode]}, ${track.name}` : SOUND_MODES[soundMode]
	nodes['now-playing-label'].textContent = playing ? 'NOW PLAYING' : 'MUSIC · PAUSED'
	nodes['track-name'].textContent = track.name
	nodes['track-note'].textContent = !playing ? 'Plays when sound is On'
		: musicChoice.everywhere ? `On every court · ${track.bpm} bpm`
		: trackId === courtId ? `${court.name}'s own · ${track.bpm} bpm`
		: `Picked for ${court.name} · ${track.bpm} bpm`
	nodes['track-dots'].querySelectorAll('span').forEach((dot, i) => dot.classList.toggle('current', i === index))
	nodes['track-own'].hidden = !musicChoice.everywhere && !(courtId in musicChoice.picks)
	nodes['track-own-label'].textContent = musicChoice.everywhere ? "Use each court's own" : `Use ${court.name}'s own`
	nodes['track-everywhere'].checked = Boolean(musicChoice.everywhere)
}
function chooseMusic(choice) {
	musicChoice = choice
	try { localStorage.setItem(MUSIC_KEY, JSON.stringify(musicChoice)) } catch {}
	showMusic()
	if (audio) playCourtSound()
}
function stepTrack(step) {
	const index = TRACKS.findIndex(track => track.id === trackFor(courtId, musicChoice))
	const next = TRACKS[(index + step + TRACKS.length) % TRACKS.length]
	chooseMusic(pickTrack(musicChoice, courtId, next.id))
}
nodes['track-prev'].addEventListener('click', () => stepTrack(-1))
nodes['track-next'].addEventListener('click', () => stepTrack(1))
nodes['track-own'].addEventListener('click', () => {
	chooseMusic(musicChoice.everywhere ? { picks: {}, everywhere: null } : pickTrack(musicChoice, courtId, courtId))
	nodes['track-next'].focus()
})
nodes['track-everywhere'].addEventListener('change', event => {
	chooseMusic({ ...musicChoice, everywhere: event.target.checked ? trackFor(courtId, musicChoice) : null })
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
	showMusic()
	try { localStorage.setItem(COURT_KEY, courtId) } catch {}
	applyPhase()
	if (audio) playCourtSound()
})
showCourt()

// The court's phase: the one the player pinned, or the one their clock is in.
const TIME_KEY = 'iso-hoops:time'
// Today's phase start times, kept so index.html can paint the right sky on the next load before game.js arrives.
const SKY_KEY = 'iso-hoops:sky'
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const PLACE = placeFor(TIME_ZONE)
const minuteOf = date => date.getHours() * 60 + date.getMinutes()
let timeChoice = 'auto'
try {
	const saved = localStorage.getItem(TIME_KEY)
	if (saved === 'auto' || saved in PHASES) timeChoice = saved
} catch {}
let phaseId
let phase
function applyPhase() {
	const now = new Date()
	const schedule = scheduleFor(now, PLACE)
	try { localStorage.setItem(SKY_KEY, JSON.stringify({ date: now.toDateString(), starts: PHASE_IDS.map(id => schedule[id]) })) } catch {}
	phaseId = resolvePhase(timeChoice, minuteOf(now), schedule)
	phase = PHASES[phaseId]
	court = { ...COURTS[courtId], ...(phase.daylight && COURTS[courtId].daylight) }
	setShadowDirection(phase.shadow.x, phase.shadow.y)
	document.body.dataset.phase = phaseId
	const auto = timeChoice === 'auto'
	nodes['time-label'].textContent = auto ? `Auto · ${phase.name}` : phase.name
	nodes.time.classList.toggle('pinned', !auto)
	nodes['time-tip-name'].textContent = phase.name.toUpperCase()
	nodes['time-tip-hours'].textContent = hoursOf(phaseId, schedule)
	for (const slot of nodes['time-options'].querySelectorAll('[data-hours]')) slot.textContent = hoursOf(slot.dataset.hours, schedule)
	nodes['time-zone'].textContent = nodes['time-tip-zone'].textContent = zoneLabel(TIME_ZONE, now.getTimezoneOffset())
	nodes['time-tip-mode'].textContent = auto ? 'Auto · follows your clock' : 'Pinned · click to change'
	checkOption(nodes['time-options'], timeChoice)
	bakeCourt()
}
setupMenu(nodes.time, nodes['time-options'], choice => {
	timeChoice = choice
	try { localStorage.setItem(TIME_KEY, timeChoice) } catch {}
	applyPhase()
})
// On Auto the court moves into the next phase while someone plays through the boundary.
setInterval(() => {
	const now = new Date()
	if (timeChoice === 'auto' && resolvePhase('auto', minuteOf(now), scheduleFor(now, PLACE)) !== phaseId) applyPhase()
}, 60_000)

const ATTEMPT_LABELS = { free: 'SHOTS', 'free-throws': 'SHOTS LEFT', clock: 'SECONDS', horse: 'LETTERS', 'three-point': 'SECONDS' }
const MODE_INTROS = {
	free: 'Find your spot. Take your time.',
	'free-throws': 'Ten free throws. Release inside the band.',
	clock: '60 seconds. 2 a basket, 3 beyond the arc.',
	horse: 'Make the shot from the ring.',
	'three-point': `27 balls in 60 seconds. ${PICK_HINT}, then shoot to start.`,
}

function applyMode() {
	setSessionOpen(false)
	const freeThrows = state.mode === 'free-throws'
	const clock = state.mode === 'clock'
	const contest = state.mode === 'three-point'
	const isFixed = freeThrows || contest
	const hasGoal = state.mode !== 'free'
	nodes['mode-label'].textContent = MODES[state.mode]
	canvas.setAttribute('aria-label', CANVAS_LABELS[state.mode])
	checkOption(nodes['mode-options'], state.mode)
	nodes['power-target'].hidden = !isFixed
	nodes.stick.classList.toggle('locked', isFixed)
	nodes.turn.classList.toggle('locked', isFixed)
	nodes['label-makes'].textContent = clock || contest ? 'POINTS' : 'MADE'
	nodes['label-attempts'].textContent = ATTEMPT_LABELS[state.mode]
	// Goal modes show their best score in the third slot, so the longest basket is free shooting's alone.
	nodes['label-accuracy'].textContent = hasGoal ? 'BEST' : 'ACCURACY'
	document.body.dataset.mode = state.mode
	nodes.attempts.classList.remove('hurry')
	if (freeThrows) {
		state.round = startRound(state.round.best)
		placeForRound()
	}
	if (clock) state.clock = startClockRound(state.clock.best)
	document.body.dataset.opponent = cpuSetup.opponent
	state.duel = null
	state.coin = null
	nodes['coin-call'].hidden = true
	nodes.coin.hidden = true
	if (state.mode === 'horse') state.horse = startHorse(state.horse.best)
	startLog()
	if (isDuel()) startNewDuel()
	state.flying = []
	state.reloadAt = undefined
	if (contest) {
		state.contest = startContest(state.contest.best, state.contest.moneyRack)
		placeForStation()
	}
	updateStats()
}
setupMenu(nodes.mode, nodes['mode-options'], mode => {
	state.mode = mode
	try { localStorage.setItem(MODE_KEY, mode) } catch {}
	cancelInput()
	returnBall()
	applyMode()
	if (!isDuel()) setFeedback(MODE_INTROS[mode])
})

// The Opponent menu shows in HORSE only. It stays open while you change things, like the sound panel.
for (const side of ['heads', 'tails']) {
	const button = nodes[`call-${side}`]
	paintCoin(button.querySelector('canvas'), side)
	button.addEventListener('click', () => callCoin(side))
}

const setOpponentOpen = setupPopover(nodes.opponent, nodes['opponent-options'])
// Play, or Enter anywhere in the menu, closes it and starts: against the CPU that brings up the coin flip.
function playFromMenu() {
	setOpponentOpen(false)
	canvas.focus({ preventScroll: true })
}
nodes['opponent-play'].addEventListener('click', playFromMenu)
nodes.opponent.addEventListener('click', () => showOpponent())
nodes['opponent-options'].addEventListener('keydown', event => {
	if (event.key === 'Enter') {
		event.preventDefault()
		return playFromMenu()
	}
	if (event.key !== 'Escape') return
	setOpponentOpen(false)
	nodes.opponent.focus()
})
for (const character of CHARACTERS) {
	const option = el('label', 'cpu-character')
	const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'cpu-character', value: character.id })
	radio.setAttribute('aria-label', `${character.name}, ${character.hair.toLowerCase()}`)
	const portrait = el('canvas')
	portrait.setAttribute('aria-hidden', 'true')
	drawPortrait(portrait, character)
	option.append(radio, portrait)
	nodes['cpu-characters'].append(option)
}

function showRecord() {
	for (const slot of nodes['opponent-options'].querySelectorAll('[data-record]')) {
		const { won, lost } = cpuRecord[slot.dataset.record]
		slot.textContent = `${won}–${lost}`
	}
}

function showOpponent() {
	const character = cpuCharacter()
	nodes['opponent-label'].textContent = cpuSetup.opponent === 'cpu' ? `vs ${character.name} · ${LEVEL_NAMES[cpuSetup.level]}` : 'Solo'
	nodes['opponent-play-label'].textContent = cpuSetup.opponent === 'cpu' ? `Play vs ${character.name} · ${LEVEL_NAMES[cpuSetup.level]}` : 'Play HORSE'
	// A rematch already in progress keeps going, so only a fresh game promises the coin flip.
	nodes['opponent-play-detail'].hidden = cpuSetup.opponent !== 'cpu' || state.coin?.phase !== 'call'
	nodes['opponent-options'].dataset.opponent = cpuSetup.opponent
	checkOption(nodes['opponent-options'].querySelector('.opponent-switch'), cpuSetup.opponent)
	checkOption(nodes['opponent-options'].querySelector('.level-switch'), cpuSetup.level)
	checkOption(nodes['cpu-characters'], character.id)
	nodes['cpu-character-name'].textContent = `${character.name} · ${character.hair}`
	showRecord()
}

function applyOpponentChange(name, value) {
	const save = (key, saved) => { try { localStorage.setItem(key, saved) } catch {} }
	if (name === 'opponent') {
		cpuSetup.opponent = value
		save(OPPONENT_KEY, value)
	} else if (name === 'cpu-level') {
		cpuSetup.level = value
		save(CPU_LEVEL_KEY, value)
	} else if (name === 'cpu-character') {
		cpuSetup.character = value
		save(CPU_CHARACTER_KEY, value)
	}
	showOpponent()
	// A new opponent or level is a new game; a new character only changes who you play.
	if (name === 'opponent' || name === 'cpu-level') {
		cancelInput()
		returnBall()
		applyMode()
		showOpponent()
		if (!isDuel()) setFeedback(MODE_INTROS.horse)
	} else {
		updateStats()
	}
}

// A new opponent or level throws away a game under way, so that asks first. A new character only redraws the CPU.
const gameInProgress = () => isDuel() && state.duel && !state.duel.winner && state.log.length > 0
let pendingSwitch
nodes['opponent-options'].addEventListener('change', event => {
	const { name, value } = event.target
	if ((name === 'opponent' || name === 'cpu-level') && gameInProgress()) {
		// The radios go back to the current choice until you confirm.
		showOpponent()
		return askToSwitch(name, value)
	}
	applyOpponentChange(name, value)
})

function askToSwitch(name, value) {
	pendingSwitch = { name, value }
	const cpu = cpuName()
	const toSolo = name === 'opponent' && value === 'solo'
	const target = toSolo ? 'Solo' : LEVEL_NAMES[value]
	nodes['warn-versus'].textContent = `VS ${cpu.toUpperCase()} · ${LEVEL_NAMES[cpuSetup.level].toUpperCase()}`
	nodes['warn-body'].textContent = toSolo
		? `Switching to Solo ends this game against ${cpu}. It won’t count toward your record.`
		: `Switching to ${target} starts a new game against ${cpu}. This one won’t count toward your record.`
	const letters = count => LETTERS.map((letter, i) => `<span class="letter${i < count ? ' earned' : ''}">${letter}</span>`).join('')
	nodes['warn-you'].innerHTML = letters(state.duel.letters.you)
	nodes['warn-cpu'].innerHTML = letters(state.duel.letters.cpu)
	nodes['warn-cpu-name'].textContent = cpu.toUpperCase()
	nodes['warn-confirm-label'].textContent = toSolo ? 'End game, play Solo' : `New game on ${target}`
	nodes['switch-warn'].hidden = false
	nodes['warn-confirm'].focus()
}

function closeSwitchWarning() {
	nodes['switch-warn'].hidden = true
	pendingSwitch = undefined
}

nodes['warn-keep'].addEventListener('click', () => {
	closeSwitchWarning()
	nodes['opponent-options'].querySelector('.level-switch :checked')?.focus()
})
nodes['warn-confirm'].addEventListener('click', () => {
	const { name, value } = pendingSwitch
	closeSwitchWarning()
	applyOpponentChange(name, value)
	playFromMenu()
})
nodes['switch-warn'].addEventListener('keydown', event => {
	if (event.key !== 'Escape') return
	event.preventDefault()
	nodes['warn-keep'].click()
})

applyMode()
showOpponent()
// The page's default line is free shooting's, so a saved goal mode explains itself on load.
if (state.mode !== 'free' && !isDuel()) setFeedback(MODE_INTROS[state.mode])
// Keep the placeholders (header buttons, footer menus, scoreboard and helper line) up for at least 300ms after navigation, so a fast load doesn't flash them.
setTimeout(() => {
	for (const node of document.querySelectorAll('.header-actions, .settings, .session-stats, .shoot-panel')) node.classList.add('ready')
}, Math.max(0, 300 - performance.now()))

// Try immediately where autoplay is allowed; the first gesture unlocks other browsers.
ensureAudio()

addEventListener('resize', resizeCanvas)
addEventListener('pageshow', resizeCanvas)
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) resizeCanvas()
})
resizeCanvas()
applyPhase()
updateStats()
let lastFrame = performance.now()
function frame(now) {
	update(Math.min(0.04, (now - lastFrame) / 1000))
	lastFrame = now
	draw()
	requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
