<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
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
	<section class="timer-run timer-run--{view.phase}" style:--progress={progress}>
		<header class="timer-run__header">
			<button class="btn btn--small timer-run__close" aria-label="Свернуть таймер" onclick={hide}>
				<Icon name="down" size={20} />
			</button>
			<span class="timer-run__title">{session.title}</span>
			<button class="btn btn--small timer-run__end" onclick={end}>Завершить</button>
		</header>

		<button class="timer-run__face" onclick={() => timer.lap()} aria-label="Отметить раунд">
			<span class="timer-run__phase">{PHASE_LABELS[view.phase]}</span>
			<span class="timer-run__clock">{formatClock(view.displayMs, countsDown)}</span>
			{#if view.rounds}
				<span class="timer-run__round">Раунд {Math.max(1, view.round)} / {view.rounds}</span>
			{:else if view.phase !== 'prep'}
				<span class="timer-run__round">Раундов: {session.laps}</span>
				{#if view.phase === 'work'}<span class="timer-run__tap">тап по экрану — +1 раунд</span>{/if}
			{/if}
			{#if session.config.mode === 'for_time' && session.config.capSec}
				<span class="timer-run__cap">кап {formatClock(session.config.capSec * 1000)}</span>
			{/if}
		</button>

		<div class="timer-run__progress"></div>

		<footer class="timer-run__controls">
			<button class="btn timer-run__button" aria-label="Сбросить" onclick={() => timer.reset()}
				><Icon name="reset" size={28} /></button
			>
			<button class="btn btn--primary timer-run__button timer-run__button--main" onclick={() => timer.toggle()}>
				<Icon name={timer.running ? 'pause' : 'play'} size={32} />
				{timer.running ? 'Пауза' : timer.finished ? 'Заново' : timer.elapsedMs ? 'Дальше' : 'Старт'}
			</button>
			{#if view.phase === 'prep'}
				<button class="btn timer-run__button" onclick={() => timer.skipPrep()}>Пропустить</button>
			{:else if session.config.mode === 'for_time'}
				<button
					class="btn timer-run__button"
					aria-label="Финиш"
					disabled={view.phase !== 'work'}
					onclick={() => timer.finish()}>Финиш</button
				>
			{/if}
		</footer>
	</section>
{/if}

<style>
	.timer-run {
		--phase: var(--accent);

		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		padding: calc(var(--safe-top) + 8px) var(--gutter) calc(var(--safe-bottom) + 16px);
		color: #ffffff;
		background: #0b0b0e;
		transition: background 0.3s ease;

		&__header {
			display: flex;
			gap: 12px;
			align-items: center;
		}

		&__close {
			color: #ffffff;
			background: rgb(255 255 255 / 12%);
		}

		&__title {
			flex: 1;
			font-weight: 700;
			opacity: 0.8;
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

		&__round {
			font-size: 1.4rem;
			font-weight: 700;
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

		&__controls {
			display: grid;
			grid-template-columns: 1fr 2fr 1fr;
			gap: 10px;
		}

		&__button {
			min-height: 72px;
			color: #ffffff;
			background: rgb(255 255 255 / 12%);
		}

		&__button--main {
			grid-column: 2;
			font-size: 1.2rem;
			color: var(--accent-fg);
			background: var(--accent);
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
</style>
