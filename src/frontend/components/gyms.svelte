<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import { plural } from '#frontend/lib/format.ts'
	import { confirmAction, haptic, webApp } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import type { Gym } from '#shared/types.ts'

	const botUsername = import.meta.env.PUBLIC_BOT_USERNAME ?? ''

	const inviteLink = (gym: Gym) =>
		botUsername ? `https://t.me/${botUsername}?startapp=gym_${gym.inviteCode}` : gym.inviteCode

	async function share(gym: Gym) {
		const link = inviteLink(gym)
		const text = `Присоединяйся к залу «${gym.name}» в WODlog`

		haptic('light')

		if (webApp()?.initData && botUsername) {
			webApp()!.openTelegramLink(
				`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
			)

			return
		}

		try {
			if (navigator.share) await navigator.share({ text, url: link })
			else {
				await navigator.clipboard.writeText(link)
				app.notify('Ссылка скопирована')
			}
		} catch {
			// Пользователь закрыл окно «Поделиться».
		}
	}

	async function leave(gym: Gym) {
		if (!(await confirmAction(`Выйти из зала «${gym.name}»? Ваши результаты останутся в истории.`))) return

		try {
			await app.leaveGym(gym.id)
		} catch (error) {
			app.notify((error as Error).message, true)
		}
	}
</script>

<!--
	Только залы, где ты уже есть. Вступают по ссылке-приглашению, это происходит само при её
	открытии, поэтому формы с кодом здесь нет.
-->
<section class="gyms">
	<ScreenTitle text="Залы" />

	<ul class="gyms__list">
		{#each app.gyms as gym (gym.id)}
			{@const current = gym.id === app.gym?.id}
			<li class="card gyms__item" class:gyms__item--current={current}>
				<button
					class="gyms__pick"
					aria-current={current ? 'true' : undefined}
					onclick={() => {
						haptic('select')
						app.selectGym(gym.id)
					}}
				>
					<span class="gyms__info">
						<span class="gyms__name">{gym.name}</span>
						<span class="muted gyms__meta">
							{plural(gym.members, ['участник', 'участника', 'участников'])}{gym.role === 'admin'
								? ' · вы админ'
								: ''}
						</span>
					</span>
					{#if current}<span class="gyms__check"><Icon name="check" size={22} /></span>{/if}
				</button>
				<div class="gyms__actions">
					<button class="btn btn--small btn--primary gyms__invite" onclick={() => share(gym)}>
						<Icon name="share" size={18} /> Пригласить
					</button>
					<button class="btn btn--small btn--ghost gyms__leave" onclick={() => leave(gym)}
						>Выйти из зала</button
					>
				</div>
			</li>
		{/each}
	</ul>

	<p class="muted gyms__hint">
		Чтобы позвать человека в зал, отправьте ему приглашение: он окажется в зале, как только откроет ссылку.
	</p>
</section>

<style>
	.gyms {
		display: grid;
		gap: 12px;

		&__list {
			display: grid;
			gap: 10px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__item {
			display: grid;
			gap: 14px;
			outline: 2px solid transparent;
		}

		&__item--current {
			outline-color: var(--accent);
		}

		&__pick {
			display: flex;
			gap: 12px;
			align-items: center;
			padding: 0;
			border: 0;
			text-align: left;
			background: none;
		}

		&__info {
			display: grid;
			flex: 1;
			gap: 2px;
			min-width: 0;
		}

		&__name {
			font-size: 1.15rem;
			font-weight: 700;
		}

		&__meta {
			font-size: 0.9rem;
		}

		&__check {
			color: var(--accent);
		}

		&__actions {
			display: flex;
			gap: 8px;
			align-items: center;
			justify-content: space-between;
		}

		&__leave {
			color: var(--muted);
		}

		&__hint {
			font-size: 0.85rem;
		}
	}
</style>
