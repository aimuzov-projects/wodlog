<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte'

	import Icon from '#frontend/components/icon.svelte'
	import { beep, keepAwake, unlockAudio } from '#frontend/lib/sound.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { formatClock, Stopwatch, timerState, type TimerConfig, type TimerState } from '#shared/timer.ts'

	let { config, title }: { config: TimerConfig; title: string } = $props()

	const PHASE_LABELS = { prep: 'Приготовиться', work: 'Работа', rest: 'Отдых', done: 'Готово' }

	const watch = new Stopwatch()

	let view = $state<TimerState>(untrack(() => timerState(config, 0)))
	let running = $state(false)
	// Раунды, которые спортсмен отмечает сам: в AMRAP и For Time таймер их не знает.
	let laps = $state(0)
	let frame = 0
	let lastSecond = -1
	let lastPhase = ''

	function tick() {
		const next = timerState(config, watch.elapsed(performance.now()))
		const second = Math.ceil(next.phaseLeftMs / 1000)

		// Сигналы на переходах: 3-2-1 перед концом отрезка и длинный на смену.
		if (`${next.phase}:${next.round}` !== lastPhase && lastPhase) {
			beep(next.phase === 'done' ? 'end' : 'go')
			haptic(next.phase === 'done' ? 'success' : 'heavy')
		} else if (second !== lastSecond && second <= 3 && second > 0 && next.phaseLeftMs !== Infinity) {
			beep('tick')
		}

		lastSecond = second
		lastPhase = `${next.phase}:${next.round}`
		view = next

		if (next.phase === 'done') {
			running = false
			watch.pause(performance.now())
			void keepAwake(false)

			return
		}

		frame = requestAnimationFrame(tick)
	}

	function toggle() {
		unlockAudio()
		haptic('medium')

		if (running) {
			watch.pause(performance.now())
			cancelAnimationFrame(frame)
			running = false
			void keepAwake(false)
		} else {
			if (view.phase === 'done') reset()

			watch.start(performance.now())
			running = true
			void keepAwake(true)
			frame = requestAnimationFrame(tick)
		}
	}

	function reset() {
		cancelAnimationFrame(frame)
		watch.reset()
		running = false
		laps = 0
		lastSecond = -1
		lastPhase = ''
		view = timerState(config, 0)
		void keepAwake(false)
	}

	function lap() {
		if (view.phase !== 'work') return

		haptic('light')
		laps += 1
	}

	// Вернулись на вкладку -- экран снова не должен гаснуть, Wake Lock снимается при уходе.
	function onVisibility() {
		if (document.visibilityState === 'visible' && running) void keepAwake(true)
	}

	onMount(() => document.addEventListener('visibilitychange', onVisibility))

	onDestroy(() => {
		cancelAnimationFrame(frame)
		void keepAwake(false)
		document.removeEventListener('visibilitychange', onVisibility)
	})

	const countsDown = $derived(config.mode !== 'for_time' || view.phase === 'prep')
	const progress = $derived.by(() => {
		if (view.phase === 'done') return 1

		if (view.phaseLeftMs === Infinity) return 0

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

<section class="timer-run timer-run--{view.phase}" style:--progress={progress}>
	<header class="timer-run__header">
		<button class="btn btn--small timer-run__close" aria-label="Закрыть таймер" onclick={() => app.back()}>
			<Icon name="close" size={20} />
		</button>
		<span class="timer-run__title">{title}</span>
	</header>

	<button class="timer-run__face" onclick={lap} aria-label="Отметить раунд">
		<span class="timer-run__phase">{PHASE_LABELS[view.phase]}</span>
		<span class="timer-run__clock">{formatClock(view.displayMs, countsDown)}</span>
		{#if view.rounds}
			<span class="timer-run__round">Раунд {Math.max(1, view.round)} / {view.rounds}</span>
		{:else if view.phase !== 'prep'}
			<span class="timer-run__round">Раундов: {laps}</span>
			{#if view.phase === 'work'}<span class="timer-run__tap">тап по экрану — +1 раунд</span>{/if}
		{/if}
		{#if config.mode === 'for_time' && config.capSec}
			<span class="timer-run__cap">кап {formatClock(config.capSec * 1000)}</span>
		{/if}
	</button>

	<div class="timer-run__progress"></div>

	<footer class="timer-run__controls">
		<button class="btn timer-run__button" aria-label="Сбросить" onclick={reset}
			><Icon name="reset" size={28} /></button
		>
		<button class="btn btn--primary timer-run__button timer-run__button--main" onclick={toggle}>
			<Icon name={running ? 'pause' : 'play'} size={32} />
			{running
				? 'Пауза'
				: view.phase === 'done'
					? 'Заново'
					: watch.running || view.workElapsedMs
						? 'Дальше'
						: 'Старт'}
		</button>
		{#if config.mode === 'for_time'}
			<button
				class="btn timer-run__button"
				aria-label="Финиш"
				disabled={view.phase !== 'work'}
				onclick={() => {
					watch.pause(performance.now())
					cancelAnimationFrame(frame)
					running = false
					haptic('success')
					beep('end')
					void keepAwake(false)
				}}>Финиш</button
			>
		{/if}
	</footer>
</section>

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
			font-weight: 700;
			opacity: 0.8;
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
