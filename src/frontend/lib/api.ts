/**
 * Запросы к API. Сессионный токен живёт в localStorage: в Mini App его можно получить заново
 * по initData, а в PWA он избавляет от повторного входа через виджет.
 */

const TOKEN_KEY = 'wodlog.token'

export class ApiError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

function storage(): Storage | null {
	try {
		return window.localStorage
	} catch {
		return null
	}
}

export const getToken = () => storage()?.getItem(TOKEN_KEY) ?? null

export function setToken(token: string | null) {
	if (token) storage()?.setItem(TOKEN_KEY, token)
	else storage()?.removeItem(TOKEN_KEY)
}

let onUnauthorized: () => void = () => {}

/** Что делать, когда сессия протухла: в Mini App перелогиниться, в браузере показать вход. */
export function handleUnauthorized(handler: () => void) {
	onUnauthorized = handler
}

async function raw(method: string, path: string, body?: unknown): Promise<Response> {
	const token = getToken()

	let response: Response

	try {
		response = await fetch(path, {
			method,
			headers: {
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	} catch {
		throw new ApiError(0, 'Нет связи с сервером')
	}

	if (response.status === 401 && token) {
		setToken(null)
		onUnauthorized()
	}

	return response
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
	const response = await raw(method, path, body)
	const data = await response.json().catch(() => null)

	if (!response.ok) throw new ApiError(response.status, data?.error ?? `Ошибка ${response.status}`)

	return data as T
}
