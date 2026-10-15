<script lang="ts">
	import { app } from '#frontend/state/app.svelte.ts'
	import { PART_KIND_LABELS } from '#shared/types.ts'

	const TITLES: Record<string, string> = {
		'timer-setup': 'Таймер',
		rating: 'Рейтинг',
		profile: 'Профиль',
		gyms: 'Залы',
		editor: 'Тренировка',
	}

	const title = $derived.by(() => {
		const screen = app.screen

		if (screen?.name === 'part') return screen.part.title || PART_KIND_LABELS[screen.part.kind]

		if (screen) return TITLES[screen.name] ?? ''

		// Без входа доступен только таймер.
		if (app.status === 'timer') return 'Таймер'

		return app.gym ? 'Тренировка' : 'Ваш зал'
	})
</script>

<!--
	Верхняя полоса полноэкранного Telegram: заголовок между его кнопками «Назад» и «⌄ •••», как
	в нативных приложениях, а под размытием видно, что контент уходит наверх, а не обрезается.
	Вне полноэкранного режима полосы нет, заголовок остаётся на экране.
	Лежит вне main: у того transform для свайпа, и fixed внутри него не держался бы у края.
-->
<div class="top-bar">{title}</div>

<style>
	.top-bar {
		display: none;

		:global(html[data-fullscreen]) & {
			position: fixed;
			z-index: 15;
			top: 0;
			right: 0;
			left: 0;
			overflow: hidden;
			display: grid;
			place-items: center;
			height: calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px));
			/* Отступы по бокам -- под кнопки Telegram, чтобы длинный заголовок под них не заезжал. */
			padding: var(--tg-safe-area-inset-top, 0px) 120px 0;
			font-size: 1.05rem;
			font-weight: 700;
			text-overflow: ellipsis;
			white-space: nowrap;
			background: color-mix(in srgb, var(--bg) 72%, transparent);
			/* Без префикса Safari умеет только с iOS 18. */
			-webkit-backdrop-filter: blur(20px) saturate(1.4);
			backdrop-filter: blur(20px) saturate(1.4);
		}
	}
</style>
