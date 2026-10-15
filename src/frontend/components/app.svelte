<script lang="ts">
	import { onMount } from 'svelte'

	import GymSetup from '#frontend/components/gym-setup.svelte'
	import Gyms from '#frontend/components/gyms.svelte'
	import Login from '#frontend/components/login.svelte'
	import PartScreen from '#frontend/components/part-screen.svelte'
	import Profile from '#frontend/components/profile.svelte'
	import Rating from '#frontend/components/rating.svelte'
	import Icon from '#frontend/components/icon.svelte'
	import MenuFab from '#frontend/components/menu-fab.svelte'
	import TimerBar from '#frontend/components/timer-bar.svelte'
	import TimerRun from '#frontend/components/timer-run.svelte'
	import TimerSetup from '#frontend/components/timer-setup.svelte'
	import Today from '#frontend/components/today.svelte'
	import WorkoutEditor from '#frontend/components/workout-editor.svelte'
	import { registerServiceWorker } from '#frontend/lib/pwa.ts'
	import { swipe } from '#frontend/lib/swipe.ts'
	import { initTelegram, insideTelegram } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'

	let { botUsername }: { botUsername: string } = $props()

	// Свайп вправо на вложенном экране -- назад, как в iOS. В редакторе нет: так легко потерять правки.
	const backSwipe = $derived({
		enabled: Boolean(app.screen) && app.screen?.name !== 'editor',
		onswipe: () => app.back(),
		allowed: (direction: 'left' | 'right') => direction === 'right',
	})

	onMount(() => {
		initTelegram()
		registerServiceWorker()
		void app.start()
	})
</script>

<div class="shell">
	{#if app.status === 'loading'}
		<div class="shell__center" aria-busy="true">
			<div class="shell__logo">WODlog</div>
		</div>
	{:else if app.screen?.name === 'timer'}
		<!-- Таймер на весь экран, без вкладок: экран не должен отвлекать. -->
		<TimerRun />
	{:else if app.status === 'error'}
		<div class="shell__center">
			<p>{app.error}</p>
			<button class="btn btn--primary" onclick={() => location.reload()}>Попробовать снова</button>
			<button class="btn" onclick={() => (app.status = 'timer')}>Открыть таймер</button>
		</div>
	{:else if app.status === 'login'}
		<Login {botUsername} />
	{:else if app.status === 'timer'}
		<main class="shell__main shell__main--bare">
			<TimerSetup />
			<button class="btn btn--ghost btn--wide" onclick={() => app.start()}>Войти</button>
		</main>
		<TimerBar />
	{:else}
		<main class="shell__main" use:swipe={backSwipe}>
			<!-- В Telegram «Назад» системная, в браузере своя. -->
			{#if app.screen && !insideTelegram()}
				<button class="btn btn--small btn--ghost shell__back" onclick={() => app.back()}>
					<Icon name="left" size={18} /> Назад
				</button>
			{/if}

			{#if app.screen?.name === 'editor'}
				<WorkoutEditor date={app.screen.date} draft={app.screen.draft} />
			{:else if app.screen?.name === 'part'}
				<!-- key: после таймера тот же комплекс открывается заново, уже с заполненной формой. -->
				{#key app.screen}
					<PartScreen part={app.screen.part} date={app.screen.date} prefill={app.screen.prefill} />
				{/key}
			{:else if app.screen?.name === 'gyms'}
				<Gyms />
			{:else if app.screen?.name === 'timer-setup'}
				<TimerSetup />
			{:else if app.screen?.name === 'profile'}
				<Profile />
			{:else if !app.gym}
				<GymSetup />
			{:else if app.screen?.name === 'rating'}
				<Rating />
			{:else}
				<Today />
			{/if}
		</main>
		<TimerBar />
		<!-- В редакторе внизу свои кнопки «Отмена» и «Сохранить». -->
		{#if app.screen?.name !== 'editor'}<MenuFab />{/if}
	{/if}

	{#if app.toast}
		<div class="shell__toast" class:shell__toast--error={app.toast.error} role="status">{app.toast.text}</div>
	{/if}
</div>

<style>
	.shell {
		min-height: 100dvh;

		/* Снизу место под кнопку меню и плашку таймера, они висят поверх в одном ряду. */
		&__main {
			transform: translateX(var(--swipe-dx, 0));
			padding: calc(var(--safe-top) + 12px) var(--gutter) calc(var(--fab-size) + var(--safe-bottom) + 40px);
			transition: transform 0.2s ease;
		}

		&__main:global([data-swiping]) {
			transition: none;
		}

		&__main--bare {
			padding-bottom: calc(var(--safe-bottom) + 24px);
		}

		&__back {
			margin: -4px 0 8px -12px;
		}

		&__center {
			display: grid;
			gap: 16px;
			place-content: center;
			min-height: 100dvh;
			padding: var(--gutter);
			text-align: center;
		}

		&__logo {
			font-family: var(--font-display);
			font-size: 2rem;
			font-weight: 800;
			letter-spacing: -0.02em;
			animation: pulse 1.2s ease-in-out infinite alternate;
		}

		&__toast {
			position: fixed;
			z-index: 20;
			right: var(--gutter);
			bottom: calc(var(--safe-bottom) + 16px + var(--fab-size) + 12px);
			left: var(--gutter);
			padding: 12px 16px;
			border-radius: var(--radius);
			font-weight: 500;
			color: var(--bg);
			background: var(--fg);
			box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
		}

		&__toast--error {
			color: #ffffff;
			background: var(--danger);
		}
	}

	@keyframes pulse {
		from {
			opacity: 0.4;
		}

		to {
			opacity: 1;
		}
	}
</style>
