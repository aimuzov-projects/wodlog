import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { Db, periodStart } from '#backend/db.ts'
import { createApp, readJson, today } from '#backend/server.ts'
import { signInitData } from '#backend/testing.ts'
import type { Gym, LeaderboardRow, Workout } from '#shared/types.ts'

const TOKEN = '123:test-token'
const dataDir = mkdtempSync(join(tmpdir(), 'wodlog-'))
const db = new Db(':memory:')
const DAY = '2026-10-15'

let server: Server
let base: string

before(async () => {
	const recognize = async () => ({
		draft: {
			warmup: 'Run',
			parts: [
				{
					kind: 'amrap' as const,
					title: 'AMRAP 12',
					description: '',
					timeCapSec: 720,
					intervalSec: null,
					rounds: null,
					movements: [],
				},
			],
		},
		raw: { ok: true },
	})
	const app = createApp(
		db,
		{
			botToken: TOKEN,
			webhookSecret: 's3cret',
			appUrl: 'https://app.test',
			dataDir,
			timeZone: 'UTC',
			devLogin: true,
		},
		recognize,
	)

	server = createServer(app)
	await new Promise<void>((resolve) => server.listen(0, resolve))
	base = `http://localhost:${(server.address() as AddressInfo).port}`
})

after(() => {
	server.close()
	db.close()
	rmSync(dataDir, { recursive: true, force: true })
})

async function call<T = Record<string, unknown>>(
	method: string,
	path: string,
	body?: unknown,
	token?: string,
	headers: Record<string, string> = {},
): Promise<[number, T]> {
	const response = await fetch(base + path, {
		method,
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...headers,
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	})

	return [response.status, (await response.json()) as T]
}

const devLogin = async (id: number, name: string) =>
	(await call<{ token: string }>('POST', '/api/auth/dev', { id, name }))[1].token

async function* stream(text: string) {
	yield Buffer.from(text)
}

test('readJson rejects oversized and non-object bodies', async () => {
	await assert.rejects(readJson(stream('{"a":1}'), 3), /большой/)
	await assert.rejects(readJson(stream('[1]')), /JSON-объект/)
})

test('logs in through signed initData', async () => {
	const initData = signInitData(
		{
			auth_date: String(Math.floor(Date.now() / 1000)),
			user: JSON.stringify({ id: 7, first_name: 'Tg' }),
			start_param: 'gym_x',
		},
		TOKEN,
	)
	const [status, body] = await call<{ token: string; startParam: string }>('POST', '/api/auth/telegram', { initData })

	assert.equal(status, 200)
	assert.equal(body.startParam, 'gym_x')
	assert.equal((await call('GET', '/api/me', undefined, body.token))[0], 200)
	assert.equal((await call('POST', '/api/auth/telegram', { initData: 'hash=bad' }))[0], 401)
})

test('requires a session', async () => {
	assert.equal((await call('GET', '/api/me'))[0], 401)
	assert.equal((await call('GET', '/api/me', undefined, 'nope'))[0], 401)
})

test('full flow: gym, workout of the day, results, rating, privacy', async () => {
	const ann = await devLogin(1, 'Ann')
	const bob = await devLogin(2, 'Bob')
	const eve = await devLogin(3, 'Eve')

	const [, gym] = await call<Gym>('POST', '/api/gyms', { name: 'Box' }, ann)

	assert.equal(gym.role, 'admin')
	assert.equal((await call('POST', '/api/gyms/join', { code: gym.inviteCode }, bob))[0], 200)
	assert.equal((await call('POST', '/api/gyms/join', { code: 'missing' }, bob))[0], 404)

	// Чужой зал не виден.
	assert.equal((await call('GET', `/api/gyms/${gym.id}/workouts/${DAY}`, undefined, eve))[0], 404)

	// Bob распознаёт доску, сохраняет, Ann видит ту же тренировку.
	const [, recognized] = await call<{ draft: Workout }>(
		'POST',
		`/api/gyms/${gym.id}/workouts/${DAY}/recognize`,
		{ image: 'data:image/jpeg;base64,/9j/AA==' },
		bob,
	)

	assert.equal(recognized.draft.parts[0].kind, 'amrap')

	const [, saved] = await call<Workout>('PUT', `/api/gyms/${gym.id}/workouts/${DAY}`, recognized.draft, bob)

	assert.equal(saved.hasPhoto, true)

	const [, loaded] = await call<{ workout: Workout; dates: string[] }>(
		'GET',
		`/api/gyms/${gym.id}/workouts/${DAY}`,
		undefined,
		ann,
	)

	assert.equal(loaded.workout.updatedBy?.name, 'Bob')
	assert.deepEqual(loaded.dates, [DAY])

	const partId = loaded.workout.parts[0].id!

	assert.equal((await call('PUT', `/api/parts/${partId}/results`, { division: 'rx' }, ann))[0], 422)
	await call('PUT', `/api/parts/${partId}/results`, { division: 'rx', rounds: 6, reps: 3 }, ann)

	const [, board] = await call<{ rows: LeaderboardRow[] }>(
		'PUT',
		`/api/parts/${partId}/results`,
		{ division: 'rx', rounds: 7 },
		bob,
	)

	assert.deepEqual(
		board.rows.map((r) => [r.user.name, r.place]),
		[
			['Bob', 1],
			['Ann', 2],
		],
	)

	// Редактирование тренировки с id комплекса не теряет результаты.
	await call('PUT', `/api/gyms/${gym.id}/workouts/${DAY}`, { ...loaded.workout, warmup: 'Row' }, ann)
	assert.equal((await call<{ rows: [] }>('GET', `/api/parts/${partId}/results`, undefined, ann))[1].rows.length, 2)

	// Приватный Bob пропадает из таблиц, но свой результат видит.
	await call('PATCH', '/api/me', { visibility: 'private' }, bob)

	const [, privateView] = await call<{ rows: LeaderboardRow[]; mine: unknown }>(
		'GET',
		`/api/parts/${partId}/results`,
		undefined,
		bob,
	)

	assert.deepEqual(
		privateView.rows.map((r) => r.user.name),
		['Ann'],
	)

	assert.ok(privateView.mine)

	const [, rating] = await call<{ user: { name: string } }[]>(
		'GET',
		`/api/gyms/${gym.id}/rating?period=all`,
		undefined,
		ann,
	)

	assert.deepEqual(
		rating.map((r) => r.user.name),
		['Ann'],
	)

	assert.equal((await call<unknown[]>('GET', '/api/me/history', undefined, bob))[1].length, 1)
})

test('webhook answers /start with a Mini App button only with the secret', async () => {
	const update = { message: { chat: { id: 5, type: 'private' }, text: '/start gym_abc' } }

	assert.equal((await call('POST', '/api/telegram/webhook', update))[0], 401)

	const [status, reply] = await call<{
		method: string
		reply_markup: { inline_keyboard: { web_app: { url: string } }[][] }
	}>('POST', '/api/telegram/webhook', update, undefined, { 'x-telegram-bot-api-secret-token': 's3cret' })

	assert.equal(status, 200)
	assert.equal(reply.method, 'sendMessage')
	assert.equal(reply.reply_markup.inline_keyboard[0][0].web_app.url, 'https://app.test/?invite=abc')
})

test('period start: week from Monday, month from the 1st', () => {
	assert.equal(periodStart('week', '2026-10-15'), '2026-10-12')
	assert.equal(periodStart('week', '2026-10-12'), '2026-10-12')
	assert.equal(periodStart('month', '2026-10-15'), '2026-10-01')
	assert.equal(today('UTC', new Date('2026-10-15T23:30:00Z')), '2026-10-15')
	assert.equal(today('Europe/Moscow', new Date('2026-10-15T23:30:00Z')), '2026-10-16')
})
