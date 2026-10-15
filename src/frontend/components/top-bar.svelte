<script lang="ts">
	import { app } from '#frontend/state/app.svelte.ts'

	// У главного экрана своя шапка с датой, у комплекса заголовок в карточке.
	const TITLES: Partial<Record<string, string>> = {
		'timer-setup': 'Таймер',
		rating: 'Рейтинг',
		gyms: 'Залы',
		editor: 'Тренировка',
	}

	// Без входа доступен только таймер.
	const title = $derived(app.screen ? TITLES[app.screen.name] : app.status === 'timer' ? 'Таймер' : undefined)
</script>

<!--
	Заголовок в верхней полосе полноэкранного Telegram, между его кнопками «Назад» и «⌄ •••»,
	как в нативных приложениях. Вне полноэкранного режима полосы нет, заголовок остаётся на экране.
	Лежит вне main: у того transform для свайпа, и fixed внутри него не держался бы у края.
-->
{#if title}
	<div class="top-bar">{title}</div>
{/if}

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
			background: var(--bg);
		}
	}
</style>
