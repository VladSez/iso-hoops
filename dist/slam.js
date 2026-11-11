// The dunk's sound, built from what you hear at a real one: the slap of hands and ball on steel, the thump through the
// pole, the rim ringing, the breakaway spring knocking its stop, and an arena's long reverb behind it all.
// `weight` is how far the rim bends (0.06 for a flush, 0.2 for a long hang), so heavier dunks hit harder.

// A rim rings with many inharmonic modes, each split into two close frequencies that beat against each other.
const RIM_MODES = [[312, 1, 0.9], [781, 0.75, 0.62], [1290, 0.6, 0.46], [1866, 0.45, 0.36], [2490, 0.33, 0.28], [3170, 0.24, 0.21], [3890, 0.16, 0.15], [4720, 0.1, 0.11]]
const BEAT = 1.0025
const SPRING_KNOCKS = [0.05, 0.095]
const HALL_SECONDS = 2.2
const HALL_WET = 0.6
// Keeps the whole slam about twice as loud as the swish, with peaks well under clipping.
const LEVEL = 0.35

const halls = new WeakMap()

export function playSlam(audio, out, { pitch = 1, weight = 0.14, when = audio.currentTime } = {}) {
	const loud = 0.6 + weight * 3
	const level = audio.createGain()
	level.gain.value = LEVEL
	level.connect(out)
	const send = audio.createGain()
	send.gain.value = HALL_WET
	level.connect(send).connect(hallFor(audio, out))

	slap(audio, level, when, 0.55 * loud)
	thump(audio, level, when, pitch, 0.42 * loud)
	ring(audio, level, when, pitch, 0.045 * loud, 1, RIM_MODES.length)
	SPRING_KNOCKS.forEach((t, i) => {
		const fade = 0.045 * loud * 0.7 ** i
		slap(audio, level, when + t, fade * 7)
		ring(audio, level, when + t, pitch * 1.03, fade * 0.3, 0.18, 6)
	})
	const end = when + HALL_SECONDS + 0.1
	setTimeout(() => { level.disconnect(); send.disconnect() }, (end - audio.currentTime) * 1000)
	return end
}

// Decaying noise as the hall's impulse response, made once per audio context.
function hallFor(audio, out) {
	let hall = halls.get(audio)
	if (hall) return hall
	const length = Math.ceil(audio.sampleRate * HALL_SECONDS)
	const response = audio.createBuffer(2, length, audio.sampleRate)
	for (let channel = 0; channel < 2; channel++) {
		const samples = response.getChannelData(channel)
		for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
	}
	hall = audio.createConvolver()
	hall.buffer = response
	hall.connect(out)
	halls.set(audio, hall)
	return hall
}

function envelope(audio, when, peak, attack, length) {
	const gain = audio.createGain()
	gain.gain.setValueAtTime(0.0001, when)
	gain.gain.exponentialRampToValueAtTime(peak, when + attack)
	gain.gain.exponentialRampToValueAtTime(0.0001, when + length)
	return gain
}

function slap(audio, out, when, peak) {
	const length = 0.03
	const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * length), audio.sampleRate)
	const samples = buffer.getChannelData(0)
	for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
	const source = audio.createBufferSource()
	source.buffer = buffer
	const high = audio.createBiquadFilter()
	high.type = 'highpass'
	high.frequency.value = 700
	const bright = audio.createBiquadFilter()
	bright.type = 'peaking'
	bright.frequency.value = 2400
	bright.gain.value = 6
	source.connect(high).connect(bright).connect(envelope(audio, when, peak, 0.001, length)).connect(out)
	source.start(when)
}

function thump(audio, out, when, pitch, peak) {
	const length = 0.26
	const osc = audio.createOscillator()
	osc.frequency.setValueAtTime(120 * pitch, when)
	osc.frequency.exponentialRampToValueAtTime(48 * pitch, when + length)
	osc.connect(envelope(audio, when, peak, 0.004, length)).connect(out)
	osc.start(when)
	osc.stop(when + length + 0.02)
}

function ring(audio, out, when, pitch, peak, length, modes) {
	for (const [frequency, amplitude, decay] of RIM_MODES.slice(0, modes)) {
		for (const detune of [1, BEAT]) {
			const osc = audio.createOscillator()
			osc.frequency.value = frequency * pitch * detune
			osc.connect(envelope(audio, when, peak * amplitude / 2, 0.002, decay * length)).connect(out)
			osc.start(when)
			osc.stop(when + decay * length + 0.02)
		}
	}
}
