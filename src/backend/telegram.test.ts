import assert from 'node:assert/strict'
import { test } from 'node:test'

import { handleUpdates, type BotCall } from '#backend/telegram.ts'

const APP = 'https://app.test'

function recorder(fail = false) {
	const calls: [string, Record<string, unknown>][] = []
	const call: BotCall = async (method, params) => {
		calls.push([method, params])

		if (fail) throw new Error('Forbidden: bot was blocked by the user')
	}

	return { calls, call }
}

test('answers /start with a Mini App button that carries the invite', async () => {
	const { calls, call } = recorder()
	const offset = await handleUpdates(
		[{ update_id: 7, message: { chat: { id: 5, type: 'private' }, text: '/start gym_abc' } }],
		0,
		APP,
		call,
	)

	assert.equal(offset, 8)
	assert.equal(calls.length, 1)

	const [method, params] = calls[0]
	const keyboard = params.reply_markup as { inline_keyboard: { web_app: { url: string } }[][] }

	assert.equal(method, 'sendMessage')
	assert.equal(params.chat_id, 5)
	assert.equal(keyboard.inline_keyboard[0][0].web_app.url, 'https://app.test/?invite=abc')
})

test('ignores groups and other messages but still moves the offset', async () => {
	const { calls, call } = recorder()
	const offset = await handleUpdates(
		[
			{ update_id: 10, message: { chat: { id: -1, type: 'group' }, text: '/start' } },
			{ update_id: 11, message: { chat: { id: 5, type: 'private' }, text: 'hello' } },
			{ update_id: 12 },
		],
		3,
		APP,
		call,
	)

	assert.equal(offset, 13)
	assert.equal(calls.length, 0)
})

test('a failed reply does not stop the queue', async () => {
	const { calls, call } = recorder(true)
	const offset = await handleUpdates(
		[
			{ update_id: 1, message: { chat: { id: 5, type: 'private' }, text: '/start' } },
			{ update_id: 2, message: { chat: { id: 6, type: 'private' }, text: '/app' } },
		],
		0,
		APP,
		call,
	)

	assert.equal(offset, 3)
	assert.equal(calls.length, 2)
})
