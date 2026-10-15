<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import { untrack } from 'svelte'

	import Icon from '#frontend/components/icon.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { humanDate } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import Stepper from '#frontend/components/stepper.svelte'
	import { formatClock } from '#shared/timer.ts'
	import {
		EQUIPMENT,
		PART_KIND_LABELS,
		type Part,
		type PartKind,
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
		timeCapSec: 12 * 60,
		intervalSec: null,
		rounds: null,
		movements: [],
	})

	// Силовую не заводим: её результат -- вес, а не раунды и время, и в зале её не пишут.
	const EDITOR_KINDS: PartKind[] = ['amrap', 'emom', 'for_time', 'other']

	// Время в форме -- в минутах, в данных -- в секундах.
	const minutes = (sec: number | null) => (sec ? Math.round(sec / 60) : 0)

	/** Меняет формат и подставляет обычные для него значения, если их ещё нет. */
	function setKind(part: Part, kind: PartKind) {
		part.kind = kind

		if (kind === 'amrap') part.timeCapSec ??= 12 * 60

		if (kind === 'emom') {
			part.intervalSec ??= 60
			part.rounds ??= 10
		}
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
		<ScreenTitle text="Тренировка" />
		<span class="muted">{humanDate(date)}</span>
	</header>

	<label class="field">
		<span class="field__label">Разминка</span>
		<textarea class="field__input field__textarea" bind:value={warmup} rows="4"></textarea>
	</label>

	{#each parts as part, i (part)}
		<fieldset class="card editor__part">
			<legend class="editor__legend">Комплекс {i + 1}</legend>

			<div class="chips editor__kinds" role="radiogroup" aria-label="Формат">
				{#each EDITOR_KINDS as kind (kind)}
					<button
						type="button"
						class="chip"
						class:chip--active={part.kind === kind}
						role="radio"
						aria-checked={part.kind === kind}
						onclick={() => setKind(part, kind)}>{PART_KIND_LABELS[kind]}</button
					>
				{/each}
			</div>

			{#if part.kind === 'amrap' || part.kind === 'for_time'}
				<Stepper
					compact
					label={part.kind === 'amrap' ? 'Время' : 'Лимит времени'}
					value={minutes(part.timeCapSec)}
					onchange={(v) => (part.timeCapSec = v ? v * 60 : null)}
					min={part.kind === 'amrap' ? 1 : 0}
					format={(v) => (v || part.kind === 'amrap' ? String(v) : 'нет')}
					unit={minutes(part.timeCapSec) || part.kind === 'amrap' ? 'мин' : ''}
				/>
			{/if}
			{#if part.kind === 'emom'}
				<Stepper
					compact
					label="Интервал"
					value={part.intervalSec ?? 60}
					onchange={(v) => (part.intervalSec = v)}
					step={15}
					min={15}
					format={(v) => formatClock(v * 1000).replace(/^0/, '')}
				/>
			{/if}
			{#if part.kind === 'emom' || part.kind === 'for_time' || part.kind === 'other'}
				<Stepper
					compact
					label={part.kind === 'emom' ? 'Раунды' : 'Раунды или подходы'}
					value={part.rounds ?? 0}
					onchange={(v) => (part.rounds = v || null)}
					min={part.kind === 'emom' ? 1 : 0}
					format={(v) => (v ? String(v) : '—')}
				/>
			{/if}

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

		&__kinds {
			flex-wrap: wrap;
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
			bottom: calc(var(--safe-bottom) + 8px);
			display: grid;
			grid-template-columns: 1fr 2fr;
			gap: 10px;
		}
	}
</style>
