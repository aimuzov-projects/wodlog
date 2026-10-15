import assert from 'node:assert/strict'
import { test } from 'node:test'

import { InvalidInput, parseModelJson, partKind, resultInput, workoutDraft } from '#shared/workout.ts'

test('normalizes free-form part kinds', () => {
	assert.equal(partKind('AMRAP 12'), 'amrap')
	assert.equal(partKind('E2MOM'), 'emom')
	assert.equal(partKind('For time'), 'for_time')
	assert.equal(partKind('RFT'), 'for_time')
	assert.equal(partKind('Strength'), 'strength')
	assert.equal(partKind('skill'), 'other')
})

test('cleans up a recognized workout', () => {
	const draft = workoutDraft({
		warmup: '  3 rounds: 200m run, 10 air squats ',
		parts: [
			{
				kind: 'amrap',
				title: 'AMRAP 12',
				timeCapSec: '720',
				movements: [
					{ name: 'Thrusters', reps: 10, weightM: '42,5', weightF: 30 },
					{ name: '', reps: '5' },
					'junk',
				],
			},
			{},
			null,
		],
		extra: 'ignored',
	})

	assert.equal(draft.warmup, '3 rounds: 200m run, 10 air squats')
	assert.equal(draft.parts.length, 1)
	assert.equal(draft.parts[0].timeCapSec, 720)

	assert.deepEqual(draft.parts[0].movements, [
		{ name: 'Thrusters', reps: '10', weightM: 42.5, weightF: 30, equipment: null },
	])
})

test('garbage becomes an empty workout', () => {
	assert.deepEqual(workoutDraft('nope'), { warmup: '', parts: [] })
	assert.deepEqual(workoutDraft({ parts: 'x' }), { warmup: '', parts: [] })
})

test('extracts JSON from a fenced model reply', () => {
	assert.deepEqual(parseModelJson('Here you go:\n```json\n{"warmup":"run"}\n```'), { warmup: 'run' })
	assert.throws(() => parseModelJson('no json here'), InvalidInput)
	assert.throws(() => parseModelJson('{"broken": }'), InvalidInput)
})

test('requires the ranking value for each part kind', () => {
	assert.throws(() => resultInput({ division: 'rx' }, 'for_time'), /время/)
	assert.throws(() => resultInput({ capped: true }, 'for_time'), /капа/)
	assert.throws(() => resultInput({}, 'amrap'), /раунды/)
	assert.throws(() => resultInput({}, 'strength'), /вес/)
	assert.doesNotThrow(() => resultInput({}, 'other'))
})

test('capped For Time drops the time', () => {
	const result = resultInput({ capped: true, timeSec: 999, rounds: 4, reps: 12 }, 'for_time')

	assert.equal(result.timeSec, null)
	assert.equal(result.rounds, 4)
})

test('capped flag only applies to For Time', () => {
	assert.equal(resultInput({ capped: true, rounds: 5 }, 'amrap').capped, false)
})
