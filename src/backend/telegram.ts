/**
 * Бот: приветствие с кнопкой, которая открывает Mini App, и кнопка меню с ним же.
 *
 * Апдейты забираются long polling, а не webhook: входящие соединения от Telegram до сервера
 * в России не доходят. Исходящие идут через VPN-прокси из `HTTPS_PROXY` (см. compose).
 */

type Update = {
	update_id: number
	message?: {
		chat?: { id?: number; type?: string }
		text?: string
	}
}

/** Вызов метода Bot API. Подменяется в тестах. */
export type BotCall = (method: string, params: Record<string, unknown>) => Promise<unknown>

const GREETING = `Привет! Это WODlog — дневник кроссфит-тренировок.

Сфотографируйте доску с тренировкой дня, вносите свои раунды, время и веса, смотрите рейтинг зала и включайте таймер.`

// Telegram держит getUpdates до 50 секунд, если апдейтов нет. Запросу даём чуть больше.
const POLL_TIMEOUT = 50
const RETRY_DELAY = 5000

/** Ответ на апдейт в виде вызова Bot API или `null`, если отвечать нечего. */
export function replyTo(update: Omit<Update, 'update_id'>, appUrl: string): Record<string, unknown> | null {
	const message = update.message
	const chatId = message?.chat?.id

	if (!chatId || message.chat?.type !== 'private') return null

	const [command, payload] = (message.text ?? '').trim().split(/\s+/, 2)

	if (command !== '/start' && command !== '/app') return null

	// `t.me/<bot>?start=gym_<code>` приходит сюда, а не в Mini App: прокидываем код в URL.
	const url = new URL(appUrl)

	if (payload?.startsWith('gym_')) url.searchParams.set('invite', payload.slice(4))

	return {
		method: 'sendMessage',
		chat_id: chatId,
		text: GREETING,
		reply_markup: { inline_keyboard: [[{ text: 'Открыть WODlog', web_app: { url: url.toString() } }]] },
	}
}

export function botApi(token: string): BotCall {
	return async (method, params) => {
		const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(params),
			signal: AbortSignal.timeout((POLL_TIMEOUT + 15) * 1000),
		})
		const body = (await response.json()) as { ok: boolean; result?: unknown; description?: string }

		if (!body.ok) throw new Error(`${method}: ${body.description}`)

		return body.result
	}
}

/** Отвечает на пачку апдейтов и возвращает offset для следующего getUpdates. */
export async function handleUpdates(updates: Update[], offset: number, appUrl: string, call: BotCall) {
	for (const update of updates) {
		offset = Math.max(offset, update.update_id + 1)

		const reply = replyTo(update, appUrl)

		if (!reply) continue

		const { method, ...params } = reply

		try {
			await call(String(method), params)
		} catch (error) {
			// Один недоставленный ответ (бот заблокирован) не должен стопорить очередь.
			console.error('telegram reply', (error as Error).message)
		}
	}

	return offset
}

/** Бесконечный цикл long polling. Ошибки сети не роняют процесс, а откладывают следующую попытку. */
export async function runBot(call: BotCall, appUrl: string) {
	// getUpdates не работает, пока у бота стоит webhook.
	await call('deleteWebhook', {}).catch((error) => console.error('telegram', error.message))

	await call('setChatMenuButton', {
		menu_button: { type: 'web_app', text: 'WODlog', web_app: { url: appUrl } },
	}).catch((error) => console.error('telegram', error.message))

	let offset = 0

	for (;;) {
		try {
			const updates = (await call('getUpdates', {
				offset,
				timeout: POLL_TIMEOUT,
				allowed_updates: ['message'],
			})) as Update[]

			offset = await handleUpdates(updates, offset, appUrl, call)
		} catch (error) {
			console.error('telegram poll', (error as Error).message)
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
		}
	}
}
