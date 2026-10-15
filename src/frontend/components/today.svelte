<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import PartCard from '#frontend/components/part-card.svelte'
	import { fly } from 'svelte/transition'

	import { humanDate, localDate, shiftDate, shortDate } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import type { Part } from '#shared/types.ts'

	let loading = $state(false)

	const today = localDate()
	const workout = $derived(app.workout)

	$effect(() => {
		// Перезагружаем при смене зала или даты.
		void app.gym?.id
		void app.date
		loading = true

		app.loadWorkout()
			.catch((error) => app.notify(error.message, true))
			.finally(() => (loading = false))
	})

	// Откуда въезжает новый день: вперёд -- справа, назад -- слева.
	let direction = $state(0)

	function go(days: number) {
		if (days > 0 && app.date >= today) return

		haptic('select')
		direction = days
		app.date = shiftDate(app.date, days)
	}

	const openPart = (part: Part) => app.open({ name: 'part', part, date: app.date })

	const timerRunning = (part: Part) => timer.session?.source?.part.id === part.id && !timer.finished

	function edit() {
		app.open({
			name: 'editor',
			date: app.date,
			draft: workout ? { warmup: workout.warmup, parts: workout.parts } : { warmup: '', parts: [] },
		})
	}
</script>

<section class="today">
	<header class="today__header">
		<label class="today__date">
			<h1 class="today__title">{humanDate(app.date, today)}</h1>
			{#if app.date === today}<span class="muted">{shortDate(app.date)}</span>{/if}
			<input
				class="today__date-input"
				type="date"
				value={app.date}
				max={today}
				aria-label="Выбрать дату"
				onchange={(event) => event.currentTarget.value && (app.date = event.currentTarget.value)}
			/>
		</label>
		<button class="btn btn--small" aria-label="Предыдущий день" onclick={() => go(-1)}>
			<Icon name="left" size={20} />
		</button>
		<button class="btn btn--small" aria-label="Следующий день" disabled={app.date >= today} onclick={() => go(1)}>
			<Icon name="right" size={20} />
		</button>
	</header>

	{#key app.date}
		<div class="today__day" in:fly={{ x: direction * 48, duration: 180 }}>
			{#if workout === undefined || (loading && !workout)}
				<div class="card today__skeleton" aria-busy="true"></div>
			{:else if workout === null}
				<div class="card today__empty">
					<p class="today__empty-title">На этот день тренировки ещё нет</p>
					<p class="muted">Перенесите её с доски: тренировка появится у всех в зале.</p>
					<button class="btn btn--primary btn--wide" onclick={edit}>
						<Icon name="plus" /> Добавить тренировку
					</button>
				</div>
			{:else}
				{#if workout.warmup}
					<h2 class="section-title">Разминка</h2>
					<div class="card today__warmup">{workout.warmup}</div>
				{/if}

				{#each workout.parts as part, i (part.id)}
					<h2 class="section-title">Комплекс {i + 1}</h2>
					<PartCard {part} onclick={() => openPart(part)} />
					<div class="today__actions">
						{#if part.kind !== 'strength'}
							<button class="btn btn--primary" onclick={() => app.startTimer(part, app.date)}>
								<Icon name="play" size={20} />
								{timerRunning(part) ? 'К таймеру' : 'Старт'}
							</button>
						{/if}
						<button class="btn" onclick={() => openPart(part)}>Результат</button>
					</div>
				{/each}

				<div class="today__tools">
					<button class="btn btn--small" onclick={edit}><Icon name="edit" size={18} /> Править</button>
				</div>

				{#if workout.updatedBy}
					<p class="today__author muted">Внёс {workout.updatedBy.name}</p>
				{/if}
			{/if}
		</div>
	{/key}
</section>

<style>
	.today {
		&__header {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		/* Поверх даты невидимый input: тап по заголовку открывает системный выбор дня. */
		&__date {
			position: relative;
			display: flex;
			flex: 1;
			gap: 10px;
			align-items: baseline;
			min-width: 0;
		}

		&__title {
			font-family: var(--font-display);
			font-size: 2rem;
			font-weight: 800;
			letter-spacing: -0.02em;
		}

		&__actions {
			display: grid;
			grid-auto-columns: 1fr;
			grid-auto-flow: column;
			gap: 8px;
			margin-top: 8px;
		}

		&__date-input {
			position: absolute;
			inset: 0;
			opacity: 0;
		}

		&__warmup {
			white-space: pre-line;
		}

		&__skeleton {
			height: 220px;
			margin-top: 20px;
			opacity: 0.6;
		}

		&__empty {
			display: grid;
			gap: 12px;
			justify-items: center;
			margin-top: 20px;
			padding: 32px 20px;
			text-align: center;
		}

		&__empty-title {
			font-size: 1.2rem;
			font-weight: 700;
		}

		&__tools {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-top: 20px;
		}

		&__author {
			margin-top: 12px;
			font-size: 0.85rem;
		}
	}
</style>
