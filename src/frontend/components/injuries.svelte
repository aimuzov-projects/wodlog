<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { haptic } from '#frontend/lib/telegram.ts'
	import { app } from '#frontend/state/app.svelte.ts'
	import {
		BODY_ZONE_LABELS,
		MEDICAL_DISCLAIMER,
		injuriesInZone,
		injuryZones,
		type BodyZone,
	} from '#shared/injuries.ts'

	let zone = $state<BodyZone | null>(null)

	const zones = injuryZones()
	const list = $derived(injuriesInZone(zone))

	function pick(next: BodyZone | null) {
		haptic('select')
		zone = next
	}
</script>

<section class="injuries">
	<h1 class="injuries__title">Травмы</h1>
	<p class="muted">
		Частые травмы в кроссфите: на каких движениях случаются, как распознать и как тренироваться вокруг.
	</p>

	<p class="card injuries__disclaimer" role="note"><Icon name="alert" size={18} /> {MEDICAL_DISCLAIMER}</p>

	<div class="chips" role="group" aria-label="Зона тела">
		<button class="chip" class:chip--active={!zone} aria-pressed={!zone} onclick={() => pick(null)}>Все</button>
		{#each zones as z (z)}
			<button class="chip" class:chip--active={zone === z} aria-pressed={zone === z} onclick={() => pick(z)}>
				{BODY_ZONE_LABELS[z]}
			</button>
		{/each}
	</div>

	<ul class="injuries__list">
		{#each list as injury (injury.id)}
			<li>
				<button class="card injuries__item" onclick={() => app.open({ name: 'injury', id: injury.id })}>
					{#if injury.image}
						<img
							class="injuries__thumb"
							src={injury.image.src}
							alt=""
							loading="lazy"
							width="72"
							height="72"
						/>
					{/if}
					<span class="injuries__text">
						<span class="injuries__zone">{BODY_ZONE_LABELS[injury.zone]}</span>
						<span class="injuries__name">{injury.title}</span>
					</span>
					<span class="injuries__chevron"><Icon name="chevron" size={20} /></span>
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.injuries {
		display: grid;
		gap: 12px;

		&__title {
			font-size: 1.8rem;
			font-weight: 800;
		}

		&__disclaimer {
			display: flex;
			gap: 8px;
			align-items: flex-start;
			font-size: 0.85rem;
			color: var(--muted);
		}

		&__list {
			display: grid;
			gap: 10px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__item {
			display: flex;
			gap: 12px;
			align-items: center;
			width: 100%;
			border: 0;
			text-align: left;
		}

		&__thumb {
			flex: none;
			width: 72px;
			height: 72px;
			border-radius: var(--radius-small);
			object-fit: cover;
			background: #ffffff;
		}

		&__text {
			display: grid;
			flex: 1;
			gap: 2px;
			min-width: 0;
		}

		&__zone {
			font-size: 0.75rem;
			font-weight: 700;
			color: var(--accent);
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		&__name {
			font-weight: 700;
		}

		&__chevron {
			color: var(--muted);
		}
	}
</style>
