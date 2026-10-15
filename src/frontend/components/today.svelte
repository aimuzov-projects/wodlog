<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import PartCard from '#frontend/components/part-card.svelte'
	import { api, apiImage } from '#frontend/lib/api.ts'
	import { humanDate, localDate, shiftDate } from '#frontend/lib/format.ts'
	import { compressPhoto } from '#frontend/lib/image.ts'
	import { confirmAction, haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import type { Workout, WorkoutDraft } from '#shared/types.ts'

	let loading = $state(false)
	let recognizing = $state(false)
	let photoUrl = $state<string | null>(null)
	let fileInput: HTMLInputElement

	const today = localDate()
	const workout = $derived(app.workout)

	$effect(() => {
		// Перезагружаем при смене зала или даты.
		void app.gym?.id
		void app.date
		photoUrl = null
		loading = true

		app.loadWorkout()
			.catch((error) => app.notify(error.message, true))
			.finally(() => (loading = false))
	})

	function go(days: number) {
		haptic('select')
		app.date = shiftDate(app.date, days)
	}

	/** Сохраняет id комплексов, совпавших по порядку и формату, чтобы пересъёмка не стёрла результаты. */
	function keepIds(draft: WorkoutDraft, current: Workout | null | undefined): WorkoutDraft {
		if (!current) return draft

		return {
			...draft,
			parts: draft.parts.map((part, i) =>
				current.parts[i]?.kind === part.kind ? { ...part, id: current.parts[i].id } : part,
			),
		}
	}

	async function onPhoto(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0]

		;(event.currentTarget as HTMLInputElement).value = ''

		if (!file || !app.gym) return

		recognizing = true

		try {
			const image = await compressPhoto(file)
			const { draft } = await api<{ draft: WorkoutDraft }>(
				'POST',
				`/api/gyms/${app.gym.id}/workouts/${app.date}/recognize`,
				{ image },
			)

			haptic('success')
			app.open({ name: 'editor', date: app.date, draft: keepIds(draft, workout), photo: image })
		} catch (error) {
			haptic('error')
			app.notify((error as Error).message, true)
		} finally {
			recognizing = false
		}
	}

	async function snap() {
		if (workout && !(await confirmAction('Тренировка на этот день уже есть. Распознать доску заново?'))) return

		fileInput.click()
	}

	function manual() {
		app.open({
			name: 'editor',
			date: app.date,
			draft: workout ? { warmup: workout.warmup, parts: workout.parts } : { warmup: '', parts: [] },
			photo: null,
		})
	}

	async function showPhoto() {
		if (!app.gym) return

		photoUrl = await apiImage(`/api/gyms/${app.gym.id}/workouts/${app.date}/photo`)
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

	<input
		class="visually-hidden"
		type="file"
		accept="image/*"
		capture="environment"
		tabindex="-1"
		aria-hidden="true"
		bind:this={fileInput}
		onchange={onPhoto}
	/>

	{#if recognizing}
		<div class="card today__recognizing" aria-busy="true">
			<div class="today__spinner"></div>
			<p>Читаю доску… Обычно это 10–20 секунд.</p>
		</div>
	{:else if workout === undefined || (loading && !workout)}
		<div class="card today__skeleton" aria-busy="true"></div>
	{:else if workout === null}
		<div class="card today__empty">
			<p class="today__empty-title">На этот день тренировки ещё нет</p>
			<p class="muted">Сфотографируйте доску: тренировка появится у всех в зале.</p>
			<button class="btn btn--primary btn--wide" onclick={snap}>
				<Icon name="camera" /> Сфоткать доску
			</button>
			<button class="btn btn--ghost" onclick={manual}>Ввести вручную</button>
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
			<button class="btn btn--small" onclick={manual}><Icon name="edit" size={18} /> Править</button>
			<button class="btn btn--small" onclick={snap}><Icon name="camera" size={18} /> Переснять</button>
			{#if workout.hasPhoto}
				<button class="btn btn--small" onclick={showPhoto}><Icon name="image" size={18} /> Фото</button>
			{/if}
		</div>

		{#if workout.updatedBy}
			<p class="today__author muted">Внёс {workout.updatedBy.name}</p>
		{/if}

		{#if photoUrl}
			<button class="today__photo" onclick={() => (photoUrl = null)} aria-label="Закрыть фото">
				<img class="today__photo-img" src={photoUrl} alt="Фото доски" />
			</button>
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

		&__empty,
		&__recognizing {
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

		&__spinner {
			width: 40px;
			height: 40px;
			border: 4px solid var(--line);
			border-top-color: var(--accent);
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
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

		&__photo {
			position: fixed;
			z-index: 30;
			inset: 0;
			display: grid;
			place-items: center;
			padding: var(--safe-top) 0 var(--safe-bottom);
			border: 0;
			background: rgb(0 0 0 / 90%);
		}

		&__photo-img {
			max-height: 100%;
			object-fit: contain;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
</style>
