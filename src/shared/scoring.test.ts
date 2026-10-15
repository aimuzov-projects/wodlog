import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pointsFor, rank, standings, type Scorable } from '#shared/scoring.ts'

const r = (userId: number, patch: Partial<Scorable>) => ({
	userId,
	division: 'rx' as const,
	rounds: null,
	reps: null,
	timeSec: null,
	capped: false,
	weight: null,
	...patch,
})

test('AMRAP ranks by rounds, then reps, RX above Scaled', () => {
	const ranked = rank('amrap', [
		r(1, { rounds: 5, reps: 3 }),
		r(2, { rounds: 6, reps: 0 }),
		r(3, { rounds: 9, reps: 0, division: 'scaled' }),
		r(4, { rounds: 5, reps: 10 }),
	])

	assert.deepEqual(
		ranked.map((x) => x.userId),
		[2, 4, 1, 3],
	)
})

test('For Time puts capped results after finishers', () => {
	const ranked = rank('for_time', [
		r(1, { capped: true, rounds: 4, reps: 20 }),
		r(2, { timeSec: 600 }),
		r(3, { timeSec: 540 }),
		r(4, { capped: true, rounds: 5, reps: 0 }),
	])

	assert.deepEqual(
		ranked.map((x) => x.userId),
		[3, 2, 4, 1],
	)
})

test('strength ranks by weight', () => {
	const ranked = rank('strength', [r(1, { weight: 80 }), r(2, { weight: 100 })])

	assert.deepEqual(
		ranked.map((x) => x.userId),
		[2, 1],
	)
})

test('ties share a place and the next place is skipped', () => {
	const ranked = rank('amrap', [r(1, { rounds: 5 }), r(2, { rounds: 5 }), r(3, { rounds: 4 })])

	assert.deepEqual(
		ranked.map((x) => [x.userId, x.place, x.points]),
		[
			[1, 1, 11],
			[2, 1, 11],
			[3, 3, 7],
		],
	)
})

test('points: place bonus for top 8 plus one for taking part', () => {
	assert.equal(pointsFor(1), 11)
	assert.equal(pointsFor(8), 2)
	assert.equal(pointsFor(20), 1)
})

test('standings sum points across parts', () => {
	const table = standings([
		{ kind: 'amrap', results: [r(1, { rounds: 5 }), r(2, { rounds: 4 })] },
		{ kind: 'for_time', results: [r(1, { timeSec: 700 }), r(2, { timeSec: 600 }), r(3, { timeSec: 650 })] },
	])

	assert.deepEqual(
		table.map((x) => [x.userId, x.points, x.place]),
		[
			[2, 9 + 11, 1],
			[1, 11 + 7, 2],
			[3, 9, 3],
		],
	)
})
