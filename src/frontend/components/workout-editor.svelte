<script lang="ts">
	import { untrack } from 'svelte'

	import Icon from '#frontend/components/icon.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { humanDate } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import {
		EQUIPMENT,
		PART_KIND_LABELS,
		PART_KINDS,
		type Part,
		type Workout,
		type WorkoutDraft,
	} from '#shared/types.ts'

	let { date, draft }: { date: string; draft: WorkoutDraft } = $props()

	// Правим копию: черновик в стеке экранов остаётся нетронутым, если уйти без сохранения.
	const initial = untrack(() => $state.snapshot(draft))

	let warmup = $state(initial.warmup)
	let parts = $state<Part[]>(initial.parts)
	let saving = $state(false)

	const emptyPart = (): Part => ({
		kind: 'amrap',
		title: '',
		description: '',
		timeCapSec: null,
		intervalSec: null,
		rounds: null,
		movements: [],
	})

	// Время в форме -- в минутах, в данных -- в секундах.
	const toMinutes = (sec: number | null) => (sec === null ? '' : String(Math.round((sec / 60) * 100) / 100))
	const toSeconds = (value: string) => {
		const minutes = Number.parseFloat(value.replace(',', '.'))

		return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null
	}
	const toNumber = (value: string) => {
		const n = Number.parseFloat(value.replace(',', '.'))

		return Number.isFinite(n) && n >= 0 ? n : null
	}

	function move(index: number, delta: number) {
		const target = index + delta

		if (target < 0 || target >= parts.length) return

		;[parts[index], parts[target]] = [parts[target], parts[index]]
	}

	async function save() {
		if (!app.gym) return

		saving = true

		try {
			const workout = await api<Workout>('PUT', `/api/gyms/${app.gym.id}/workouts/${date}`, {
				warmup,
				parts: $state.snapshot(parts),
			})

			app.setWorkout(workout)
			haptic('success')
			app.notify('Тренировка сохранена')
			app.back()
		} catch (error) {
			haptic('error')
			app.notify((error as Error).message, true)
		} finally {
			saving = false
		}
	}
</script>

<form
	class="editor"
	onsubmit={(event) => {
		event.preventDefault()
		void save()
	}}
>
	<header class="editor__header">
		<h1 class="editor__title">Тренировка</h1>
		<span class="muted">{humanDate(date)}</span>
	</header>

	<label class="field">
		<span class="field__label">Разминка</span>
		<textarea class="field__input field__textarea" bind:value={warmup} rows="4"></textarea>
	</label>

	{#each parts as part, i (part)}
		<fieldset class="card editor__part">
			<legend class="editor__legend">Комплекс {i + 1}</legend>

			<div class="chips" role="radiogroup" aria-label="Формат">
				{#each PART_KINDS as kind (kind)}
					<button
						type="button"
						class="chip"
						class:chip--active={part.kind === kind}
						role="radio"
						aria-checked={part.kind === kind}
						onclick={() => (part.kind = kind)}>{PART_KIND_LABELS[kind]}</button
					>
				{/each}
			</div>

			<label class="field">
				<span class="field__label">Заголовок</span>
				<input class="field__input" bind:value={part.title} placeholder="AMRAP 12'" />
			</label>

			<div class="editor__row">
				{#if part.kind === 'amrap' || part.kind === 'for_time'}
					<label class="field">
						<span class="field__label">{part.kind === 'amrap' ? 'Время, мин' : 'Кап, мин'}</span>
						<input
							class="field__input"
							inputmode="decimal"
							value={toMinutes(part.timeCapSec)}
							oninput={(e) => (part.timeCapSec = toSeconds(e.currentTarget.value))}
						/>
					</label>
				{/if}
				{#if part.kind === 'emom'}
					<label class="field">
						<span class="field__label">Интервал, мин</span>
						<input
							class="field__input"
							inputmode="decimal"
							value={toMinutes(part.intervalSec)}
							oninput={(e) => (part.intervalSec = toSeconds(e.currentTarget.value))}
						/>
					</label>
				{/if}
				{#if part.kind !== 'amrap'}
					<label class="field">
						<span class="field__label">{part.kind === 'emom' ? 'Раундов' : 'Раундов / подходов'}</span>
						<input
							class="field__input"
							inputmode="numeric"
							value={part.rounds ?? ''}
							oninput={(e) => (part.rounds = toNumber(e.currentTarget.value))}
						/>
					</label>
				{/if}
			</div>

			<div class="editor__movements">
				<span class="field__label">Движения</span>
				{#each part.movements as m, j (m)}
					<div class="editor__movement">
						<input
							class="field__input editor__reps"
							bind:value={m.reps}
							placeholder="12"
							aria-label="Повторы"
						/>
						<input
							class="field__input editor__name"
							bind:value={m.name}
							placeholder="Thrusters"
							aria-label="Движение"
						/>
						<button
							type="button"
							class="btn btn--small btn--ghost btn--danger"
							aria-label="Убрать движение"
							onclick={() => part.movements.splice(j, 1)}><Icon name="close" size={18} /></button
						>
						<input
							class="field__input"
							inputmode="decimal"
							value={m.weightM ?? ''}
							oninput={(e) => (m.weightM = toNumber(e.currentTarget.value))}
							placeholder="М, кг"
							aria-label="Вес RX мужчины, кг"
						/>
						<input
							class="field__input"
							inputmode="decimal"
							value={m.weightF ?? ''}
							oninput={(e) => (m.weightF = toNumber(e.currentTarget.value))}
							placeholder="Ж, кг"
							aria-label="Вес RX женщины, кг"
						/>
						<select
							class="field__input editor__equipment"
							value={m.equipment ?? ''}
							onchange={(e) => (m.equipment = e.currentTarget.value || null)}
							aria-label="Инвентарь"
						>
							<option value="">Инвентарь</option>
							{#each EQUIPMENT as item (item)}<option value={item}>{item}</option>{/each}
							{#if m.equipment && !(EQUIPMENT as readonly string[]).includes(m.equipment)}
								<option value={m.equipment}>{m.equipment}</option>
							{/if}
						</select>
					</div>
				{/each}
				<button
					type="button"
					class="btn btn--small"
					onclick={() =>
						part.movements.push({ name: '', reps: '', weightM: null, weightF: null, equipment: null })}
				>
					<Icon name="plus" size={18} /> Движение
				</button>
			</div>

			<label class="field">
				<span class="field__label">Заметки</span>
				<textarea class="field__input field__textarea" bind:value={part.description} rows="2"></textarea>
			</label>

			<div class="editor__part-tools">
				<button
					type="button"
					class="btn btn--small"
					aria-label="Выше"
					disabled={i === 0}
					onclick={() => move(i, -1)}
				>
					<Icon name="up" size={18} />
				</button>
				<button
					type="button"
					class="btn btn--small"
					aria-label="Ниже"
					disabled={i === parts.length - 1}
					onclick={() => move(i, 1)}
				>
					<Icon name="down" size={18} />
				</button>
				<button type="button" class="btn btn--small btn--ghost btn--danger" onclick={() => parts.splice(i, 1)}>
					<Icon name="trash" size={18} /> Удалить комплекс
				</button>
			</div>
		</fieldset>
	{/each}

	<button type="button" class="btn" onclick={() => parts.push(emptyPart())}>
		<Icon name="plus" /> Комплекс
	</button>

	<div class="editor__actions">
		<button type="button" class="btn" onclick={() => app.back()}>Отмена</button>
		<button class="btn btn--primary" disabled={saving || (!warmup.trim() && parts.length === 0)}>
			{saving ? 'Сохраняю…' : 'Сохранить'}
		</button>
	</div>
</form>

<style>
	.editor {
		display: grid;
		gap: 16px;

		&__header {
			display: flex;
			gap: 12px;
			align-items: baseline;
		}

		&__title {
			font-size: 1.6rem;
			font-weight: 800;
		}

		&__part {
			display: grid;
			gap: 14px;
			min-width: 0;
			margin: 0;
			border: 0;
		}

		&__legend {
			float: left;
			padding: 0;
			font-weight: 800;
		}

		&__row {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 10px;
		}

		&__movements {
			display: grid;
			gap: 10px;
		}

		&__movement {
			display: grid;
			grid-template-columns: 72px 1fr 1fr 40px;
			gap: 6px;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--line);
		}

		&__name,
		&__equipment {
			grid-column: span 2;
		}

		&__part-tools {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}

		&__actions {
			position: sticky;
			bottom: calc(var(--tabbar-height) + var(--safe-bottom) + 8px);
			display: grid;
			grid-template-columns: 1fr 2fr;
			gap: 10px;
		}
	}
</style>
