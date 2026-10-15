<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import PartCard from '#frontend/components/part-card.svelte'
	import { humanDate, localDate, shiftDate } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'

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

	function go(days: number) {
		haptic('select')
		app.date = shiftDate(app.date, days)
	}

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
		<button class="today__gym" onclick={() => app.open({ name: 'gyms' })}>
			{app.gym?.name}
			<Icon name="down" size={18} />
		</button>

		<div class="today__dates">
			<button class="btn btn--small" aria-label="Предыдущий день" onclick={() => go(-1)}>
				<Icon name="left" size={20} />
			</button>
			<label class="today__date">
				<span>{humanDate(app.date, today)}</span>
				<input
					class="today__date-input"
					type="date"
					value={app.date}
					max={today}
					aria-label="Выбрать дату"
					onchange={(event) => event.currentTarget.value && (app.date = event.currentTarget.value)}
				/>
			</label>
			<button
				class="btn btn--small"
				aria-label="Следующий день"
				disabled={app.date >= today}
				onclick={() => go(1)}
			>
				<Icon name="right" size={20} />
			</button>
		</div>
	</header>

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
			<PartCard {part} onclick={() => app.open({ name: 'part', part, date: app.date })} />
		{/each}

		<div class="today__tools">
			<button class="btn btn--small" onclick={edit}><Icon name="edit" size={18} /> Править</button>
		</div>

		{#if workout.updatedBy}
			<p class="today__author muted">Внёс {workout.updatedBy.name}</p>
		{/if}
	{/if}
</section>

<style>
	.today {
		&__header {
			display: grid;
			gap: 12px;
		}

		&__gym {
			display: flex;
			gap: 4px;
			align-items: center;
			padding: 0;
			border: 0;
			font-family: var(--font-display);
			font-size: 1.6rem;
			font-weight: 800;
			text-align: left;
			letter-spacing: -0.02em;
			background: none;
		}

		&__dates {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		&__date {
			position: relative;
			flex: 1;
			padding: 8px;
			border-radius: var(--radius-small);
			font-weight: 700;
			text-align: center;
			background: var(--surface);
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
