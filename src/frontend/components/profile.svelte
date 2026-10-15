<script lang="ts">
	import Avatar from '#frontend/components/avatar.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { resultLine, shortDate } from '#frontend/lib/format.ts'
	import { haptic, insideTelegram } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { PART_KIND_LABELS, type HistoryRow, type Me, type Visibility } from '#shared/types.ts'

	let history = $state<HistoryRow[] | null>(null)

	$effect(() => {
		api<HistoryRow[]>('GET', '/api/me/history')
			.then((rows) => (history = rows))
			.catch((error) => app.notify(error.message, true))
	})

	/** Лучший вес по каждому движению за всё время -- личные рекорды. */
	const records = $derived.by(() => {
		const best = new Map<string, number>()

		for (const row of history ?? []) {
			for (const l of row.load) if (l.weight) best.set(l.movement, Math.max(best.get(l.movement) ?? 0, l.weight))

			if (row.part.kind === 'strength' && row.weight) {
				const name = row.part.movements[0]?.name || row.part.title

				best.set(name, Math.max(best.get(name) ?? 0, row.weight))
			}
		}

		return [...best].sort((a, b) => b[1] - a[1]).slice(0, 12)
	})

	async function setVisibility(visibility: Visibility) {
		haptic('select')

		try {
			app.me = await api<Me>('PATCH', '/api/me', { visibility })
		} catch (error) {
			app.notify((error as Error).message, true)
		}
	}
</script>

<section class="profile">
	{#if app.me}
		<header class="profile__header">
			<Avatar user={app.me} size={64} />
			<div>
				<h1 class="profile__name">{app.me.name}</h1>
				{#if app.me.username}<p class="muted">@{app.me.username}</p>{/if}
			</div>
		</header>

		<h2 class="section-title">Профиль</h2>
		<div class="card profile__visibility" role="radiogroup" aria-label="Видимость профиля">
			{#each [['public', 'Открытый', 'Участвую в рейтинге, мои результаты видят в зале'], ['private', 'Закрытый', 'Веду статистику только для себя']] as const as [value, label, hint] (value)}
				<button
					class="profile__option"
					class:profile__option--active={app.me.visibility === value}
					role="radio"
					aria-checked={app.me.visibility === value}
					onclick={() => setVisibility(value)}
				>
					<span class="profile__option-label">
						{#if value === 'private'}<Icon name="lock" size={16} />{/if}
						{label}
					</span>
					<span class="muted profile__option-hint">{hint}</span>
				</button>
			{/each}
		</div>

		<h2 class="section-title">Залы</h2>
		<button class="card profile__gyms" onclick={() => app.open({ name: 'gyms' })}>
			<span>{app.gyms.map((g) => g.name).join(', ') || 'Пока ни одного'}</span>
			<Icon name="chevron" size={20} />
		</button>

		{#if records.length}
			<h2 class="section-title">Личные рекорды</h2>
			<ul class="card profile__records">
				{#each records as [movement, kg] (movement)}
					<li class="profile__record">
						<span>{movement}</span>
						<span class="profile__kg">{kg} кг</span>
					</li>
				{/each}
			</ul>
		{/if}

		<h2 class="section-title">История</h2>
		{#if !history}
			<div class="card profile__loading" aria-busy="true"></div>
		{:else if history.length === 0}
			<p class="muted">Здесь появятся ваши результаты.</p>
		{:else}
			<ul class="profile__history">
				{#each history as row (row.partId)}
					<li class="card profile__entry">
						<span class="profile__entry-head">
							<span class="muted">{shortDate(row.date)} · {row.gymName}</span>
							<span class="profile__entry-kind">{row.part.title || PART_KIND_LABELS[row.part.kind]}</span>
						</span>
						<span class="profile__entry-value">
							{resultLine(row.part.kind, row)}
							<span class="muted profile__entry-division">{row.division === 'rx' ? 'RX' : 'SC'}</span>
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if !insideTelegram()}
			<button class="btn btn--ghost btn--danger" onclick={() => app.signOut()}>Выйти</button>
		{/if}
	{/if}
</section>

<style>
	.profile {
		display: grid;
		gap: 10px;

		&__header {
			display: flex;
			gap: 14px;
			align-items: center;
		}

		&__name {
			font-size: 1.5rem;
			font-weight: 800;
		}

		&__visibility {
			display: grid;
			gap: 8px;
			padding: 8px;
		}

		&__option {
			display: grid;
			gap: 2px;
			padding: 12px;
			border: 2px solid transparent;
			border-radius: var(--radius-small);
			text-align: left;
			background: none;
		}

		&__option--active {
			border-color: var(--accent);
		}

		&__option-label {
			display: flex;
			gap: 6px;
			align-items: center;
			font-weight: 700;
		}

		&__option-hint {
			font-size: 0.85rem;
		}

		&__gyms {
			display: flex;
			gap: 8px;
			justify-content: space-between;
			width: 100%;
			border: 0;
			text-align: left;
		}

		&__records {
			display: grid;
			gap: 6px;
			margin: 0;
			list-style: none;
		}

		&__record {
			display: flex;
			justify-content: space-between;
		}

		&__kg {
			font-family: var(--font-mono);
			font-weight: 700;
		}

		&__loading {
			height: 120px;
			opacity: 0.6;
		}

		&__history {
			display: grid;
			gap: 8px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__entry {
			display: flex;
			gap: 12px;
			align-items: center;
			justify-content: space-between;
		}

		&__entry-head {
			display: grid;
			min-width: 0;
			font-size: 0.9rem;
		}

		&__entry-kind {
			font-weight: 700;
		}

		&__entry-value {
			font-family: var(--font-mono);
			font-size: 1.1rem;
			font-weight: 800;
			white-space: nowrap;
		}

		&__entry-division {
			font-size: 0.75rem;
		}
	}
</style>
