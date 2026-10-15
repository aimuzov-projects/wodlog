import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

import { BODY_ZONE_LABELS, findInjury, INJURIES, injuriesInZone, injuryZones } from '#shared/injuries.ts'

test('every injury has a unique id and complete content', () => {
	assert.equal(new Set(INJURIES.map((i) => i.id)).size, INJURIES.length)

	for (const injury of INJURIES) {
		assert.ok(BODY_ZONE_LABELS[injury.zone], injury.id)

		for (const field of ['title', 'short', 'summary'] as const)
			assert.ok(injury[field].trim(), `${injury.id}.${field}`)

		for (const field of ['causes', 'symptoms', 'redFlags', 'firstSteps', 'modifications'] as const) {
			assert.ok(injury[field].length > 0, `${injury.id}.${field}`)
		}
	}
})

test('injury images and videos exist in public/', () => {
	for (const { id, image, video } of INJURIES) {
		for (const src of [image?.src, video?.src, video?.poster]) {
			if (src) assert.ok(existsSync(new URL(`../../public${src}`, import.meta.url)), `${id}: ${src}`)
		}
	}
})

test('finds injuries by id and zone', () => {
	assert.equal(findInjury('acl-tear')?.zone, 'knee')
	assert.equal(findInjury('nope'), null)

	assert.deepEqual(injuryZones(), ['knee', 'lower_back'])

	const knee = injuriesInZone('knee').map((i) => i.id)

	assert.deepEqual(knee, ['acl-tear', 'meniscus-tear'])

	assert.equal(injuriesInZone(null).length, INJURIES.length)
})
