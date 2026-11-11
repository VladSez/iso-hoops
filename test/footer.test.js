import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COURTS } from '../dist/courts.js'

const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8')
const game = readFileSync(new URL('../dist/game.js', import.meta.url), 'utf8')

function labelsOf(constant) {
	const literal = game.match(new RegExp(`const ${constant} = \\{([^}]*)\\}`))
	assert.ok(literal, `${constant} should be an object literal in game.js`)
	return [...literal[1].matchAll(/:\s*'([^']+)'/g)].map(match => match[1])
}

const LABELS = {
	'mode-label': labelsOf('MODES'),
	'court-label': Object.values(COURTS).map(court => court.name),
}

for (const [id, labels] of Object.entries(LABELS)) {
	test(`#${id} reserves room for its longest option`, () => {
		const rule = css.match(new RegExp(`#${id} \\{ min-width: (\\d+)ch; \\}`))
		assert.ok(rule, `style.css should give #${id} a min-width in ch`)
		const longest = labels.reduce((a, b) => (b.length > a.length ? b : a))
		assert.ok(Number(rule[1]) >= longest.length, `"${longest}" needs ${longest.length}ch, #${id} reserves ${rule[1]}ch`)
	})
}
