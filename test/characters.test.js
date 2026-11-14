import test from 'node:test'
import assert from 'node:assert/strict'
import { CHARACTERS, HAIRSTYLES, JERSEYS, PLAYER_SHIRT, characterOf, colorOf } from '../dist/characters.js'

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

test('no CPU jersey can be mistaken for your orange one', () => {
	for (const [id, jersey] of Object.entries(JERSEYS)) {
		assert.ok(distance(jersey.shirt, PLAYER_SHIRT) > 80, `${id} is too close to orange`)
	}
})

test('every character has a hairstyle, a kit and the colours its hair shapes use', () => {
	assert.equal(new Set(CHARACTERS.map(character => character.id)).size, CHARACTERS.length)
	for (const character of CHARACTERS) {
		assert.ok(HAIRSTYLES[character.style], `${character.id} has no ${character.style} shapes`)
		assert.ok(JERSEYS[character.kit], `${character.id} has no ${character.kit} kit`)
		for (const shape of HAIRSTYLES[character.style]) assert.ok(colorOf(character, shape.color), `${character.id} lacks ${shape.color}`)
	}
})

test('an unknown saved character falls back to a real one', () => {
	assert.equal(characterOf('nobody'), CHARACTERS[0])
})
