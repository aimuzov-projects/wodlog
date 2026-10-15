/**
 * Бот: только приветствие с кнопкой, которая открывает Mini App.
 *
 * Telegram шлёт апдейты на webhook, а ответ уходит прямо в теле HTTP-ответа (метод Bot API
 * вместо JSON). Так бэкенду не нужны исходящие запросы к Telegram, которые с сервера идут
 * только через VPN.
 */

type Update = {
	message?: {
		chat?: { id?: number; type?: string }
		text?: string
	}
}

const GREETING = `Привет! Это WODlog — дневник кроссфит-тренировок.

Сфотографируйте доску с тренировкой дня, вносите свои раунды, время и веса, смотрите рейтинг зала и включайте таймер.`

/** Ответ на апдейт в виде вызова Bot API или `null`, если отвечать нечего. */
export function replyTo(update: Update, appUrl: string): Record<string, unknown> | null {
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
