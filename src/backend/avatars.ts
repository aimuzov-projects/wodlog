/**
 * Аватарки Telegram через свой домен.
 *
 * Telegram отдаёт ссылки вида `https://t.me/i/userpic/320/….svg`, а t.me в России заблокирован,
 * и у участников вместо фото оставались инициалы. Поэтому сервер скачивает картинку через VPN
 * и держит копию на диске, а клиенту отдаёт `/api/avatars/<id>`.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Image = { type: string; body: Buffer }

/** Скачивание картинки по адресу. Подменяется в тестах. */
export type Download = (url: string) => Promise<Image>

const MAX_SIZE = 2 * 1024 * 1024
const TIMEOUT = 15_000
// Только картинки Telegram: адрес приходит от клиента, хоть и подписанный.
const ALLOWED_HOSTS = /(^|\.)(t\.me|telegram\.org|telesco\.pe|cdn-telegram\.org)$/

export const avatarVersion = (photoUrl: string) => createHash('sha256').update(photoUrl).digest('hex').slice(0, 12)

export function isTelegramImage(url: string) {
	try {
		const parsed = new URL(url)

		return parsed.protocol === 'https:' && ALLOWED_HOSTS.test(parsed.hostname)
	} catch {
		return false
	}
}

export const download: Download = async (url) => {
	const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), redirect: 'follow' })
	const type = response.headers.get('content-type')?.split(';')[0].trim() ?? ''

	if (!response.ok || !type.startsWith('image/')) throw new Error(`avatar ${response.status} ${type}`)

	const body = Buffer.from(await response.arrayBuffer())

	if (body.length > MAX_SIZE) throw new Error(`avatar too big: ${body.length}`)

	return { type, body }
}

/**
 * Копии аватарок на диске. Ключ -- хеш адреса: Telegram меняет адрес вместе с фото,
 * так что новое фото скачается само, а старое просто останется лежать.
 */
export class AvatarCache {
	readonly dir: string
	readonly download: Download
	// Одновременные запросы одной аватарки ждут одно скачивание.
	#pending = new Map<string, Promise<Image>>()

	constructor(dir: string, fetchImage: Download = download) {
		this.dir = dir
		this.download = fetchImage
	}

	async get(photoUrl: string): Promise<Image> {
		const key = avatarVersion(photoUrl)
		const [bodyPath, typePath] = [join(this.dir, key), join(this.dir, `${key}.type`)]

		try {
			return { type: await readFile(typePath, 'utf8'), body: await readFile(bodyPath) }
		} catch {
			// В кэше нет -- скачиваем.
		}

		let pending = this.#pending.get(key)

		if (!pending) {
			pending = this.download(photoUrl).then(async (image) => {
				await mkdir(this.dir, { recursive: true })
				await writeFile(bodyPath, image.body)
				await writeFile(typePath, image.type)

				return image
			})

			this.#pending.set(key, pending)
			void pending.catch(() => {}).finally(() => this.#pending.delete(key))
		}

		return pending
	}
}
