<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import Avatar from '#frontend/components/avatar.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import { api } from '#frontend/lib/api.ts'
	import { resultLine, shortDate } from '#frontend/lib/format.ts'
	import { haptic, insideTelegram } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import { PART_KIND_LABELS, type HistoryRow, type Me } from '#shared/types.ts'

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

	const VISIBILITY = {
		public: { title: 'Профиль открыт', detail: 'Ваши результаты видны залу и участвуют в рейтинге.' },
		private: { title: 'Профиль закрыт', detail: 'Результаты видите только вы, в рейтинге вас нет.' },
	}

	/** Иконка у имени: тап переключает видимость, уведомление объясняет, что это значит. */
	async function toggleVisibility() {
		if (!app.me) return

		const visibility = app.me.visibility === 'public' ? 'private' : 'public'

		await updateMe({ visibility })

		if (app.me.visibility === visibility)
			app.notify(VISIBILITY[visibility].title, false, VISIBILITY[visibility].detail)
	}

	async function updateMe(patch: Partial<Pick<Me, 'visibility' | 'rxWeights'>>) {
		haptic('select')

		try {
			app.me = await api<Me>('PATCH', '/api/me', patch)
		} catch (error) {
			app.notify((error as Error).message, true)
		}
	}
</script>

<section class="profile">
	<ScreenTitle text="Профиль" />

	{#if app.me}
		<header class="profile__header">
			<Avatar user={app.me} size={64} />
			<div>
				<p class="profile__name">
					{app.me.name}
					<button
						class="profile__visibility"
						class:profile__visibility--private={app.me.visibility === 'private'}
						aria-label={app.me.visibility === 'public'
							? 'Профиль открыт. Сделать закрытым'
							: 'Профиль закрыт. Сделать открытым'}
						onclick={toggleVisibility}
					>
						<Icon name={app.me.visibility === 'public' ? 'eye' : 'lock'} size={18} />
					</button>
				</p>
				{#if app.me.username}<p class="muted">@{app.me.username}</p>{/if}
			</div>
		</header>

		{@render trainings()}

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

		<h2 class="section-title">RX-веса</h2>
		<div class="card profile__rx">
			<p class="muted profile__option-hint">
				На доске RX-вес часто пишут парой, «43/30». В RX подставляем ваш, вводить его не нужно.
			</p>
			<div class="chips" role="radiogroup" aria-label="Мои RX-веса">
				{#each [['m', 'Мужские'], ['f', 'Женские']] as const as [value, label] (value)}
					<button
						class="chip"
						class:chip--active={app.me.rxWeights === value}
						role="radio"
						aria-checked={app.me.rxWeights === value}
						onclick={() => updateMe({ rxWeights: value })}>{label}</button
					>
				{/each}
			</div>
		</div>

		{#if !insideTelegram()}
			<button class="btn btn--ghost btn--danger" onclick={() => app.signOut()}>Выйти</button>
		{/if}
	{/if}
</section>

{#snippet trainings()}
	<h2 class="section-title">Тренировки</h2>
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
{/snippet}

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
			display: flex;
			gap: 8px;
			align-items: center;
			font-size: 1.5rem;
			font-weight: 800;
		}

		/* Маленькая иконка у имени: открытый профиль -- спокойный цвет, закрытый -- акцентный замок. */
		&__visibility {
			display: grid;
			place-items: center;
			width: 32px;
			height: 32px;
			padding: 0;
			border: 0;
			border-radius: 50%;
			color: var(--muted);
			background: color-mix(in srgb, var(--fg) 8%, transparent);
		}

		&__visibility--private {
			color: var(--accent);
		}

		&__option-hint {
			font-size: 0.85rem;
		}

		&__rx {
			display: grid;
			gap: 10px;
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
