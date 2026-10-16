<script lang="ts">
	import ScreenTitle from '#frontend/components/screen-title.svelte'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'

	let name = $state('')
	let code = $state('')
	let busy = $state(false)

	async function run(action: () => Promise<void>) {
		busy = true

		try {
			await action()
			haptic('success')
		} catch (error) {
			haptic('error')
			app.notify((error as Error).message, true)
		} finally {
			busy = false
		}
	}

	// Код можно вставить целиком ссылкой: t.me/bot?startapp=gym_abc.
	const inviteCode = (raw: string) => raw.trim().match(/gym_([a-z0-9]+)/i)?.[1] ?? raw.trim()
</script>

<section class="gym-setup">
	<ScreenTitle text="Ваш зал" />
	<p class="muted">
		Тренировка дня и рейтинг общие для зала. Попросите у знакомых приглашение или заведите зал сами.
	</p>

	<form
		class="card gym-setup__form"
		onsubmit={(event) => {
			event.preventDefault()
			void run(() => app.join(inviteCode(code)))
		}}
	>
		<label class="field">
			<span class="field__label">Код или ссылка-приглашение</span>
			<input class="field__input" bind:value={code} placeholder="t.me/…?startapp=gym_…" autocomplete="off" />
		</label>
		<button class="btn btn--primary" disabled={busy || !code.trim()}>Вступить</button>
	</form>

	<form
		class="card gym-setup__form"
		onsubmit={(event) => {
			event.preventDefault()
			void run(() => app.createGym(name.trim()))
		}}
	>
		<label class="field">
			<span class="field__label">Новый зал</span>
			<input class="field__input" bind:value={name} placeholder="CrossFit Box на Ленина" maxlength="80" />
		</label>
		<button class="btn" disabled={busy || !name.trim()}>Создать зал</button>
	</form>
</section>

<style>
	.gym-setup {
		display: grid;
		gap: 12px;

		&__form {
			display: grid;
			gap: 12px;
		}
	}
</style>
