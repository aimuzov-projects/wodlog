<script lang="ts">
	import Icon, { type IconName } from '#frontend/components/icon.svelte'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app, type Screen } from '#frontend/state/app.svelte.ts'

	// Кнопка справа снизу, под большим пальцем: всё, что не тренировка дня, спрятано сюда.
	const items: { label: string; icon: IconName; screen: Screen | null }[] = [
		{ label: 'Тренировка', icon: 'board', screen: null },
		{ label: 'Таймер', icon: 'timer', screen: { name: 'timer-setup' } },
		{ label: 'Рейтинг', icon: 'trophy', screen: { name: 'rating' } },
		{ label: 'Профиль', icon: 'user', screen: { name: 'profile' } },
		{ label: 'Залы', icon: 'users', screen: { name: 'gyms' } },
	]

	let open = $state(false)

	const current = (screen: Screen | null) => (screen ? app.screen?.name === screen.name : !app.screen)

	function toggle() {
		haptic('light')
		open = !open
	}

	function pick(screen: Screen | null) {
		haptic('select')
		open = false

		if (screen) app.go(screen)
		else app.home()
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (open = false)} />

{#if open}
	<button class="menu-fab__backdrop" aria-label="Закрыть меню" onclick={() => (open = false)}></button>
	<nav class="menu-fab__sheet" aria-label="Меню">
		{#each items as item (item.label)}
			<button
				class="menu-fab__item"
				class:menu-fab__item--current={current(item.screen)}
				aria-current={current(item.screen) ? 'page' : undefined}
				onclick={() => pick(item.screen)}
			>
				<Icon name={item.icon} size={22} />
				{item.label}
			</button>
		{/each}
	</nav>
{/if}

<button class="menu-fab" aria-label={open ? 'Закрыть меню' : 'Меню'} aria-expanded={open} onclick={toggle}>
	<Icon name={open ? 'close' : 'menu'} size={26} />
</button>

<style>
	.menu-fab {
		position: fixed;
		z-index: 21;
		right: var(--gutter);
		bottom: calc(var(--safe-bottom) + 16px);
		display: grid;
		place-items: center;
		width: var(--fab-size);
		height: var(--fab-size);
		border: 0;
		border-radius: 50%;
		color: var(--accent-fg);
		background: var(--accent);
		box-shadow: 0 8px 24px rgb(0 0 0 / 30%);
		transition: transform 0.1s ease;

		&:active {
			transform: scale(0.94);
		}

		&__backdrop {
			position: fixed;
			z-index: 19;
			inset: 0;
			border: 0;
			background: rgb(0 0 0 / 40%);
		}

		&__sheet {
			position: fixed;
			z-index: 20;
			right: var(--gutter);
			bottom: calc(var(--safe-bottom) + 16px + var(--fab-size) + 12px);
			display: grid;
			gap: 2px;
			min-width: 220px;
			padding: 8px;
			border-radius: var(--radius);
			background: var(--surface);
			box-shadow: 0 12px 32px rgb(0 0 0 / 30%);
		}

		&__item {
			display: flex;
			gap: 12px;
			align-items: center;
			padding: 12px;
			border: 0;
			border-radius: var(--radius-small);
			font-size: 1.05rem;
			font-weight: 600;
			text-align: left;
			background: none;
		}

		&__item--current {
			color: var(--accent);
		}
	}
</style>
