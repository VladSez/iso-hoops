import { HOOP, BALL_RADIUS, GRAVITY, BACKBOARD_X, createShot, stepBall } from './physics.js'

// The renderer's camera, rasterizer, figures and vegetation come from Pixel Plays.
const COURT = { x: 9, y: 7 }
const PALETTE = {
	shirt: [194, 80, 46], stripe: [194, 80, 46], legs: [46, 56, 65],
	skin: [192, 133, 91], hair: [43, 33, 29],
}
const BALL_COLOR = [210, 111, 43]
const BALL_SEAM = [99, 56, 31]
const STEEL = [86, 99, 94]
const LINE = [235, 225, 196]
const NET_COLOR = [255, 250, 230]
const nodes = Object.fromEntries([
	'makes', 'attempts', 'accuracy', 'feedback', 'power-value', 'power-fill',
	'power-meter', 'shoot', 'shoot-label', 'help', 'help-open', 'help-close', 'help-play', 'sound', 'stage', 'basket-callout',
].map(id => [id, document.getElementById(id)]))

const state = {
	player: { x: 3.5, y: 0 }, yaw: Math.PI, pointer: undefined,
	keys: new Set(), phase: 'ready', chargeSource: undefined, power: 0,
	ball: undefined, returnTime: undefined, time: 0, followThrough: 0,
	attempts: 0, makes: 0, streak: 0, lastPower: 0, paused: false,
	feedbackTime: 0, walking: false, scoredAt: undefined,
}

function groundColor(x, y, ix, iy, index) {
	const edge = Math.pow((Math.abs(x) / 12.9) ** 6 + (Math.abs(y) / 10.9) ** 6, 1 / 6)
	const rough = edge + (noise(x * 1.3, y * 1.3) - 0.5) * 0.1
	if (rough > 1.04 || (rough > 0.91 && hash(ix, iy) < (rough - 0.91) / 0.13)) return 0
	const grain = (hash(ix, iy) - 0.5) * 9 + (noise(x * 1.2, y * 1.2) - 0.5) * 6
	if (Math.abs(x) <= COURT.x && Math.abs(y) <= COURT.y) {
		kinds[index] = 1
		const inKey = x < -2.8 && Math.abs(y) < 2.55
		let color = inKey ? [177, 125, 96] : [126, 153, 141]
		const nearBoundary = Math.abs(Math.abs(x) - 8.7) < 0.07 && Math.abs(y) < 6.75 || Math.abs(Math.abs(y) - 6.7) < 0.07 && Math.abs(x) < 8.75
		const keyBoundary = Math.abs(x + 2.8) < 0.07 && Math.abs(y) < 2.6 || Math.abs(Math.abs(y) - 2.55) < 0.07 && x < -2.75 && x > -8.7
		const freeThrow = Math.abs(Math.hypot(x + 2.8, y) - 2.1) < 0.07 && (x >= -2.8 || hash(Math.floor(x * 3), Math.floor(y * 3)) > 0.4)
		const threePoint = Math.abs(Math.hypot(x - HOOP.x, y) - 6.7) < 0.07 && x > HOOP.x
		const corner = x <= HOOP.x && Math.abs(Math.abs(y) - 6.7) < 0.07
		const center = Math.abs(Math.hypot(x - 8.7, y) - 2.15) < 0.07
		if (nearBoundary || keyBoundary || freeThrow || threePoint || corner || center) color = LINE
		const faded = hash(ix * 7, iy * 9) < 0.018
		const shade = grain - (faded ? 16 : 0)
		return rgb(color[0] + shade, color[1] + shade, color[2] + shade)
	}
	if (Math.abs(x) < 9.8 && Math.abs(y) < 8.3 || y < -7.4 && y > -9.2 && Math.abs(x) < 11) {
		kinds[index] = 2
		const seam = Math.abs((x + 25) % 2.5) < 0.04 || Math.abs((y + 25) % 2.5) < 0.04
		return rgb(174 + grain - (seam ? 14 : 0), 170 + grain - (seam ? 14 : 0), 150 + grain - (seam ? 14 : 0))
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

function bakeCourt() {
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
	// A bench, a bottle and a pair of trees frame the court without covering play.
	const wood = [151, 113, 69]
	box(0, -9.45, 0.68, 4.2, -8.8, 0.83, wood)
	box(0, -9.5, 1, 4.2, -9.35, 1.65, wood)
	for (const x of [0.3, 3.7]) box(x, -9.35, 0, x + 0.13, -8.85, 0.7, STEEL)
	line3D([3.45, -9.1, 0.84], [3.45, -9.1, 1.3], 0.12, [80, 121, 135])
	box(5.1, -9.6, 0, 5.9, -8.8, 0.9, [108, 125, 101])
	box(5.05, -9.65, 0.9, 5.95, -8.75, 1, STEEL)
	growTree(-7.7, -9.75, 0.95, 380, 0)
	growTree(9.8, 5.5, 0.66, 220, 1000)
	for (let x = 0; x < 4.2; x += 0.2) castShadow(x, -9.1, 0.9, 0.4)
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
	nodes.makes.textContent = String(state.makes).padStart(2, '0')
	nodes.attempts.textContent = String(state.attempts).padStart(2, '0')
	nodes.accuracy.textContent = state.attempts ? `${Math.round(state.makes / state.attempts * 100)}%` : '—'
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

function beginCharge(source) {
	if (state.phase !== 'ready' || state.paused || nodes.help.open) return
	state.phase = 'charging'
	state.chargeSource = source
	state.power = 0
	ensureAudio()
}

function releaseShot(source) {
	if (state.phase !== 'charging' || source !== state.chargeSource) return
	state.lastPower = state.power
	state.ball = createShot(state.player, state.yaw, state.power)
	state.returnTime = undefined
	state.phase = 'flight'
	state.chargeSource = undefined
	state.followThrough = 0.65
	state.attempts++
	setFeedback('Let it fly.')
	updateStats()
	playSound('shoot')
}

function cancelInput() {
	state.keys.clear()
	if (state.phase === 'charging') state.phase = 'ready'
	state.chargeSource = undefined
	state.power = 0
	updateMeter()
}

function returnBall() {
	state.ball = undefined
	state.phase = 'ready'
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
	if (!state.pointer) return
	const dx = state.pointer.x - state.player.x
	const dy = state.pointer.y - state.player.y
	if (Math.hypot(dx, dy) > 0.3) state.yaw = Math.atan2(dy, dx)
}

function update(delta) {
	if (state.paused || nodes.help.open) return
	state.time += delta
	state.followThrough = Math.max(0, state.followThrough - delta)
	const keys = state.keys
	let screenX = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
	let screenY = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
	const length = Math.hypot(screenX, screenY)
	state.walking = length > 0
	if (length) {
		screenX /= length
		screenY /= length
		state.player.x = clamp(state.player.x + (screenX + screenY) / R2 * 4.4 * delta, -8.25, 8.3)
		state.player.y = clamp(state.player.y + (screenY - screenX) / R2 * 4.4 * delta, -6.3, 6.3)
		updateAim()
	}
	const turn = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))
	if (turn) {
		state.pointer = undefined
		state.yaw += turn * 1.4 * delta
	}
	if (state.phase === 'charging') state.power = Math.min(1, state.power + delta / 1.6)
	if (state.ball) {
		const events = stepBall(state.ball, delta)
		for (const event of events) {
			playSound(event)
			if (event === 'score') {
				state.makes++
				state.streak++
				state.scoredAt = state.time
				nodes['basket-callout'].hidden = false
				nodes['basket-callout'].classList.add('celebrate')
				nodes.makes.closest('.session-stats').classList.add('scored')
				setFeedback(state.streak > 1 ? `Basket! ${state.streak} in a row.` : 'Basket! Nice shot.', true)
				state.returnTime = state.time + 1.5
				updateStats()
			}
		}
		if (!state.ball.made && (state.ball.bounces > 0 || state.ball.age > 3.6) && state.returnTime === undefined) {
			state.streak = 0
			state.returnTime = state.time + 1.1
			setFeedback('Another one. The court isn’t going anywhere.')
		}
		if (state.returnTime !== undefined && state.time >= state.returnTime) returnBall()
	}
	if (state.scoredAt !== undefined && state.time - state.scoredAt >= 1.8) {
		nodes['basket-callout'].hidden = true
		nodes['basket-callout'].classList.remove('celebrate')
		nodes.makes.closest('.session-stats').classList.remove('scored')
		state.scoredAt = undefined
	}
	if (state.phase === 'ready' && state.time - state.feedbackTime > 7) {
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
	if (state.phase === 'flight') return
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
	drawDots(arc, rgb(174, 115, 72))
}

function draw() {
	pix.set(bakedPix)
	zb.set(bakedZ)
	pendingShadows.length = 0
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
		const dribble = charging ? 2.5 : 0.38 + Math.abs(Math.sin(state.time * 4.5)) * 0.85
		drawBasketball(state.player.x + Math.cos(state.yaw) * 0.55, state.player.y + Math.sin(state.yaw) * 0.55, dribble, state.time)
	}
	const windTime = STILL ? 0 : Math.floor(state.time * WIND_FPS) / WIND_FPS
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
canvas.addEventListener('pointerdown', event => {
	canvas.focus({ preventScroll: true })
	aimAtPointer(event)
	if (event.pointerType === 'touch') canvas.setPointerCapture(event.pointerId)
})
nodes.shoot.addEventListener('pointerdown', event => {
	if (event.button !== 0) return
	event.preventDefault()
	nodes.shoot.setPointerCapture(event.pointerId)
	beginCharge('pointer')
})
nodes.shoot.addEventListener('pointerup', () => releaseShot('pointer'))
nodes.shoot.addEventListener('pointercancel', cancelInput)
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

let audio
let soundEnabled = false
function ensureAudio() {
	if (!soundEnabled) return
	const AudioContext = window.AudioContext || window.webkitAudioContext
	if (!audio && AudioContext) audio = new AudioContext()
	if (audio?.state === 'suspended') audio.resume()
}
function playSound(kind) {
	if (!audio || !soundEnabled) return
	if (kind === 'score') playSwish()
	const sounds = {
		shoot: [280, 170, 0.08, 0.025, 'triangle'],
		bounce: [150, 55, 0.11, 0.12, 'sine'],
		rim: [1050, 420, 0.13, 0.045, 'triangle'],
		board: [240, 110, 0.09, 0.08, 'triangle'],
		score: [540, 810, 0.2, 0.045, 'sine'],
	}
	const [from, to, duration, volume, type] = sounds[kind]
	const oscillator = audio.createOscillator()
	const gain = audio.createGain()
	const now = audio.currentTime
	oscillator.type = type
	oscillator.frequency.setValueAtTime(from, now)
	oscillator.frequency.exponentialRampToValueAtTime(to, now + duration)
	gain.gain.setValueAtTime(volume, now)
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
	oscillator.connect(gain).connect(audio.destination)
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
	filter.frequency.setValueAtTime(2200, now)
	filter.frequency.exponentialRampToValueAtTime(800, now + duration)
	filter.Q.value = 0.7
	gain.gain.setValueAtTime(0.0001, now)
	gain.gain.exponentialRampToValueAtTime(0.2, now + 0.035)
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
	source.connect(filter).connect(gain).connect(audio.destination)
	source.start(now)
	source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
}
nodes.sound.addEventListener('click', () => {
	soundEnabled = !soundEnabled
	nodes.sound.textContent = soundEnabled ? 'Sound on' : 'Sound off'
	nodes.sound.setAttribute('aria-pressed', String(soundEnabled))
	ensureAudio()
	if (soundEnabled) playSound('shoot')
})

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
