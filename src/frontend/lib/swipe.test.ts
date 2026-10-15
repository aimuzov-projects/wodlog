import assert from 'node:assert/strict'
import { test } from 'node:test'

import { swipeDirection } from '#frontend/lib/swipe.ts'

test('a quick mostly horizontal move is a swipe', () => {
	assert.equal(swipeDirection(-120, 10, 200), 'left')
	assert.equal(swipeDirection(90, -20, 300), 'right')
})

test('short, slow or diagonal moves are not swipes', () => {
	assert.equal(swipeDirection(-40, 0, 100), null)
	assert.equal(swipeDirection(-150, 0, 1200), null)
	assert.equal(swipeDirection(-100, 80, 200), null)
	assert.equal(swipeDirection(5, 300, 200), null)
})
