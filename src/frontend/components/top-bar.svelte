<script lang="ts">
	import { scale } from 'svelte/transition'

	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import { formatClock } from '#shared/timer.ts'
	import { PART_KIND_LABELS } from '#shared/types.ts'

	const TITLES: Record<string, string> = {
		'timer-setup': 'Таймер',
		rating: 'Рейтинг',
		profile: 'Профиль',
		gyms: 'Залы',
		editor: 'Тренировка',
	}

	/** Сколько показывать заголовок раздела, прежде чем на его место вернётся остров таймера. */
	const TITLE_MS = 1500

	const title = $derived.by(() => {
		const screen = app.screen

		if (screen?.name === 'part') return screen.part.title || PART_KIND_LABELS[screen.part.kind]

		if (screen) return TITLES[screen.name] ?? ''

		// Без входа доступен только таймер.
		if (app.status === 'timer') return 'Таймер'

		return app.gym ? 'Тренировка' : 'Ваш зал'
	})

	const session = $derived(timer.session)
	const view = $derived(timer.view)
	const countsDown = $derived(session?.config.mode !== 'for_time' || view?.phase === 'prep')
	const resultPending = $derived(timer.finished && Boolean(session?.source))

	// При переходе в раздел сначала видно, куда пришёл, а потом на место заголовка снова встаёт таймер.
	let showTitle = $state(true)

	$effect(() => {
		void title

		if (!session) return

		showTitle = true

		const id = setTimeout(() => (showTitle = false), TITLE_MS)

		return () => clearTimeout(id)
	})

	const island = $derived(Boolean(session && view) && !showTitle)

	function open() {
		if (resultPending) app.showTimerResult()
		else app.open({ name: 'timer' })
	}
</script>

<!--
	Верхняя полоса. В полноэкранном Telegram -- между его кнопками «Назад» и «⌄ •••», как в нативных
	приложениях, а под размытием видно, что контент уходит наверх, а не обрезается. Пока запущен
	таймер, здесь же живёт его «остров» в духе Dynamic Island: время, круги, тап -- к таймеру.
	Вне полноэкранного режима полосы нет, заголовок остаётся на экране, а остров висит сверху сам.
	Лежит вне main: у того transform для свайпа, и fixed внутри него не держался бы у края.
-->
<div class="top-bar" class:top-bar--island={island}>
	{#if island && session && view}
		<button
			class="top-bar__island top-bar__island--{view.phase}"
			aria-label="Открыть таймер"
			onclick={open}
			in:scale={{ start: 0.6, duration: 220 }}
		>
			<span class="top-bar__dot"></span>
			{#if resultPending}
				<span class="top-bar__action">Записать результат</span>
			{:else}
				<span class="top-bar__clock">{formatClock(view.displayMs, countsDown)}</span>
				{#if view.rounds}
					<span class="top-bar__laps">{Math.max(1, view.round)}/{view.rounds}</span>
				{:else if session.laps}
					<span class="top-bar__laps">{session.laps} р.</span>
				{/if}
			{/if}
		</button>
	{:else}
		<span class="top-bar__title" in:scale={{ start: 0.9, duration: 180 }}>{title}</span>
	{/if}
</div>

<style>
	.top-bar {
		display: none;

		/* Вне полноэкранного режима -- только остров, сам по себе, сверху по центру. */
		&--island {
			pointer-events: none;
			position: fixed;
			z-index: 15;
			top: calc(var(--safe-top) + 8px);
			right: 0;
			left: 0;
			display: grid;
			place-items: center;
		}

		:global(html[data-fullscreen]) & {
			pointer-events: auto;
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
			padding: var(--tg-safe-area-inset-top, 0px) 110px 0;
			background: color-mix(in srgb, var(--bg) 72%, transparent);
			/* Без префикса Safari умеет только с iOS 18. */
			-webkit-backdrop-filter: blur(20px) saturate(1.4);
			backdrop-filter: blur(20px) saturate(1.4);
		}

		&__title {
			overflow: hidden;
			max-width: 100%;
			font-size: 1.05rem;
			font-weight: 700;
			text-overflow: ellipsis;
			white-space: nowrap;

			/* Вне полноэкранного режима заголовок и так крупно на экране. */
			:global(html:not([data-fullscreen])) & {
				display: none;
			}
		}

		&__island {
			--phase: var(--accent);
			pointer-events: auto;

			display: flex;
			gap: 10px;
			align-items: center;
			height: 34px;
			padding: 0 16px 0 12px;
			border: 0;
			border-radius: 999px;
			color: #ffffff;
			background: #000000;
		}

		&__island--prep {
			--phase: #f5b301;
		}

		&__island--work {
			--phase: #2ecc71;
		}

		&__island--rest {
			--phase: #3fa7ff;
		}

		&__island--done {
			--phase: #ff6a3d;
		}

		&__dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--phase);
			animation: pulse 1s ease-in-out infinite alternate;
		}

		&__clock {
			font-family: var(--font-mono);
			font-size: 1.05rem;
			font-weight: 800;
			font-variant-numeric: tabular-nums;
		}

		&__laps {
			font-size: 0.9rem;
			font-weight: 700;
			color: var(--phase);
		}

		&__action {
			font-size: 0.9rem;
			font-weight: 700;
			color: var(--phase);
		}
	}

	@keyframes pulse {
		from {
			opacity: 0.4;
		}

		to {
			opacity: 1;
		}
	}
</style>
