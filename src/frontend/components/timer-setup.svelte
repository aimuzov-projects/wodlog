<script lang="ts">
	import Stepper from '#frontend/components/stepper.svelte'
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import { confirmAction, haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import type { TimerConfig } from '#shared/timer.ts'

	type Preset = 'for_time' | 'amrap' | 'emom' | 'intervals'

	const LABELS: Record<Preset, string> = {
		for_time: 'For Time',
		amrap: 'AMRAP',
		emom: 'EMOM',
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

	// Сохранённый пресет мог быть убранной Tabata.
	let preset = $state<Preset>(saved.preset in LABELS ? saved.preset : 'amrap')
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
			case 'intervals':
				return {
					mode: 'intervals',
					workSec: Math.max(5, workSec),
					restSec: Math.max(0, restSec),
					rounds: Math.max(1, rounds),
				}
		}
	})

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

<section class="timer-setup">
	<ScreenTitle text="Таймер" />

	<div class="chips timer-setup__presets">
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
			<Stepper label="Кап" value={capMin} onchange={(v) => (capMin = v)} step={1} min={0} unit="мин" />
			<p class="muted timer-setup__hint">0 — без капа, секундомер до остановки.</p>
		{:else if preset === 'amrap'}
			<Stepper
				label="Длительность"
				value={amrapMin}
				onchange={(v) => (amrapMin = v)}
				step={1}
				min={1}
				unit="мин"
			/>
		{:else if preset === 'emom'}
			<Stepper label="Интервал" value={emomSec} onchange={(v) => (emomSec = v)} step={15} min={15} unit="сек" />
			<Stepper label="Раунды" value={emomRounds} onchange={(v) => (emomRounds = v)} step={1} min={1} unit="" />
		{:else}
			<Stepper label="Работа" value={workSec} onchange={(v) => (workSec = v)} step={5} min={5} unit="сек" />
			<Stepper label="Отдых" value={restSec} onchange={(v) => (restSec = v)} step={5} min={0} unit="сек" />
			<Stepper label="Раунды" value={rounds} onchange={(v) => (rounds = v)} step={1} min={1} unit="" />
		{/if}
	</div>

	<button class="btn btn--primary btn--wide timer-setup__start" onclick={start}>
		<Icon name="play" /> Старт
	</button>
</section>

<style>
	.timer-setup {
		display: grid;
		gap: 14px;

		/* Режимов немного: пусть лучше перенесутся, чем уедут за край экрана. */
		&__presets {
			flex-wrap: wrap;
		}

		&__params {
			display: grid;
			gap: 18px;
		}

		&__hint {
			font-size: 0.85rem;
		}

		&__start {
			min-height: 60px;
			font-size: 1.2rem;
		}
	}
</style>
