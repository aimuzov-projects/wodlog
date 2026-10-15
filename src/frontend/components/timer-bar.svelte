<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { app } from '#frontend/state/app.svelte.ts'
	import { timer } from '#frontend/state/timer.svelte.ts'
	import { formatClock } from '#shared/timer.ts'

	// Плашка над вкладками, пока таймер свёрнут: видно время и можно вернуться одним тапом.
	const session = $derived(timer.session)
	const view = $derived(timer.view)
	const countsDown = $derived(session?.config.mode !== 'for_time' || view?.phase === 'prep')

	function open() {
		if (timer.finished && session?.source) app.showTimerResult()
		else app.open({ name: 'timer' })
	}
</script>

{#if session && view}
	<button class="timer-bar timer-bar--{view.phase}" onclick={open}>
		<Icon name="timer" size={20} />
		<span class="timer-bar__title">{session.title}</span>
		{#if timer.finished && session.source}
			<span class="timer-bar__action">Записать результат</span>
		{:else}
			<span class="timer-bar__clock">{formatClock(view.displayMs, countsDown)}</span>
			{#if view.rounds}
				<span class="timer-bar__rounds">{Math.max(1, view.round)}/{view.rounds}</span>
			{:else if session.laps}
				<span class="timer-bar__rounds">{session.laps} р.</span>
			{/if}
		{/if}
	</button>
{/if}

<style>
	.timer-bar {
		--phase: var(--accent);

		position: fixed;
		z-index: 11;
		/* В одном ряду с кнопкой меню, слева от неё. */
		right: calc(var(--gutter) + var(--fab-size) + 10px);
		bottom: calc(var(--safe-bottom) + 20px);
		left: var(--gutter);
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 10px 14px;
		border: 0;
		border-left: 4px solid var(--phase);
		border-radius: var(--radius);
		color: #ffffff;
		background: #0b0b0e;
		box-shadow: 0 8px 24px rgb(0 0 0 / 25%);

		&__title {
			overflow: hidden;
			flex: 1;
			font-weight: 600;
			text-align: left;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__clock {
			font-family: var(--font-mono);
			font-size: 1.2rem;
			font-weight: 800;
			font-variant-numeric: tabular-nums;
		}

		&__rounds {
			font-weight: 700;
			opacity: 0.7;
		}

		&__action {
			font-weight: 700;
			color: var(--phase);
		}
	}

	.timer-bar--prep {
		--phase: #f5b301;
	}

	.timer-bar--work {
		--phase: #2ecc71;
	}

	.timer-bar--rest {
		--phase: #3fa7ff;
	}

	.timer-bar--done {
		--phase: #ff6a3d;
	}
</style>
