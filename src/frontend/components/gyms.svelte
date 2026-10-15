<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import GymSetup from '#frontend/components/gym-setup.svelte'
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

<section class="gyms">
	<ScreenTitle text="Залы" />

	{#each app.gyms as gym (gym.id)}
		<div class="card gyms__item" class:gyms__item--current={gym.id === app.gym?.id}>
			<button class="gyms__pick" onclick={() => app.selectGym(gym.id)}>
				<span class="gyms__name">{gym.name}</span>
				<span class="muted">
					{plural(gym.members, ['участник', 'участника', 'участников'])}{gym.role === 'admin'
						? ' · вы админ'
						: ''}
				</span>
			</button>
			<div class="gyms__actions">
				<button class="btn btn--small" onclick={() => share(gym)}>
					<Icon name="share" size={18} /> Пригласить
				</button>
				<button class="btn btn--small btn--ghost btn--danger" onclick={() => leave(gym)}>Выйти</button>
			</div>
		</div>
	{/each}

	<h2 class="section-title">Добавить зал</h2>
	<GymSetup compact />
</section>

<style>
	.gyms {
		display: grid;
		gap: 10px;

		&__item {
			display: grid;
			gap: 12px;
			border: 2px solid transparent;
		}

		&__item--current {
			border-color: var(--accent);
		}

		&__pick {
			display: grid;
			gap: 2px;
			padding: 0;
			border: 0;
			text-align: left;
			background: none;
		}

		&__name {
			font-size: 1.1rem;
			font-weight: 700;
		}

		&__actions {
			display: flex;
			gap: 8px;
		}
	}
</style>
