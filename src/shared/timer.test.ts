import assert from 'node:assert/strict'
import { test } from 'node:test'

import { configForPart, formatClock, resultFromTimer, Stopwatch, TABATA, timerState, totalMs } from '#shared/timer.ts'

test('turns a finished timer into a result', () => {
	const amrap = { mode: 'amrap', durationSec: 600 } as const
	const forTime = { mode: 'for_time', capSec: 300 } as const
	const emom = { mode: 'emom', intervalSec: 60, rounds: 4 } as const

	assert.deepEqual(resultFromTimer(amrap, 10_000 + 600_000, 7), { rounds: 7, timeSec: null, capped: false })
	assert.deepEqual(resultFromTimer(forTime, 10_000 + 252_400, 3), { rounds: null, timeSec: 252, capped: false })
	assert.deepEqual(resultFromTimer(forTime, 10_000 + 300_000, 3), { rounds: 3, timeSec: null, capped: true })
	assert.deepEqual(resultFromTimer(emom, 10_000 + 240_000, 0), { rounds: 4, timeSec: null, capped: false })
	assert.deepEqual(resultFromTimer(emom, 10_000 + 150_000, 0), { rounds: 2, timeSec: null, capped: false })
})

test('starts with a 10 second prep countdown', () => {
	const state = timerState({ mode: 'amrap', durationSec: 600 }, 3_000)

	assert.equal(state.phase, 'prep')
	assert.equal(state.displayMs, 7_000)
	assert.equal(state.workElapsedMs, 0)
})

test('AMRAP counts down and finishes', () => {
	const config = { mode: 'amrap', durationSec: 600 } as const

	assert.equal(timerState(config, 10_000 + 60_000).displayMs, 540_000)
	assert.equal(timerState(config, 10_000 + 600_000).phase, 'done')
})

test('For Time counts up and stops at the cap', () => {
	const config = { mode: 'for_time', capSec: 300 } as const

	assert.equal(timerState(config, 10_000 + 42_000).displayMs, 42_000)

	const done = timerState(config, 10_000 + 400_000)

	assert.equal(done.phase, 'done')
	assert.equal(done.displayMs, 300_000)
})

test('For Time without a cap never ends', () => {
	const state = timerState({ mode: 'for_time', capSec: null }, 10_000 + 3_600_000)

	assert.equal(state.phase, 'work')
	assert.equal(totalMs({ mode: 'for_time', capSec: null }), Infinity)
})

test('EMOM switches rounds every interval', () => {
	const config = { mode: 'emom', intervalSec: 60, rounds: 10 } as const

	assert.equal(timerState(config, 10_000 + 59_000).round, 1)
	assert.equal(timerState(config, 10_000 + 60_000).round, 2)
	assert.equal(timerState(config, 10_000 + 60_000).displayMs, 60_000)
	assert.equal(timerState(config, 10_000 + 600_000).phase, 'done')
})

test('Tabata alternates work and rest without a trailing rest', () => {
	assert.equal(timerState(TABATA, 10_000 + 5_000).phase, 'work')
	assert.equal(timerState(TABATA, 10_000 + 25_000).phase, 'rest')
	assert.equal(timerState(TABATA, 10_000 + 30_000).round, 2)
	assert.equal(totalMs(TABATA), 8 * 20_000 + 7 * 10_000)
	assert.equal(timerState(TABATA, 10_000 + totalMs(TABATA)).phase, 'done')
})

test('stopwatch excludes paused time', () => {
	const watch = new Stopwatch()

	watch.start(1_000)
	watch.pause(4_000)
	assert.equal(watch.elapsed(10_000), 3_000)
	watch.start(10_000)
	assert.equal(watch.elapsed(12_000), 5_000)
	watch.reset()
	assert.equal(watch.elapsed(20_000), 0)
})

test('formats the clock', () => {
	assert.equal(formatClock(75_000), '01:15')
	assert.equal(formatClock(3_723_000), '1:02:03')
	assert.equal(formatClock(500, true), '00:01')
})

test('derives timer config from a workout part', () => {
	assert.deepEqual(configForPart({ kind: 'amrap', timeCapSec: 720, intervalSec: null, rounds: null }), {
		mode: 'amrap',
		durationSec: 720,
	})

	assert.deepEqual(configForPart({ kind: 'emom', timeCapSec: null, intervalSec: 90, rounds: 8 }), {
		mode: 'emom',
		intervalSec: 90,
		rounds: 8,
	})

	assert.deepEqual(configForPart({ kind: 'strength', timeCapSec: null, intervalSec: null, rounds: null }), {
		mode: 'for_time',
		capSec: null,
	})
})
