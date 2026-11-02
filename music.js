const SAMPLE_RATE = 22050
const BEAT_SECONDS = 60 / 76
const BARS = 8
const CHORDS = [
	[60, 64, 67, 71],
	[60, 64, 67, 69],
	[57, 60, 64, 67],
	[59, 62, 64, 69],
]
const BASS_NOTES = [36, 33, 29, 31]
const MELODIES = [
	[[2.5, 76], [3.5, 74]],
	[[1.5, 72], [3, 71]],
	[[2, 69], [3.5, 72]],
	[[1.5, 74], [3, 71]],
	[[2.5, 79], [3.5, 76]],
	[[1.5, 74], [3, 72]],
	[[2, 72], [3.5, 69]],
	[[1.5, 71], [3, 67]],
]

/** Renders an original, seamless 76 BPM instrumental loop without external audio assets. */
export function createMusicBuffer(audioContext) {
	const frameCount = Math.round(BARS * 4 * BEAT_SECONDS * SAMPLE_RATE)
	const buffer = audioContext.createBuffer(1, frameCount, SAMPLE_RATE)
	const samples = buffer.getChannelData(0)

	function addNote(beat, beats, midi, volume, decay) {
		const start = Math.round(beat * BEAT_SECONDS * SAMPLE_RATE)
		const duration = beats * BEAT_SECONDS
		const frequency = 440 * 2 ** ((midi - 69) / 12)
		for (let frame = 0; frame < duration * SAMPLE_RATE; frame++) {
			const time = frame / SAMPLE_RATE
			const phase = time * frequency * Math.PI * 2
			const attack = Math.min(1, time / 0.025)
			const release = Math.min(1, (duration - time) / 0.18)
			const envelope = attack * release * Math.exp(-time / decay)
			const tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.035 * Math.sin(phase * 3)
			// Wrap note tails into the opening so the loop has no abrupt cutoff.
			samples[(start + frame) % frameCount] += tone * envelope * volume
		}
	}

	for (let bar = 0; bar < BARS; bar++) {
		const beat = bar * 4
		const chord = CHORDS[bar % CHORDS.length]
		chord.forEach((note, index) => addNote(beat + index * 0.035, 4.2, note, 0.075, 1.4))
		addNote(beat, 1.8, BASS_NOTES[bar % BASS_NOTES.length], 0.1, 0.7)
		addNote(beat + 2.5, 1.2, BASS_NOTES[bar % BASS_NOTES.length] + 7, 0.05, 0.5)
		for (const [offset, note] of MELODIES[bar]) addNote(beat + offset, 1.4, note, 0.045, 0.65)
	}
	return buffer
}
