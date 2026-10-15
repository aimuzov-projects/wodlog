<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { confirmAction, haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import { formatClock, totalMs, type TimerConfig } from '#shared/timer.ts'

	type Preset = 'for_time' | 'amrap' | 'emom' | 'tabata' | 'intervals'

	const LABELS: Record<Preset, string> = {
		for_time: 'For Time',
		amrap: 'AMRAP',
		emom: 'EMOM',
		tabata: 'Tabata',
		intervals: 'Интервалы',
	}
	const STORAGE_KEY = 'wodlog.timer'

	// Последние настройки переживают перезапуск: обычно таймер ставят на одно и то же.
	const saved = (() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
		} catch {
			return {}
		}
	})()

	let preset = $state<Preset>(saved.preset ?? 'amrap')
	let capMin = $state<number>(saved.capMin ?? 0)
	let amrapMin = $state<number>(saved.amrapMin ?? 12)
	let emomSec = $state<number>(saved.emomSec ?? 60)
	let emomRounds = $state<number>(saved.emomRounds ?? 10)
	let workSec = $state<number>(saved.workSec ?? 40)
	let restSec = $state<number>(saved.restSec ?? 20)
	let rounds = $state<number>(saved.rounds ?? 8)

	const config = $derived.by((): TimerConfig => {
		switch (preset) {
			case 'for_time':
				return { mode: 'for_time', capSec: capMin > 0 ? capMin * 60 : null }
			case 'amrap':
				return { mode: 'amrap', durationSec: Math.max(1, amrapMin) * 60 }
			case 'emom':
				return { mode: 'emom', intervalSec: Math.max(5, emomSec), rounds: Math.max(1, emomRounds) }
			case 'tabata':
				return { mode: 'intervals', workSec: 20, restSec: 10, rounds: 8 }
			case 'intervals':
				return {
					mode: 'intervals',
					workSec: Math.max(5, workSec),
					restSec: Math.max(0, restSec),
					rounds: Math.max(1, rounds),
				}
		}
	})
	const total = $derived(totalMs(config))

	async function start() {
		if (timer.session && !timer.finished && !(await confirmAction('Другой таймер ещё идёт. Запустить новый?')))
			return

		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ preset, capMin, amrapMin, emomSec, emomRounds, workSec, restSec, rounds }),
			)
		} catch {
			// Не запомним -- не страшно.
		}

		haptic('medium')
		timer.start(config, LABELS[preset], null)
		app.open({ name: 'timer' })
	}
</script>

{#snippet stepper(label: string, value: number, set: (v: number) => void, step: number, min: number, unit: string)}
	<div class="timer-setup__stepper">
		<span class="field__label">{label}</span>
		<div class="timer-setup__controls">
			<button
				class="btn timer-setup__step"
				aria-label={`${label}: меньше`}
				onclick={() => set(Math.max(min, value - step))}>−</button
			>
			<span class="timer-setup__value">{value}<small class="timer-setup__unit">{unit}</small></span>
			<button class="btn timer-setup__step" aria-label={`${label}: больше`} onclick={() => set(value + step)}
				>+</button
			>
		</div>
	</div>
{/snippet}

<section class="timer-setup">
	<h1 class="timer-setup__title">Таймер</h1>

	<div class="chips">
		{#each Object.entries(LABELS) as [id, label] (id)}
			<button
				class="chip"
				class:chip--active={preset === id}
				onclick={() => {
					haptic('select')
					preset = id as Preset
				}}>{label}</button
			>
		{/each}
	</div>

	<div class="card timer-setup__params">
		{#if preset === 'for_time'}
			{@render stepper('Кап', capMin, (v) => (capMin = v), 1, 0, 'мин')}
			<p class="muted timer-setup__hint">0 — без капа, секундомер до остановки.</p>
		{:else if preset === 'amrap'}
			{@render stepper('Длительность', amrapMin, (v) => (amrapMin = v), 1, 1, 'мин')}
		{:else if preset === 'emom'}
			{@render stepper('Интервал', emomSec, (v) => (emomSec = v), 15, 15, 'сек')}
			{@render stepper('Раунды', emomRounds, (v) => (emomRounds = v), 1, 1, '')}
		{:else if preset === 'tabata'}
			<p>8 раундов: 20 секунд работы, 10 секунд отдыха.</p>
		{:else}
			{@render stepper('Работа', workSec, (v) => (workSec = v), 5, 5, 'сек')}
			{@render stepper('Отдых', restSec, (v) => (restSec = v), 5, 0, 'сек')}
			{@render stepper('Раунды', rounds, (v) => (rounds = v), 1, 1, '')}
		{/if}
	</div>

	<p class="muted timer-setup__total">
		{total === Infinity ? 'Без ограничения по времени' : `Всего ${formatClock(total)} + 10 секунд на подготовку`}
	</p>

	<button class="btn btn--primary btn--wide timer-setup__start" onclick={start}>
		<Icon name="play" /> Старт
	</button>
</section>

<style>
	.timer-setup {
		display: grid;
		gap: 14px;

		&__title {
			font-family: var(--font-display);
			font-size: 1.8rem;
			font-weight: 800;
		}

		&__params {
			display: grid;
			gap: 18px;
		}

		&__stepper {
			display: grid;
			gap: 8px;
		}

		&__controls {
			display: grid;
			grid-template-columns: 64px 1fr 64px;
			align-items: center;
		}

		&__step {
			font-size: 1.6rem;
		}

		&__value {
			font-family: var(--font-mono);
			font-size: 2.2rem;
			font-weight: 800;
			text-align: center;
		}

		&__unit {
			margin-left: 4px;
			font-size: 1rem;
			font-weight: 600;
			color: var(--muted);
		}

		&__hint,
		&__total {
			font-size: 0.85rem;
		}

		&__start {
			min-height: 60px;
			font-size: 1.2rem;
		}
	}
</style>
