// The CPU players in HORSE. Each is drawn by the same figure() as you, with its own colours and one extra hair shape.
// Colours are [r, g, b], like the engine's palettes.

export const PLAYER_SHIRT = [194, 80, 46]

// Each character's kit: a shirt, a second colour for the stripe bands (the shirt again for a plain one) and shorts.
// None is orange, which stays yours.
export const JERSEYS = {
	blue: { name: 'Blue', shirt: [52, 96, 184], stripe: [52, 96, 184], legs: [226, 224, 216] },
	green: { name: 'Green, cream stripes', shirt: [52, 116, 80], stripe: [232, 224, 200], legs: [40, 52, 46] },
	purple: { name: 'Purple', shirt: [104, 74, 156], stripe: [104, 74, 156], legs: [46, 40, 62] },
	gold: { name: 'Gold, black stripes', shirt: [222, 168, 48], stripe: [40, 38, 36], legs: [40, 38, 36] },
	teal: { name: 'Teal', shirt: [40, 128, 138], stripe: [40, 128, 138], legs: [230, 228, 220] },
	black: { name: 'Black, red stripes', shirt: [44, 44, 48], stripe: [196, 52, 52], legs: [44, 44, 48] },
	cream: { name: 'Cream, navy stripes', shirt: [234, 228, 212], stripe: [58, 86, 150], legs: [58, 86, 150] },
}

// Shapes added round the head, in metres from the head's centre: `along` points where the player faces, `side` to their
// left, `up` up. A ball is a sphere; a strand runs from one point to another, narrowing from r0 to r1.
// `color` names the character's hair, a white band, or the character's accent.
const ring = Array.from({ length: 18 }, (_, i) => {
	const angle = i / 18 * Math.PI * 2
	return { ball: [-0.04 + Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, 0.1], r: 0.065, color: 'band' }
})
export const HAIRSTYLES = {
	short: [],
	buzz: [],
	afro: [{ ball: [-0.06, 0, 0.12], r: 0.3, color: 'hair' }],
	bun: [{ ball: [-0.14, 0, 0.3], r: 0.12, color: 'hair' }],
	ponytail: [{ strand: [[-0.2, 0, 0.14], [-0.36, 0, -0.22]], r0: 0.1, r1: 0.06, color: 'hair' }],
	long: [
		{ strand: [[-0.12, 0.14, 0.08], [-0.16, 0.16, -0.34]], r0: 0.12, r1: 0.1, color: 'hair' },
		{ strand: [[-0.12, -0.14, 0.08], [-0.16, -0.16, -0.34]], r0: 0.12, r1: 0.1, color: 'hair' },
		{ strand: [[-0.2, 0, 0.1], [-0.24, 0, -0.36]], r0: 0.14, r1: 0.12, color: 'hair' },
	],
	headband: ring,
	cap: [
		{ ball: [-0.04, 0, 0.13], r: 0.215, color: 'accent' },
		{ strand: [[0.12, 0, 0.1], [0.3, 0, 0.08]], r0: 0.1, r1: 0.1, color: 'accent' },
	],
}

export const CHARACTERS = [
	{ id: 'rae', name: 'Rae', hair: 'Afro', style: 'afro', skin: [118, 76, 50], hairColor: [28, 22, 20], kit: 'blue' },
	{ id: 'kai', name: 'Kai', hair: 'Bun', style: 'bun', skin: [226, 180, 140], hairColor: [96, 62, 38], kit: 'green' },
	{ id: 'rosa', name: 'Rosa', hair: 'Ponytail', style: 'ponytail', skin: [170, 110, 72], hairColor: [54, 32, 24], kit: 'purple' },
	{ id: 'dre', name: 'Dre', hair: 'Headband', style: 'headband', skin: [192, 133, 91], hairColor: [30, 24, 22], kit: 'gold' },
	{ id: 'theo', name: 'Theo', hair: 'Buzz cut', style: 'buzz', skin: [98, 62, 42], hairColor: [70, 46, 34], kit: 'teal' },
	{ id: 'lena', name: 'Lena', hair: 'Long', style: 'long', skin: [236, 196, 160], hairColor: [196, 152, 84], kit: 'cream' },
	{ id: 'sam', name: 'Sam', hair: 'Cap', style: 'cap', skin: [150, 96, 62], hairColor: [20, 18, 18], accent: [196, 52, 52], kit: 'black' },
]

export const characterOf = id => CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0]
export const kitOf = character => JERSEYS[character.kit]

/** The palette figure() takes. */
export function paletteOf(character, jersey) {
	return { shirt: jersey.shirt, stripe: jersey.stripe, legs: jersey.legs, skin: character.skin, hair: character.hairColor }
}

const BAND = [240, 236, 226]
export const colorOf = (character, name) => ({ hair: character.hairColor, band: BAND, accent: character.accent })[name]
