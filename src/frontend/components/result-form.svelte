<script lang="ts">
	import { untrack } from 'svelte'

	import { api } from '#frontend/lib/api.ts'
	import { plural } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import {
		EQUIPMENT,
		type Division,
		type LeaderboardRow,
		type Load,
		type Me,
		type Part,
		type Result,
		type RxWeights,
	} from '#shared/types.ts'
	import { rxWeight } from '#shared/workout.ts'

	type Board = { rows: LeaderboardRow[]; mine: Result | null }

	let {
		part,
		initial,
		onsaved,
		oncancel,
	}: { part: Part; initial: Result | null; onsaved: (board: Board) => void; oncancel?: () => void } = $props()

	// Форма открывается заново на каждую правку, поэтому берём значения один раз.
	const start = untrack(() => $state.snapshot(initial))
	const movements = untrack(() => part.movements)

	let division = $state<Division>(start?.division ?? 'rx')
	let capped = $state(start?.capped ?? false)
	let rounds = $state(start?.rounds?.toString() ?? '')
	let reps = $state(start?.reps?.toString() ?? '')
	let minutes = $state(start?.timeSec ? String(Math.floor(start.timeSec / 60)) : '')
	let seconds = $state(start?.timeSec ? String(start.timeSec % 60) : '')
	let weight = $state(start?.weight?.toString() ?? '')
	let notes = $state(start?.notes ?? '')
	// По строке на движение комплекса, сохранённые значения подтягиваются по названию.
	let load = $state<Load[]>(
		movements.map(
			(m) =>
				start?.load.find((l) => l.movement === m.name) ?? {
					movement: m.name,
					weight: null,
					equipment: m.equipment,
				},
		),
	)
	// EMOM с известным числом раундов обычно закрывают целиком: тогда вводить нечего.
	const emomRounds = untrack(() => (part.kind === 'emom' ? part.rounds : null))
	let allRounds = $state(Boolean(emomRounds) && (!start || (start.rounds === emomRounds && !start.reps)))
	let saving = $state(false)

	// Пару «43/30» без выбора в профиле не разобрать, а одиночный вес общий для всех.
	const needsRxChoice = $derived(
		!app.me?.rxWeights &&
			movements.some((m) => m.weightM !== null && m.weightF !== null && m.weightM !== m.weightF),
	)

	const num = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))

	async function chooseRxWeights(rxWeights: RxWeights) {
		haptic('select')

		try {
			app.me = await api<Me>('PATCH', '/api/me', { rxWeights })
		} catch (error) {
			app.notify((error as Error).message, true)
		}
	}

	async function save() {
		saving = true

		try {
			const timeSec = (num(minutes) ?? 0) * 60 + (num(seconds) ?? 0)
			const board = await api<Board>('PUT', `/api/parts/${part.id}/results`, {
				division,
				capped,
				rounds: allRounds ? emomRounds : num(rounds),
				reps: allRounds ? null : num(reps),
				timeSec: timeSec || null,
				weight: num(weight),
				load: $state.snapshot(load),
				notes,
			})

			haptic('success')
			onsaved(board)
		} catch (error) {
			haptic('error')
			app.notify((error as Error).message, true)
		} finally {
			saving = false
		}
	}

	async function remove() {
		try {
			onsaved(await api<Board>('DELETE', `/api/parts/${part.id}/results`))
		} catch (error) {
			app.notify((error as Error).message, true)
		}
	}
</script>

<form
	class="card result-form"
	onsubmit={(event) => {
		event.preventDefault()
		void save()
	}}
>
	<div class="result-form__division" role="radiogroup" aria-label="Уровень">
		{#each [['rx', 'RX'], ['scaled', 'Scaled']] as const as [value, label] (value)}
			<button
				type="button"
				class="chip result-form__division-chip"
				class:chip--active={division === value}
				role="radio"
				aria-checked={division === value}
				onclick={() => {
					haptic('select')
					division = value
				}}>{label}</button
			>
		{/each}
	</div>

	{#if part.kind === 'for_time'}
		<label class="result-form__check">
			<input type="checkbox" bind:checked={capped} />
			Не уложился в кап
		</label>
	{/if}

	{#if part.kind === 'for_time' && !capped}
		<div class="result-form__row">
			<label class="field">
				<span class="field__label">Минуты</span>
				<input class="field__input result-form__big" inputmode="numeric" bind:value={minutes} placeholder="0" />
			</label>
			<label class="field">
				<span class="field__label">Секунды</span>
				<input
					class="field__input result-form__big"
					inputmode="numeric"
					bind:value={seconds}
					placeholder="00"
				/>
			</label>
		</div>
	{:else if part.kind === 'strength'}
		<label class="field">
			<span class="field__label">Рабочий вес, кг</span>
			<input class="field__input result-form__big" inputmode="decimal" bind:value={weight} placeholder="0" />
		</label>
	{:else}
		{#if emomRounds}
			<label class="result-form__check">
				<input type="checkbox" bind:checked={allRounds} />
				Все {plural(emomRounds, ['раунд', 'раунда', 'раундов'])}
			</label>
		{/if}
		{#if !allRounds}
			<div class="result-form__row">
				<label class="field">
					<span class="field__label">Раунды</span>
					<input
						class="field__input result-form__big"
						inputmode="numeric"
						bind:value={rounds}
						placeholder="0"
					/>
				</label>
				<label class="field">
					<span class="field__label">+ повторы</span>
					<input
						class="field__input result-form__big"
						inputmode="numeric"
						bind:value={reps}
						placeholder="0"
					/>
				</label>
			</div>
		{/if}
	{/if}

	{#if division === 'rx' && load.length}
		<p class="muted result-form__hint">Вес и инвентарь — как на доске.</p>
		{#if needsRxChoice}
			<div class="result-form__rx-choice">
				<span class="result-form__hint">Какие RX-веса ваши? Спросим один раз.</span>
				<button type="button" class="chip" onclick={() => chooseRxWeights('m')}>Мужские</button>
				<button type="button" class="chip" onclick={() => chooseRxWeights('f')}>Женские</button>
			</div>
		{/if}
	{:else if load.length}
		<fieldset class="result-form__load">
			<legend class="field__label">Вес и инвентарь</legend>
			{#each load as item, i (i)}
				<div class="result-form__load-row">
					<span class="result-form__movement">{item.movement}</span>
					<input
						class="field__input"
						inputmode="decimal"
						value={item.weight ?? ''}
						oninput={(e) => (item.weight = num(e.currentTarget.value))}
						placeholder={String(rxWeight(movements[i], app.me?.rxWeights ?? null) ?? 'кг')}
						aria-label={`${item.movement}: вес, кг`}
					/>
					<select
						class="field__input"
						value={item.equipment ?? ''}
						onchange={(e) => (item.equipment = e.currentTarget.value || null)}
						aria-label={`${item.movement}: инвентарь`}
					>
						<option value="">—</option>
						{#each EQUIPMENT as eq (eq)}<option value={eq}>{eq}</option>{/each}
					</select>
				</div>
			{/each}
		</fieldset>
	{/if}

	<label class="field">
		<span class="field__label">Заметка</span>
		<input class="field__input" bind:value={notes} placeholder="Прыгал на 50 см вместо 60" maxlength="500" />
	</label>

	<div class="result-form__actions">
		{#if oncancel}
			<button type="button" class="btn" onclick={oncancel}>Отмена</button>
		{/if}
		<button class="btn btn--primary" disabled={saving}>{saving ? 'Сохраняю…' : 'Сохранить'}</button>
	</div>

	{#if initial}
		<button type="button" class="btn btn--ghost btn--danger btn--small" onclick={remove}>Удалить результат</button>
	{/if}
</form>

<style>
	.result-form {
		display: grid;
		gap: 14px;

		&__division {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 6px;
		}

		&__division-chip {
			padding: 10px;
		}

		&__check {
			display: flex;
			gap: 8px;
			align-items: center;
			font-weight: 600;
		}

		&__hint {
			font-size: 0.9rem;
		}

		&__rx-choice {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			align-items: center;
		}

		&__row {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 10px;
		}

		&__big {
			font-family: var(--font-mono);
			font-size: 1.6rem;
			font-weight: 700;
			text-align: center;
		}

		&__load {
			display: grid;
			gap: 8px;
			min-width: 0;
			margin: 0;
			padding: 0;
			border: 0;
		}

		&__load-row {
			display: grid;
			grid-template-columns: 1fr 72px 110px;
			gap: 6px;
			align-items: center;
		}

		&__movement {
			overflow: hidden;
			font-size: 0.9rem;
			text-overflow: ellipsis;
		}

		&__actions {
			display: grid;
			grid-auto-columns: 1fr;
			grid-auto-flow: column;
			gap: 10px;
		}
	}
</style>
