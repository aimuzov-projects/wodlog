import { createHmac } from 'node:crypto'

/** initData, подписанный так же, как это делает Telegram. Только для тестов. */
export function signInitData(fields: Record<string, string>, token: string) {
	const check = Object.keys(fields)
		.sort()
		.map((k) => `${k}=${fields[k]}`)
		.join('\n')
	const secret = createHmac('sha256', 'WebAppData').update(token).digest()
	const hash = createHmac('sha256', secret).update(check).digest('hex')

	return new URLSearchParams({ ...fields, hash }).toString()
}
