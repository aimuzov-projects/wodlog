<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { plural } from '#frontend/lib/format.ts'
	import { swipe } from '#frontend/lib/swipe.ts'
	import { insideTelegram } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import { formatClock } from '#shared/timer.ts'

	const PHASE_LABELS = { prep: 'Приготовиться', work: 'Работа', rest: 'Отдых', done: 'Готово' }

	const session = $derived(timer.session)
	const view = $derived(timer.view)

	// Таймер из комплекса по окончании сам открывает форму результата. Пауза перед этим -- чтобы
	// успеть увидеть «Готово» и услышать финальный сигнал.
	$effect(() => {
		if (!timer.finished || !session?.source) return

		const id = setTimeout(() => app.showTimerResult(), 1500)

		return () => clearTimeout(id)
	})

	/** Закрыть экран: таймер при этом продолжает идти. */
	function hide() {
		app.back()
	}

	/** Завершить совсем: из комплекса -- к записи результата, иначе просто закрыть. */
	function end() {
		if (session?.source && (timer.elapsedMs > 0 || timer.finished)) app.showTimerResult()
		else {
			timer.close()
			app.back()
		}
	}

	// «1 раунд», «3 раунда», «5 раундов» -- без самого числа, оно крупно над подписью.
	const lapsLabel = (n: number) => plural(n, ['раунд', 'раунда', 'раундов']).replace(/^\d+ /, '')

	const countsDown = $derived(session?.config.mode !== 'for_time' || view?.phase === 'prep')
	const progress = $derived.by(() => {
		if (!view || !session) return 0

		if (view.phase === 'done') return 1

		if (view.phaseLeftMs === Infinity) return 0

		const config = session.config
		const length =
			view.phase === 'prep'
				? 10_000
				: config.mode === 'emom'
					? config.intervalSec * 1000
					: config.mode === 'intervals'
						? (view.phase === 'work' ? config.workSec : config.restSec) * 1000
						: config.mode === 'amrap'
							? config.durationSec * 1000
							: (config.capSec ?? 0) * 1000

		return length ? 1 - view.phaseLeftMs / length : 0
	})
</script>

{#if session && view}
	<section
		class="timer-run timer-run--{view.phase}"
		style:--progress={progress}
		use:swipe={{ onswipe: hide, allowed: (direction) => direction === 'right' }}
	>
		<!-- В Telegram свернуть таймер можно его системной «Назад», своя кнопка нужна только в браузере. -->
		<header class="timer-run__header">
			{#if !insideTelegram()}
				<button class="btn btn--small timer-run__close" aria-label="Свернуть таймер" onclick={hide}>
					<Icon name="down" size={20} />
				</button>
			{/if}
			<h1 class="timer-run__title">{session.title}</h1>
		</header>

		<!-- Весь экран -- одна большая кнопка: на подготовке тап пропускает отсчёт, в работе засчитывает круг. -->
		<button
			class="timer-run__face"
			onclick={() => (view.phase === 'prep' ? timer.skipPrep() : timer.lap())}
			aria-label={view.phase === 'prep' ? 'Пропустить отсчёт' : 'Засчитать круг'}
		>
			<span class="timer-run__phase">{PHASE_LABELS[view.phase]}</span>
			<span class="timer-run__clock">{formatClock(view.displayMs, countsDown)}</span>

			<!-- Круги видно так же хорошо, как время: на них смотрят посреди комплекса, издалека. -->
			{#if view.phase === 'prep'}
				<span class="timer-run__tap">тап по экрану — сразу к работе</span>
			{:else if view.rounds}
				<span class="timer-run__laps">
					<span class="timer-run__laps-value"
						>{Math.max(1, view.round)}<small class="timer-run__of">/{view.rounds}</small></span
					>
					<span class="timer-run__laps-label">раунд</span>
				</span>
			{:else}
				<span class="timer-run__laps">
					{#key session.laps}
						<span class="timer-run__laps-value timer-run__laps-value--bump">{session.laps}</span>
					{/key}
					<span class="timer-run__laps-label">{lapsLabel(session.laps)}</span>
				</span>
				{#if view.phase === 'work'}<span class="timer-run__tap">тап по экрану — засчитать круг</span>{/if}
			{/if}
			{#if session.config.mode === 'for_time' && session.config.capSec}
				<span class="timer-run__cap">лимит {formatClock(session.config.capSec * 1000)}</span>
			{/if}
		</button>

		<!-- Вспышка на каждый засчитанный круг: перезапускается сменой ключа. -->
		{#key session.laps}
			{#if session.laps}<span class="timer-run__flash" aria-hidden="true"></span>{/if}
		{/key}

		<div class="timer-run__progress"></div>

		<button class="btn btn--wide timer-run__end" onclick={end}>Завершить</button>
	</section>
{/if}

<style>
	.timer-run {
		--phase: var(--accent);
		/* Где стоит остров в верхней полосе: из него экран и вырастает. */
		--island-top: calc(var(--safe-top) + 8px);

		position: fixed;
		inset: 0;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		padding: calc(var(--safe-top) + 8px) var(--gutter) calc(var(--safe-bottom) + 16px);
		color: #ffffff;
		background: #0b0b0e;
		transition: background 0.3s ease;
		animation: expand 0.42s cubic-bezier(0.32, 0.72, 0, 1);

		/* Шапка уходит в полосу Telegram и из сетки выпадает: строк на одну меньше. */
		:global(html[data-fullscreen]) & {
			--island-top: calc(
				var(--tg-safe-area-inset-top, 0px) + (var(--tg-content-safe-area-inset-top, 0px) - 34px) / 2
			);

			grid-template-rows: 1fr auto auto;
		}

		/* Содержимое проявляется, когда чёрное уже почти заполнило экран. */
		& > * {
			animation: appear 0.3s ease 0.2s backwards;
		}

		/* Кнопка «Свернуть» (только в браузере) слева, название режима ровно по центру экрана. */
		&__header {
			position: relative;
			display: grid;
			place-items: center;
			min-height: 36px;

			/* В полноэкранном Telegram -- в его верхней полосе, между «Назад» и «⌄ •••». */
			:global(html[data-fullscreen]) & {
				position: absolute;
				top: 0;
				right: 0;
				left: 0;
				height: calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px));
				padding-top: var(--tg-safe-area-inset-top, 0px);
			}
		}

		&__close {
			position: absolute;
			left: 0;
			color: #ffffff;
			background: rgb(255 255 255 / 12%);
		}

		&__title {
			font-size: 1.05rem;
			font-weight: 700;
		}

		&__end {
			color: #ffffff;
			background: rgb(255 255 255 / 12%);
		}

		&__face {
			user-select: none;
			display: grid;
			gap: 8px;
			place-content: center;
			border: 0;
			color: inherit;
			text-align: center;
			background: none;
		}

		&__phase {
			font-size: 1.2rem;
			font-weight: 800;
			color: var(--phase);
			text-transform: uppercase;
			letter-spacing: 0.12em;
		}

		&__clock {
			font-family: var(--font-mono);
			font-size: clamp(4.5rem, 24vw, 12rem);
			font-weight: 800;
			font-variant-numeric: tabular-nums;
			line-height: 1;
			letter-spacing: -0.04em;
		}

		&__laps {
			display: grid;
			justify-items: center;
			margin-top: 12px;
		}

		&__laps-value {
			font-family: var(--font-mono);
			font-size: clamp(3.5rem, 18vw, 8rem);
			font-weight: 800;
			font-variant-numeric: tabular-nums;
			line-height: 1;
			color: var(--phase);
		}

		&__laps-value--bump {
			animation: bump 0.35s ease-out;
		}

		&__of {
			font-size: 0.45em;
			opacity: 0.6;
		}

		&__laps-label {
			font-size: 1rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			opacity: 0.7;
		}

		&__flash {
			pointer-events: none;
			position: absolute;
			inset: 0;
			opacity: 0;
			background: var(--phase);
			animation: flash 0.45s ease-out;
		}

		&__tap,
		&__cap {
			font-size: 0.85rem;
			opacity: 0.6;
		}

		&__progress {
			height: 6px;
			margin-bottom: 16px;
			border-radius: 3px;
			background: linear-gradient(
				to right,
				var(--phase) calc(var(--progress) * 100%),
				rgb(255 255 255 / 12%) calc(var(--progress) * 100%)
			);
		}
	}

	.timer-run--prep {
		--phase: #f5b301;
	}

	.timer-run--work {
		--phase: #2ecc71;
	}

	.timer-run--rest {
		--phase: #3fa7ff;

		background: #071726;
	}

	.timer-run--done {
		--phase: #ff4f1a;
	}

	/* Засчитанный круг: экран вспыхивает цветом фазы, число подпрыгивает. */
	/* Экран вырастает из острова: капсула 140×34 сверху по центру раскрывается на весь экран. */
	@keyframes expand {
		from {
			clip-path: inset(
				var(--island-top) calc(50% - 70px) calc(100% - var(--island-top) - 34px) calc(50% - 70px) round 17px
			);
		}

		to {
			clip-path: inset(0 0 0 0 round 0);
		}
	}

	@keyframes appear {
		from {
			opacity: 0;
		}
	}

	@keyframes flash {
		from {
			opacity: 0.35;
		}

		to {
			opacity: 0;
		}
	}

	@keyframes bump {
		30% {
			transform: scale(1.25);
		}

		to {
			transform: scale(1);
		}
	}
</style>
