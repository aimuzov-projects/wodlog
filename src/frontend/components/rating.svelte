<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import Avatar from '#frontend/components/avatar.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { plural } from '#frontend/lib/format.ts'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { PLACE_POINTS } from '#shared/scoring.ts'
	import type { RatingPeriod, RatingRow } from '#shared/types.ts'

	const periods: [RatingPeriod, string][] = [
		['week', 'Неделя'],
		['month', 'Месяц'],
		['all', 'Всё время'],
	]

	let period = $state<RatingPeriod>('week')
	let rows = $state<RatingRow[] | null>(null)

	$effect(() => {
		const gymId = app.gym?.id

		if (!gymId) return

		rows = null

		api<RatingRow[]>('GET', `/api/gyms/${gymId}/rating?period=${period}`)
			.then((r) => (rows = r))
			.catch((error) => app.notify(error.message, true))
	})
</script>

<section class="rating">
	<ScreenTitle text="Рейтинг" />
	<p class="muted">{app.gym?.name}</p>

	<div class="chips">
		{#each periods as [id, label] (id)}
			<button
				class="chip"
				class:chip--active={period === id}
				onclick={() => {
					haptic('select')
					period = id
				}}>{label}</button
			>
		{/each}
	</div>

	{#if app.me?.visibility === 'private'}
		<div class="card rating__note">
			<Icon name="lock" size={18} />
			<span>Ваш профиль закрыт, вас нет в таблице. Открыть его можно в профиле.</span>
		</div>
	{/if}

	{#if !rows}
		<div class="card rating__loading" aria-busy="true"></div>
	{:else if rows.length === 0}
		<p class="muted">За этот период результатов ещё нет.</p>
	{:else}
		<ol class="rating__list">
			{#each rows as row (row.user.id)}
				<li class="card rating__row" class:rating__row--me={row.user.id === app.me?.id}>
					<span class="rating__place">{row.place}</span>
					<Avatar user={row.user} size={40} />
					<span class="rating__who">
						<span class="rating__name">{row.user.name}</span>
						<span class="muted rating__stats">
							{plural(row.parts, ['комплекс', 'комплекса', 'комплексов'])}{row.wins
								? ` · ${plural(row.wins, ['победа', 'победы', 'побед'])}`
								: ''}
						</span>
					</span>
					<span class="rating__points">{row.points}</span>
				</li>
			{/each}
		</ol>
	{/if}

	<p class="muted rating__rules">
		За каждый комплекс: 1 очко за участие и {PLACE_POINTS.join(', ')} за места с первого по восьмое. RX выше Scaled, в
		зачёт идут только открытые профили.
	</p>
</section>

<style>
	.rating {
		display: grid;
		gap: 12px;

		&__note {
			display: flex;
			gap: 8px;
			align-items: center;
			font-size: 0.9rem;
		}

		&__loading {
			height: 200px;
			opacity: 0.6;
		}

		&__list {
			display: grid;
			gap: 8px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: flex;
			gap: 12px;
			align-items: center;
			padding: 12px 16px;
		}

		&__row--me {
			outline: 2px solid var(--accent);
		}

		&__place {
			width: 2ch;
			font-family: var(--font-mono);
			font-size: 1.2rem;
			font-weight: 800;
			text-align: center;
		}

		&__who {
			display: grid;
			flex: 1;
			min-width: 0;
		}

		&__name {
			font-weight: 700;
		}

		&__stats {
			font-size: 0.85rem;
		}

		&__points {
			font-family: var(--font-mono);
			font-size: 1.4rem;
			font-weight: 800;
			color: var(--accent);
		}

		&__rules {
			font-size: 0.8rem;
		}
	}
</style>
