/**
 * Регистрирует сервис-воркер, его собирает `integrations/pwa.ts` при сборке.
 *
 * Новый воркер сразу берёт управление, а страница перезагружается на смене контроллера:
 * иначе люди неделями сидели бы на старой версии. В dev воркера нет.
 */
export function registerServiceWorker() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

	// Первый захват контроллера на чистой установке -- не обновление, перезагружать незачем.
	let reloading = !navigator.serviceWorker.controller

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading) {
			reloading = false

			return
		}

		reloading = true
		location.reload()
	})

	navigator.serviceWorker.register('/sw.js').catch(() => {
		// Без воркера приложение работает, только не офлайн.
	})
}
