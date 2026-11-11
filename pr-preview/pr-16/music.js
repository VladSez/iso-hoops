const SAMPLE_RATE = 22050
const BARS = 8

// Each court gets its own original loop: tempo, harmony, voicing and a bed of ambience.
// `style` sets how chords are played: held pads, offbeat stabs or broken arpeggios.
const THEMES = {
	neighborhood: {
		name: 'Front stoop', bpm: 76, style: 'pad', voice: [1, 0.18, 0.035], lead: [1, 0.18, 0.035], chordDecay: 1.4,
		chords: [[60, 64, 67, 71], [60, 64, 67, 69], [57, 60, 64, 67], [59, 62, 64, 69]],
		bass: [36, 33, 29, 31],
		melodies: [
			[[2.5, 76], [3.5, 74]], [[1.5, 72], [3, 71]], [[2, 69], [3.5, 72]], [[1.5, 74], [3, 71]],
			[[2.5, 79], [3.5, 76]], [[1.5, 74], [3, 72]], [[2, 72], [3.5, 69]], [[1.5, 71], [3, 67]],
		],
	},
	// Minor lo-fi with a low city hum under it.
	rooftop: {
		name: 'City hum', bpm: 70, style: 'pad', voice: [1, 0.08, 0.02], lead: [1, 0.3, 0.06], chordDecay: 2,
		chords: [[57, 60, 64, 71], [53, 57, 60, 64], [50, 53, 57, 64], [52, 57, 59, 62]],
		bass: [33, 29, 26, 28],
		melodies: [
			[[1.5, 76], [3, 72]], [[2.5, 74], [3.5, 72]], [[1.5, 69], [3, 72]], [[2, 71], [3.5, 68]],
			[[1.5, 79], [3, 76]], [[2.5, 74], [3.5, 76]], [[1.5, 72], [3, 69]], [[2, 71], [3.5, 64]],
		],
		ambience: { kind: 'hum', volume: 0.05 },
	},
	// Bright, plucky offbeat chords over rolling waves.
	beach: {
		name: 'Boardwalk', bpm: 96, style: 'offbeat', voice: [1, 0.4, 0.2, 0.08], lead: [1, 0.25, 0.1], chordDecay: 0.14,
		chords: [[53, 57, 60, 65], [53, 57, 62, 65], [53, 58, 62, 65], [55, 60, 64, 67]],
		bass: [29, 26, 34, 36],
		melodies: [
			[[0, 77], [1.5, 79], [3, 81]], [[1, 79], [2.5, 77]], [[0, 74], [1.5, 77], [3, 79]], [[1, 76], [2.5, 72]],
			[[0, 81], [1.5, 84], [3, 81]], [[1, 79], [2.5, 77]], [[0, 74], [1.5, 72], [3, 74]], [[1, 76], [2.5, 77]],
		],
		ambience: { kind: 'waves', volume: 0.09 },
	},
	// Warm broken chords in D dorian with leaves rustling in the wind.
	autumn: {
		name: 'Leaf fall', bpm: 72, style: 'arpeggio', voice: [1, 0.3, 0.1], lead: [1, 0.2, 0.05], chordDecay: 0.9,
		chords: [[50, 53, 57, 60], [55, 59, 62, 65], [58, 62, 65, 69], [57, 62, 64, 67]],
		bass: [38, 31, 34, 33],
		melodies: [
			[[2, 74], [3.5, 72]], [[1.5, 71], [3, 74]], [[2, 77], [3.5, 74]], [[1.5, 76], [3, 73]],
			[[2, 81], [3.5, 79]], [[1.5, 77], [3, 74]], [[2, 77], [3.5, 76]], [[1.5, 74], [3, 69]],
		],
		ambience: { kind: 'wind', volume: 0.035 },
	},
	// Slow, sparse and bell-like, with a cold breeze.
	winter: {
		name: 'Cold air', bpm: 64, style: 'pad', voice: [1, 0.05], lead: [1, 0, 0.32, 0, 0.12, 0, 0.05], chordDecay: 2.4,
		chords: [[52, 56, 59, 63], [49, 52, 56, 59], [57, 61, 64, 68], [59, 64, 66, 71]],
		bass: [28, 25, 33, 35],
		melodies: [
			[[0.5, 83], [2, 80]], [[1, 78]], [[0.5, 80], [2, 85]], [[1, 83], [3, 78]],
			[[0.5, 88], [2, 87]], [[1, 83]], [[0.5, 85], [2, 80]], [[1, 78], [3, 76]],
		],
		ambience: { kind: 'wind', volume: 0.06 },
	},
}

export const TRACKS = Object.entries(THEMES).map(([id, { name, bpm }]) => ({ id, name, bpm }))

// Each court plays its own loop unless the player picked another for it, or picked one for every court.
// `choice` is { picks: { [courtId]: trackId }, everywhere: trackId | null }; track ids are the courts that own them.
export function trackFor(courtId, choice) {
	return choice.everywhere ?? choice.picks[courtId] ?? courtId
}

export function pickTrack(choice, courtId, trackId) {
	if (choice.everywhere) return { ...choice, everywhere: trackId }
	const { [courtId]: _, ...picks } = choice.picks
	return { ...choice, picks: trackId === courtId ? picks : { ...picks, [courtId]: trackId } }
}

/** Renders an original, seamless instrumental loop for a court without external audio assets. */
export function createMusicBuffer(audioContext, trackId = 'neighborhood') {
	const theme = THEMES[trackId] ?? THEMES.neighborhood
	const beatSeconds = 60 / theme.bpm
	const frameCount = Math.round(BARS * 4 * beatSeconds * SAMPLE_RATE)
	const buffer = audioContext.createBuffer(1, frameCount, SAMPLE_RATE)
	const samples = buffer.getChannelData(0)

	function addNote(beat, beats, midi, volume, decay, harmonics = theme.voice) {
		const start = Math.round(beat * beatSeconds * SAMPLE_RATE)
		const duration = beats * beatSeconds
		const frequency = 440 * 2 ** ((midi - 69) / 12)
		for (let frame = 0; frame < duration * SAMPLE_RATE; frame++) {
			const time = frame / SAMPLE_RATE
			const phase = time * frequency * Math.PI * 2
			const attack = Math.min(1, time / 0.025)
			const release = Math.min(1, (duration - time) / 0.18)
			const envelope = attack * release * Math.exp(-time / decay)
			let tone = 0
			harmonics.forEach((level, index) => { if (level) tone += level * Math.sin(phase * (index + 1)) })
			// Wrap note tails into the opening so the loop has no abrupt cutoff.
			samples[(start + frame) % frameCount] += tone * envelope * volume
		}
	}

	for (let bar = 0; bar < BARS; bar++) {
		const beat = bar * 4
		const chord = theme.chords[bar % theme.chords.length]
		const bass = theme.bass[bar % theme.bass.length]
		if (theme.style === 'offbeat') {
			for (let off = 0.5; off < 4; off++) chord.forEach(note => addNote(beat + off, 0.45, note, 0.05, theme.chordDecay))
		} else if (theme.style === 'arpeggio') {
			for (let step = 0; step < 8; step++) addNote(beat + step / 2, 1.6, chord[[0, 1, 2, 3, 2, 1, 2, 3][step]], 0.06, theme.chordDecay)
		} else {
			chord.forEach((note, index) => addNote(beat + index * 0.035, 4.2, note, 0.075, theme.chordDecay))
		}
		addNote(beat, 1.8, bass, 0.1, 0.7)
		addNote(beat + 2.5, 1.2, bass + 7, 0.05, 0.5)
		for (const [offset, note] of theme.melodies[bar]) addNote(beat + offset, 1.4, note, 0.045, 0.65, theme.lead)
	}
	if (theme.ambience) addAmbience(samples, theme.ambience)
	return buffer
}

// Filtered noise swells whose envelope is silent at the loop point, so the seam stays hidden.
function addAmbience(samples, { kind, volume }) {
	const seconds = samples.length / SAMPLE_RATE
	const swells = kind === 'waves' ? Math.max(1, Math.round(seconds / 6.5)) : kind === 'wind' ? 3 : 1
	const smoothing = { waves: 0.12, wind: 0.04, hum: 0.006 }[kind]
	let low = 0
	let lower = 0
	for (let i = 0; i < samples.length; i++) {
		const noise = Math.random() * 2 - 1
		low += smoothing * (noise - low)
		lower += smoothing * 0.25 * (low - lower)
		const swell = Math.sin(Math.PI * swells * i / samples.length) ** 2
		// Waves crash then drain; wind and hum breathe more evenly.
		const shape = kind === 'waves' ? swell ** 3 + 0.25 * swell : kind === 'hum' ? 0.6 + 0.4 * swell : swell
		const fade = Math.min(1, i / 2000, (samples.length - i) / 2000)
		const band = kind === 'wind' ? low - lower : low
		samples[i] += band * shape * fade * volume * (kind === 'hum' ? 6 : 3)
	}
}
