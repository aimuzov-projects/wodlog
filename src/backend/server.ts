/**
 * API WODlog: вход через Telegram, залы, тренировки дня, результаты и рейтинг.
 *
 * Node запускает файл сам, без сборки и зависимостей. Фронт -- статика в соседнем контейнере,
 * Caddy отдаёт сюда только `/api/*`.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'

import { verifyInitData, verifyLoginWidget } from '#backend/auth.ts'
import { Db, type TelegramUser } from '#backend/db.ts'
import { DEFAULT_MODEL, openRouterRecognizer, RecognizeError, type Recognizer } from '#backend/recognize.ts'
import { botApi, runBot } from '#backend/telegram.ts'
import type { RatingPeriod, Visibility } from '#shared/types.ts'
import { InvalidInput, resultInput, text, workoutDraft } from '#shared/workout.ts'

// Фото доски приходит data URL внутри JSON, клиент ужимает его до ~1600 px.
export const BODY_LIMIT = 10 * 1024 * 1024
// Распознаваний в сутки на человека: каждое стоит денег на OpenRouter.
const RECOGNIZE_PER_DAY = 30

export type Settings = {
	botToken: string
	appUrl: string
	dataDir: string
	/** Часовой пояс залов: по нему считается «сегодня» в рейтинге. */
	timeZone: string
	/** Вход без Telegram для локальной разработки и e2e, на проде выключен. */
	devLogin: boolean
}

type Json = [status: number, body: unknown]
type Raw = { status: number; type: string; body: Buffer }
type Reply = Json | Raw

type Context = {
	request: IncomingMessage
	params: string[]
	query: URLSearchParams
	/** id пользователя по сессии, бросает 401 без неё. */
	user: () => number
	body: () => Promise<Record<string, unknown>>
}

/**
 * Ошибка с HTTP-статусом для клиента.
 *
 * Статус и сообщение уходят в ответ как есть. Любая другая ошибка пишется в лог
 * и отдаётся с кодом 500.
 */
export class HttpError extends Error {
	// Без parameter properties: Node только стирает типы и такой синтаксис не запустит.
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

/** Тело запроса как JSON-объект. 413, если оно больше `limit`, 400, если это не объект. */
export async function readJson(request: AsyncIterable<Buffer>, limit = BODY_LIMIT): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = []

	let size = 0

	for await (const chunk of request) {
		size += chunk.length

		if (size > limit) throw new HttpError(413, 'Слишком большой запрос')

		chunks.push(chunk)
	}

	try {
		const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')

		if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body
	} catch {
		// Ответим так же, как на не-объект.
	}

	throw new HttpError(400, 'Тело запроса не JSON-объект')
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const IMAGE = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=]+)$/i

export function today(timeZone: string, at = new Date()) {
	// en-CA форматирует дату как YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

function date(value: string) {
	if (!DATE.test(value) || Number.isNaN(Date.parse(value))) throw new HttpError(400, 'Дата в формате YYYY-MM-DD')

	return value
}

export function createApp(db: Db, settings: Settings, recognize: Recognizer | null) {
	const photos = join(settings.dataDir, 'photos')
	const recognitions = new Map<string, number>()

	const photoPath = (gymId: number, day: string) => join(photos, `${gymId}-${day}.jpg`)

	/** Проверяет членство в зале и возвращает его id. 404, а не 403: чужие залы не светим. */
	function member(userId: number, raw: string) {
		const gymId = Number(raw)

		if (!db.role(gymId, userId)) throw new HttpError(404, 'Нет такого зала')

		return gymId
	}

	function login(user: TelegramUser) {
		db.upsertUser(user)

		return { token: db.createSession(user.id), me: db.me(user.id), gyms: db.gyms(user.id) }
	}

	function countRecognition(userId: number) {
		const key = `${userId}:${today(settings.timeZone)}`
		const count = (recognitions.get(key) ?? 0) + 1

		if (count > RECOGNIZE_PER_DAY)
			throw new HttpError(429, 'На сегодня распознаваний хватит, введите тренировку вручную')

		// Счётчики прошлых дней больше не нужны.
		if (!recognitions.has(key)) recognitions.clear()

		recognitions.set(key, count)
	}

	const routes: [method: string, pattern: RegExp, handler: (ctx: Context) => Promise<Reply> | Reply][] = [
		['GET', /^\/api\/health$/, () => [200, { ok: true }]],

		[
			'POST',
			/^\/api\/auth\/telegram$/,
			async ({ body }) => {
				const signed = verifyInitData(text((await body()).initData, 8192), settings.botToken)

				if (!signed) throw new HttpError(401, 'Telegram не подтвердил вход, откройте приложение заново')

				return [200, { ...login(signed.user), startParam: signed.startParam }]
			},
		],

		[
			'POST',
			/^\/api\/auth\/widget$/,
			async ({ body }) => {
				const user = verifyLoginWidget(await body(), settings.botToken)

				if (!user) throw new HttpError(401, 'Telegram не подтвердил вход')

				return [200, login(user)]
			},
		],

		[
			'POST',
			/^\/api\/auth\/dev$/,
			async ({ body }) => {
				if (!settings.devLogin) throw new HttpError(404, 'Нет такой ручки')

				const raw = await body()

				return [200, login({ id: Number(raw.id) || 1, first_name: text(raw.name, 60) || 'Dev' })]
			},
		],

		['GET', /^\/api\/me$/, ({ user }) => [200, { me: db.me(user()), gyms: db.gyms(user()) }]],

		[
			'PATCH',
			/^\/api\/me$/,
			async ({ user, body }) => {
				const { visibility } = await body()

				if (visibility !== 'public' && visibility !== 'private')
					throw new HttpError(400, 'Видимость: public или private')

				db.setVisibility(user(), visibility as Visibility)

				return [200, db.me(user())]
			},
		],

		['GET', /^\/api\/me\/history$/, ({ user }) => [200, db.history(user())]],

		[
			'POST',
			/^\/api\/gyms$/,
			async ({ user, body }) => {
				const name = text((await body()).name, 80)

				if (!name) throw new HttpError(400, 'Как называется зал?')

				return [201, db.createGym(user(), name)]
			},
		],

		[
			'POST',
			/^\/api\/gyms\/join$/,
			async ({ user, body }) => {
				const gym = db.joinGym(user(), text((await body()).code, 40).toLowerCase())

				if (!gym) throw new HttpError(404, 'Приглашение не найдено или устарело')

				return [200, gym]
			},
		],

		[
			'PATCH',
			/^\/api\/gyms\/(\d+)$/,
			async ({ user, params, body }) => {
				const gymId = member(user(), params[0])
				const name = text((await body()).name, 80)

				if (db.role(gymId, user()) !== 'admin') throw new HttpError(403, 'Переименовать зал может только админ')

				if (!name) throw new HttpError(400, 'Как называется зал?')

				db.renameGym(gymId, name)

				return [200, db.gym(gymId, user())]
			},
		],

		[
			'DELETE',
			/^\/api\/gyms\/(\d+)\/membership$/,
			({ user, params }) => {
				db.leaveGym(user(), member(user(), params[0]))

				return [200, { ok: true }]
			},
		],

		[
			'GET',
			/^\/api\/gyms\/(\d+)\/workouts\/([\d-]+)$/,
			({ user, params }) => {
				const gymId = member(user(), params[0])

				return [200, { workout: db.workout(gymId, date(params[1])), dates: db.workoutDates(gymId) }]
			},
		],

		[
			'PUT',
			/^\/api\/gyms\/(\d+)\/workouts\/([\d-]+)$/,
			async ({ user, params, body }) => {
				const gymId = member(user(), params[0])
				const day = date(params[1])
				const draft = workoutDraft(await body())

				if (!draft.warmup && draft.parts.length === 0) throw new HttpError(400, 'Пустая тренировка')

				return [200, db.saveWorkout(gymId, day, user(), draft, { hasPhoto: existsSync(photoPath(gymId, day)) })]
			},
		],

		[
			'POST',
			/^\/api\/gyms\/(\d+)\/workouts\/([\d-]+)\/recognize$/,
			async ({ user, params, body }) => {
				const gymId = member(user(), params[0])
				const day = date(params[1])

				if (!recognize) throw new HttpError(503, 'Распознавание не настроено, введите тренировку вручную')

				const image = text((await body()).image, BODY_LIMIT)
				const match = image.match(IMAGE)

				if (!match) throw new HttpError(400, 'Нужна фотография в JPEG, PNG или WebP')

				countRecognition(user())

				const { draft, raw } = await recognize(image)

				// Фото храним только как подтверждение того, что было на доске, клиент всегда шлёт JPEG.
				await mkdir(photos, { recursive: true })
				await writeFile(photoPath(gymId, day), Buffer.from(match[2], 'base64'))

				db.markPhoto(gymId, day, raw)

				return [200, { draft }]
			},
		],

		[
			'GET',
			/^\/api\/gyms\/(\d+)\/workouts\/([\d-]+)\/photo$/,
			async ({ user, params }) => {
				const path = photoPath(member(user(), params[0]), date(params[1]))

				if (!existsSync(path)) throw new HttpError(404, 'Фото нет')

				return { status: 200, type: 'image/jpeg', body: await readFile(path) }
			},
		],

		[
			'GET',
			/^\/api\/gyms\/(\d+)\/rating$/,
			({ user, params, query }) => {
				const gymId = member(user(), params[0])
				const period = query.get('period') as RatingPeriod

				if (!['week', 'month', 'all'].includes(period)) throw new HttpError(400, 'Период: week, month или all')

				return [200, db.rating(gymId, period, today(settings.timeZone))]
			},
		],

		[
			'GET',
			/^\/api\/parts\/(\d+)\/results$/,
			({ user, params }) => {
				const info = db.partInfo(Number(params[0]))

				if (!info || !db.role(info.gymId, user())) throw new HttpError(404, 'Нет такого комплекса')

				return [200, db.leaderboard(Number(params[0]), info.kind, user())]
			},
		],

		[
			'PUT',
			/^\/api\/parts\/(\d+)\/results$/,
			async ({ user, params, body }) => {
				const partId = Number(params[0])
				const info = db.partInfo(partId)

				if (!info || !db.role(info.gymId, user())) throw new HttpError(404, 'Нет такого комплекса')

				db.saveResult(partId, user(), resultInput(await body(), info.kind))

				return [200, db.leaderboard(partId, info.kind, user())]
			},
		],

		[
			'DELETE',
			/^\/api\/parts\/(\d+)\/results$/,
			({ user, params }) => {
				const partId = Number(params[0])
				const info = db.partInfo(partId)

				if (!info || !db.role(info.gymId, user())) throw new HttpError(404, 'Нет такого комплекса')

				db.deleteResult(partId, user())

				return [200, db.leaderboard(partId, info.kind, user())]
			},
		],
	]

	return async function handle(request: IncomingMessage, response: ServerResponse) {
		const url = new URL(request.url ?? '/', 'http://localhost')

		let reply: Reply

		try {
			const found = routes
				.filter(([method]) => method === request.method)
				.map(([, pattern, handler]) => [url.pathname.match(pattern), handler] as const)
				.find(([match]) => match)

			if (!found) throw new HttpError(404, 'Нет такой ручки')

			const [match, handler] = found
			const header = request.headers.authorization ?? ''

			let userId: number | null | undefined

			reply = await handler({
				request,
				params: match!.slice(1),
				query: url.searchParams,
				user: () => {
					userId ??= header.startsWith('Bearer ') ? db.sessionUser(header.slice(7)) : null

					if (userId === null) throw new HttpError(401, 'Нужно войти заново')

					return userId
				},
				body: () => readJson(request),
			})
		} catch (error) {
			const known = error instanceof HttpError || error instanceof InvalidInput || error instanceof RecognizeError

			if (!known) console.error(error)

			const status = error instanceof HttpError ? error.status : known ? 422 : 500

			reply = [status, { error: known ? (error as Error).message : 'Что-то сломалось на сервере' }]
		}

		if (Array.isArray(reply)) {
			response.writeHead(reply[0], {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			})

			response.end(JSON.stringify(reply[1]))
		} else {
			response.writeHead(reply.status, { 'content-type': reply.type, 'cache-control': 'private, max-age=86400' })
			response.end(reply.body)
		}
	}
}

// Тесты собирают приложение сами, сервер поднимается только при запуске файла.
if (import.meta.main) {
	const env = process.env
	const dataDir = env.DATA_DIR || './data'
	const appUrl = env.APP_URL || 'http://localhost:4321'

	if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN не задан')

	const settings: Settings = {
		botToken: env.BOT_TOKEN,
		appUrl,
		dataDir,
		timeZone: env.APP_TIMEZONE || 'Europe/Moscow',
		devLogin: env.NODE_ENV !== 'production' && env.DEV_LOGIN === '1',
	}
	const recognize = env.OPENROUTER_API_KEY
		? openRouterRecognizer({ apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || DEFAULT_MODEL, appUrl })
		: null
	const db = new Db(join(dataDir, 'wodlog.db'))
	const port = Number(env.PORT || 8787)

	createServer(createApp(db, settings, recognize)).listen(port, () => console.log(`api: http://localhost:${port}`))

	// Локально бот обычно не нужен: два процесса с одним токеном отбирали бы друг у друга апдейты.
	if (env.BOT_POLLING !== '0') void runBot(botApi(env.BOT_TOKEN), appUrl)
}
