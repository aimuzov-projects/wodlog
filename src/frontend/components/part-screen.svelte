<script lang="ts">
	import Avatar from '#frontend/components/avatar.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import PartCard from '#frontend/components/part-card.svelte'
	import ResultForm from '#frontend/components/result-form.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { humanDate, resultLine } from '#frontend/lib/format.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import type { TimerResult } from '#shared/timer.ts'
	import type { LeaderboardRow, Part, Result } from '#shared/types.ts'

	let { part, date, prefill }: { part: Part; date: string; prefill?: TimerResult } = $props()

	type Board = { rows: LeaderboardRow[]; mine: Result | null }

	let board = $state<Board | null>(null)
	let editing = $state(false)

	// Таймер этого комплекса уже идёт: кнопка возвращает к нему, а не запускает новый.
	const ownTimer = $derived(timer.session?.source?.part.id === part.id && !timer.finished)

	$effect(() => {
		api<Board>('GET', `/api/parts/${part.id}/results`)
			.then((b) => {
				board = b
				editing = !b.mine || Boolean(prefill)
			})
			.catch((error) => app.notify(error.message, true))
	})

	function saved(next: Board) {
		board = next
		editing = false
	}

	const medal = (place: number) => (place <= 3 ? ['gold', 'silver', 'bronze'][place - 1] : null)
</script>

<section class="part-screen">
	<p class="muted">{humanDate(date)} · {app.gym?.name}</p>

	<PartCard {part} />

	{#if part.kind !== 'strength'}
		<button class="btn btn--wide" onclick={() => app.startTimer(part, date)}>
			<Icon name="timer" />
			{ownTimer ? 'Вернуться к таймеру' : 'Запустить таймер'}
		</button>
	{/if}

	<h2 class="section-title">Мой результат</h2>
	{#if !board}
		<div class="card part-screen__loading" aria-busy="true"></div>
	{:else if editing}
		<ResultForm
			{part}
			initial={board.mine}
			{prefill}
			onsaved={saved}
			oncancel={board.mine ? () => (editing = false) : undefined}
		/>
	{:else if board.mine}
		<button class="card part-screen__mine" onclick={() => (editing = true)}>
			<span class="part-screen__mine-value">{resultLine(part.kind, board.mine)}</span>
			<span class="part-screen__division">{board.mine.division === 'rx' ? 'RX' : 'Scaled'}</span>
			{#if app.me?.visibility === 'private'}
				<span class="muted part-screen__private"><Icon name="lock" size={16} /> вне рейтинга</span>
			{/if}
			<span class="part-screen__edit"><Icon name="edit" size={18} /></span>
		</button>
	{/if}

	<h2 class="section-title">Результаты</h2>
	{#if board && board.rows.length === 0}
		<p class="muted">Пока никто не внёс результат. Будьте первым!</p>
	{:else if board}
		<ol class="card part-screen__board">
			{#each board.rows as row (row.user.id)}
				<li class="part-screen__row" class:part-screen__row--me={row.user.id === app.me?.id}>
					<span class="part-screen__place part-screen__place--{medal(row.place) ?? 'plain'}">{row.place}</span
					>
					<Avatar user={row.user} size={32} />
					<span class="part-screen__name">
						{row.user.name}
						{#if row.load.some((l) => l.weight)}
							<span class="part-screen__load muted">
								{row.load
									.filter((l) => l.weight)
									.map((l) => `${l.movement} ${l.weight}`)
									.join(' · ')}
							</span>
						{/if}
					</span>
					<span class="part-screen__value">
						{resultLine(part.kind, row)}
						{#if row.division === 'scaled'}<span class="part-screen__scaled">SC</span>{/if}
					</span>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.part-screen {
		display: grid;
		gap: 12px;

		&__loading {
			height: 120px;
			opacity: 0.6;
		}

		&__mine {
			display: flex;
			gap: 12px;
			align-items: center;
			width: 100%;
			border: 0;
			text-align: left;
		}

		&__mine-value {
			font-family: var(--font-mono);
			font-size: 1.6rem;
			font-weight: 800;
		}

		&__division {
			font-weight: 700;
			color: var(--accent);
		}

		&__private {
			display: inline-flex;
			gap: 4px;
			align-items: center;
			font-size: 0.85rem;
		}

		&__edit {
			margin-left: auto;
			color: var(--muted);
		}

		&__board {
			display: grid;
			gap: 0;
			margin: 0;
			padding: 4px 16px;
			list-style: none;
		}

		&__row {
			display: flex;
			gap: 10px;
			align-items: center;
			padding: 10px 0;
			border-bottom: 1px solid var(--line);

			&:last-child {
				border-bottom: 0;
			}
		}

		&__row--me {
			font-weight: 700;
		}

		&__place {
			display: grid;
			flex: none;
			place-items: center;
			width: 26px;
			height: 26px;
			border-radius: 50%;
			font-size: 0.85rem;
			font-weight: 800;
		}

		&__place--gold {
			color: #1a1300;
			background: var(--gold);
		}

		&__place--silver {
			color: #111111;
			background: var(--silver);
		}

		&__place--bronze {
			color: #ffffff;
			background: var(--bronze);
		}

		&__name {
			display: grid;
			flex: 1;
			min-width: 0;
		}

		&__load {
			overflow: hidden;
			font-size: 0.8rem;
			font-weight: 400;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__value {
			font-family: var(--font-mono);
			font-weight: 700;
			white-space: nowrap;
		}

		&__scaled {
			margin-left: 4px;
			font-size: 0.7rem;
			color: var(--muted);
		}
	}
</style>
