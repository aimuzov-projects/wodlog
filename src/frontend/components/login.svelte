<script lang="ts">
	import { onMount } from 'svelte'

	import { app } from '#frontend/state/app.svelte.ts'

	let { botUsername }: { botUsername: string } = $props()

	let widget: HTMLDivElement
	let error = $state('')

	async function signIn(path: string, payload: unknown) {
		try {
			error = ''
			await app.signIn(path, payload)
		} catch (e) {
			error = (e as Error).message
		}
	}

	onMount(() => {
		if (!botUsername) return

		// Виджет зовёт глобальную функцию по имени из data-onauth.
		const global = window as unknown as Record<string, unknown>

		global.onTelegramAuth = (user: unknown) => void signIn('/api/auth/widget', user)

		const script = document.createElement('script')

		script.src = 'https://telegram.org/js/telegram-widget.js?22'
		script.async = true
		script.dataset.telegramLogin = botUsername
		script.dataset.size = 'large'
		script.dataset.radius = '12'
		script.dataset.onauth = 'onTelegramAuth(user)'
		script.dataset.requestAccess = 'write'
		widget.append(script)
	})
</script>

<section class="login">
	<h1 class="login__logo">WODlog</h1>
	<p class="login__lead">Тренировка дня с доски, ваши результаты, рейтинг зала и таймер.</p>

	<div class="login__widget" bind:this={widget}></div>

	{#if botUsername}
		<a class="btn btn--primary" href={`https://t.me/${botUsername}?startapp`}>Открыть в Telegram</a>
	{/if}

	<button class="btn btn--ghost" onclick={() => (app.status = 'timer')}>Просто открыть таймер</button>

	{#if import.meta.env.DEV}
		<button class="btn" onclick={() => signIn('/api/auth/dev', { id: 1, name: 'Dev' })}
			>Войти без Telegram (dev)</button
		>
	{/if}

	{#if error}
		<p class="login__error" role="alert">{error}</p>
	{/if}
</section>

<style>
	.login {
		display: grid;
		gap: 16px;
		place-content: center;
		justify-items: center;
		min-height: 100dvh;
		padding: calc(var(--safe-top) + 24px) var(--gutter) calc(var(--safe-bottom) + 24px);
		text-align: center;

		&__logo {
			font-family: var(--font-display);
			font-size: 3rem;
			font-weight: 800;
			color: var(--accent);
			letter-spacing: -0.03em;
		}

		&__lead {
			max-width: 28ch;
			color: var(--muted);
		}

		&__widget {
			min-height: 48px;
		}

		&__error {
			color: var(--danger);
		}
	}
</style>
