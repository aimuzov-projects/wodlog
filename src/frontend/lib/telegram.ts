/**
 * Обвязка Telegram Mini App поверх `telegram-web-app.js`.
 *
 * Скрипт подключается в `layouts/app.astro` и создаёт `window.Telegram.WebApp` и вне Telegram,
 * просто с пустым `initData`. По нему и понимаем, что открыты в обычном браузере.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

type BottomButton = {
	show(): void
	hide(): void
	onClick(cb: () => void): void
	offClick(cb: () => void): void
}

export type WebApp = {
	initData: string
	initDataUnsafe: { start_param?: string }
	platform: string
	colorScheme: 'light' | 'dark'
	isVersionAtLeast(version: string): boolean
	ready(): void
	expand(): void
	requestFullscreen?(): void
	disableVerticalSwipes?(): void
	setHeaderColor?(color: string): void
	setBackgroundColor?(color: string): void
	openTelegramLink(url: string): void
	showConfirm?(message: string, callback: (ok: boolean) => void): void
	BackButton: BottomButton
	HapticFeedback?: {
		impactOccurred(style: HapticStyle): void
		notificationOccurred(type: 'error' | 'success' | 'warning'): void
		selectionChanged(): void
	}
}

declare global {
	// Только interface: поле добавляется к Window через declaration merging.
	// oxlint-disable-next-line typescript/consistent-type-definitions
	interface Window {
		Telegram?: { WebApp?: WebApp }
	}
}

export const webApp = (): WebApp | null => window.Telegram?.WebApp ?? null

/** Открыты внутри Telegram: только там есть подписанный initData. */
export const insideTelegram = () => Boolean(webApp()?.initData)

const MOBILE = new Set(['ios', 'android', 'android_x'])

/** Готовит Mini App: на телефоне во весь экран и без закрытия свайпом вниз, чтобы не мешать таймеру. */
export function initTelegram() {
	const app = webApp()

	if (!app || !app.initData) return

	app.ready()
	app.expand()

	if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.()

	if (MOBILE.has(app.platform) && app.isVersionAtLeast('8.0')) app.requestFullscreen?.()

	if (app.isVersionAtLeast('6.1')) {
		app.setHeaderColor?.('bg_color')
		app.setBackgroundColor?.('bg_color')
	}

	document.documentElement.dataset.telegram = app.platform
}

export function haptic(kind: HapticStyle | 'success' | 'error' | 'warning' | 'select' = 'light') {
	const feedback = webApp()?.HapticFeedback

	if (!feedback || !insideTelegram()) {
		// В браузере хватит короткой вибрации, если её вообще поддерживают.
		if (kind === 'heavy' || kind === 'error') navigator.vibrate?.(80)

		return
	}

	if (kind === 'select') feedback.selectionChanged()
	else if (kind === 'success' || kind === 'error' || kind === 'warning') feedback.notificationOccurred(kind)
	else feedback.impactOccurred(kind)
}

/** Подтверждение действия. В Telegram на iOS `window.confirm` молча не показывается, нужен свой диалог. */
export function confirmAction(message: string): Promise<boolean> {
	const app = webApp()

	if (app?.showConfirm && insideTelegram() && app.isVersionAtLeast('6.2'))
		return new Promise((resolve) => app.showConfirm!(message, resolve))

	return Promise.resolve(window.confirm(message))
}

let backHandler: (() => void) | null = null

/** Системная кнопка «Назад» Telegram. `null` прячет её. */
export function setBackButton(handler: (() => void) | null) {
	const button = webApp()?.BackButton

	if (!button || !insideTelegram()) return

	if (backHandler) button.offClick(backHandler)

	backHandler = handler

	if (handler) {
		button.onClick(handler)
		button.show()
	} else {
		button.hide()
	}
}

/** Код приглашения из `startapp=gym_<code>` или из `?invite=` (кнопка в чате с ботом). */
export function inviteFromLaunch(startParam: string | null): string | null {
	const param = startParam ?? webApp()?.initDataUnsafe.start_param ?? ''

	if (param.startsWith('gym_')) return param.slice(4)

	return new URLSearchParams(location.search).get('invite')
}
