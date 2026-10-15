<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app, type Tab } from '#frontend/state/app.svelte.ts'

	const tabs: { id: Tab; label: string; icon: 'board' | 'timer' | 'trophy' | 'user' }[] = [
		{ id: 'today', label: 'Тренировка', icon: 'board' },
		{ id: 'timer', label: 'Таймер', icon: 'timer' },
		{ id: 'rating', label: 'Рейтинг', icon: 'trophy' },
		{ id: 'profile', label: 'Профиль', icon: 'user' },
	]
</script>

<nav class="tab-bar" aria-label="Разделы">
	{#each tabs as tab (tab.id)}
		<button
			class="tab-bar__item"
			class:tab-bar__item--active={app.tab === tab.id && !app.screen}
			aria-current={app.tab === tab.id ? 'page' : undefined}
			onclick={() => {
				haptic('select')
				app.switchTab(tab.id)
			}}
		>
			<Icon name={tab.icon} />
			<span class="tab-bar__label">{tab.label}</span>
		</button>
	{/each}
</nav>

<style>
	.tab-bar {
		position: fixed;
		z-index: 10;
		right: 0;
		bottom: 0;
		left: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		height: calc(var(--tabbar-height) + var(--safe-bottom));
		padding-bottom: var(--safe-bottom);
		border-top: 1px solid var(--line);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(16px);

		&__item {
			display: grid;
			gap: 2px;
			place-items: center;
			align-content: center;
			border: 0;
			color: var(--muted);
			background: none;
		}

		&__item--active {
			color: var(--accent);
		}

		&__label {
			font-size: 0.7rem;
			font-weight: 600;
		}
	}
</style>
