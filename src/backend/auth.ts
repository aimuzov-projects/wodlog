/**
 * Вход через Telegram двумя путями: подписанный initData из Mini App и Login Widget для PWA
 * в обычном браузере. Подписи у них разные, но обе держатся на токене бота.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import type { TelegramUser } from '#backend/db.ts'

// Mini App переоткрывают, а не держат открытым сутками. Дальше живёт своя сессия.
const MAX_AGE = 24 * 3600
const MAX_INIT_DATA = 8192

export type TelegramLogin = {
	user: TelegramUser
	/** `startapp` из ссылки, по нему приходит приглашение в зал. */
	startParam: string | null
}

const safeEqual = (given: string, expected: string) => {
	const [a, b] = [Buffer.from(given), Buffer.from(expected)]

	return a.length === b.length && timingSafeEqual(a, b)
}

const dataCheckString = (fields: Map<string, string>) =>
	[...fields]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${k}=${v}`)
		.join('\n')

function isTelegramUser(value: unknown): value is TelegramUser {
	const user = value as TelegramUser

	return Boolean(user) && Number.isInteger(user.id) && typeof user.first_name === 'string'
}

/** Проверяет initData Mini App. `null`, если подпись не сходится или данные устарели. */
export function verifyInitData(initData: string, botToken: string, now = Date.now() / 1000): TelegramLogin | null {
	if (!initData || initData.length > MAX_INIT_DATA) return null

	const fields = new Map(new URLSearchParams(initData))
	const given = fields.get('hash') ?? ''

	fields.delete('hash')

	// Участвуют все поля, кроме hash, в том числе подпись Ed25519 (`signature`).
	const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
	const expected = createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex')

	if (!safeEqual(given, expected)) return null

	try {
		if (now - Number.parseInt(fields.get('auth_date')!, 10) > MAX_AGE) return null

		const user = JSON.parse(fields.get('user')!)

		return isTelegramUser(user) ? { user, startParam: fields.get('start_param') ?? null } : null
	} catch {
		return null
	}
}

/** Проверяет ответ Login Widget: те же поля, но ключ -- sha256 от токена, а не HMAC. */
export function verifyLoginWidget(
	payload: Record<string, unknown>,
	botToken: string,
	now = Date.now() / 1000,
): TelegramUser | null {
	const fields = new Map<string, string>()

	for (const [k, v] of Object.entries(payload))
		if (k !== 'hash' && v !== undefined && v !== null) fields.set(k, String(v))

	const secret = createHash('sha256').update(botToken).digest()
	const expected = createHmac('sha256', secret).update(dataCheckString(fields)).digest('hex')

	if (typeof payload.hash !== 'string' || !safeEqual(payload.hash, expected)) return null

	if (now - Number(payload.auth_date) > MAX_AGE) return null

	const user = { ...payload, id: Number(payload.id) }

	return isTelegramUser(user) ? user : null
}
