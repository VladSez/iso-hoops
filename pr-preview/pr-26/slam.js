// The dunk's sound: hands and ball thumping onto the rim, then the steel ringing and wobbling as it bends and springs back.
// `weight` is how far the rim bends (0.06 for a flush, 0.2 for a long hang), so heavier dunks ring louder.
const PARTIALS = [[523, 0.05, 0.75], [851, 0.034, 0.55], [1393, 0.02, 0.38]]
// The rim's spring in dunks.js oscillates at 30 rad/s; the ring wobbles with it.
const WOBBLE_HZ = 30 / (2 * Math.PI)

export function playSlam(audio, out, { pitch = 1, weight = 0.14, when = audio.currentTime } = {}) {
	const loud = 0.6 + weight * 3
	const created = []
	const keep = node => (created.push(node), node)

	const thudLength = 0.16
	const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * thudLength), audio.sampleRate)
	const samples = buffer.getChannelData(0)
	for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
	const noise = keep(audio.createBufferSource())
	noise.buffer = buffer
	const low = keep(audio.createBiquadFilter())
	low.type = 'lowpass'
	low.frequency.setValueAtTime(900 * pitch, when)
	low.frequency.exponentialRampToValueAtTime(140 * pitch, when + thudLength)
	const thud = keep(audio.createGain())
	thud.gain.setValueAtTime(0.0001, when)
	thud.gain.exponentialRampToValueAtTime(0.3 * loud, when + 0.006)
	thud.gain.exponentialRampToValueAtTime(0.0001, when + thudLength)
	noise.connect(low).connect(thud).connect(out)
	noise.start(when)

	const tremolo = keep(audio.createGain())
	tremolo.gain.value = 0.65
	const wobble = keep(audio.createOscillator())
	wobble.frequency.value = WOBBLE_HZ
	const depth = keep(audio.createGain())
	depth.gain.value = 0.35
	wobble.connect(depth).connect(tremolo.gain)
	tremolo.connect(out)
	let end = when + thudLength
	for (const [frequency, volume, length] of PARTIALS) {
		const tone = keep(audio.createOscillator())
		tone.type = 'triangle'
		tone.frequency.setValueAtTime(frequency * pitch, when)
		tone.frequency.exponentialRampToValueAtTime(frequency * pitch * 0.97, when + length)
		const gain = keep(audio.createGain())
		gain.gain.setValueAtTime(0.0001, when)
		gain.gain.exponentialRampToValueAtTime(volume * loud, when + 0.01)
		gain.gain.exponentialRampToValueAtTime(0.0001, when + length)
		tone.connect(gain).connect(tremolo)
		tone.start(when)
		tone.stop(when + length + 0.02)
		end = Math.max(end, when + length + 0.02)
	}
	wobble.start(when)
	wobble.stop(end)
	wobble.onended = () => { for (const node of created) node.disconnect() }
	return end
}
