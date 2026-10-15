<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { app } from '#frontend/state/app.svelte.ts'
	import { BODY_ZONE_LABELS, MEDICAL_DISCLAIMER, findInjury } from '#shared/injuries.ts'

	let { id }: { id: string } = $props()

	const injury = $derived(findInjury(id))
</script>

<article class="injury">
	<button class="btn btn--small btn--ghost injury__back" onclick={() => app.back()}>
		<Icon name="left" size={18} /> Все травмы
	</button>

	{#if !injury}
		<p class="muted">Такой травмы в справочнике нет.</p>
	{:else}
		<header class="injury__header">
			<span class="injury__zone">{BODY_ZONE_LABELS[injury.zone]}</span>
			<h1 class="injury__title">{injury.title}</h1>
		</header>

		{#if injury.image}
			<figure class="injury__figure">
				<img class="injury__image" src={injury.image.src} alt={injury.image.alt} width="1200" height="670" />
				<figcaption class="muted">{injury.image.caption}</figcaption>
			</figure>
		{/if}

		<p class="card">{injury.summary}</p>

		<h2 class="section-title">Когда случается в кроссфите</h2>
		<ul class="card injury__list">
			{#each injury.causes as item (item)}<li>{item}</li>{/each}
		</ul>

		<h2 class="section-title">Симптомы</h2>
		<ul class="card injury__list">
			{#each injury.symptoms as item (item)}<li>{item}</li>{/each}
		</ul>

		<h2 class="section-title">Сразу к врачу, если</h2>
		<ul class="card injury__list injury__list--alert">
			{#each injury.redFlags as item (item)}<li>{item}</li>{/each}
		</ul>

		<h2 class="section-title">Что делать</h2>
		<ol class="card injury__list">
			{#each injury.firstSteps as item (item)}<li>{item}</li>{/each}
		</ol>

		<h2 class="section-title">Как менять тренировки</h2>
		<ul class="card injury__swaps">
			{#each injury.modifications as swap (swap.avoid)}
				<li class="injury__swap">
					<span class="injury__avoid">Вместо: {swap.avoid}</span>
					<span class="injury__instead"><Icon name="right" size={16} /> {swap.instead}</span>
				</li>
			{/each}
		</ul>

		<p class="card injury__disclaimer" role="note"><Icon name="alert" size={18} /> {MEDICAL_DISCLAIMER}</p>
	{/if}
</article>

<style>
	.injury {
		display: grid;
		gap: 10px;

		&__back {
			justify-self: start;
			padding-left: 0;
		}

		&__header {
			display: grid;
			gap: 4px;
		}

		&__zone {
			font-size: 0.8rem;
			font-weight: 700;
			color: var(--accent);
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		&__title {
			font-size: 1.6rem;
			font-weight: 800;
			line-height: 1.2;
		}

		&__figure {
			display: grid;
			gap: 6px;
			margin: 0;
			font-size: 0.8rem;
		}

		&__image {
			width: 100%;
			border-radius: var(--radius);
			background: #ffffff;
		}

		&__list {
			display: grid;
			gap: 8px;
			margin: 0;
			padding-left: 36px;
		}

		&__list--alert {
			box-shadow: inset 3px 0 0 var(--danger);

			& ::marker {
				color: var(--danger);
			}
		}

		&__swaps {
			display: grid;
			gap: 0;
			margin: 0;
			padding: 4px 16px;
			list-style: none;
		}

		&__swap {
			display: grid;
			gap: 4px;
			padding: 10px 0;
			border-bottom: 1px solid var(--line);

			&:last-child {
				border-bottom: 0;
			}
		}

		&__avoid {
			font-size: 0.9rem;
			color: var(--muted);
		}

		&__instead {
			display: flex;
			gap: 6px;
			align-items: flex-start;
			font-weight: 600;

			& :global(.icon) {
				margin-top: 3px;
				color: var(--accent);
			}
		}

		&__disclaimer {
			display: flex;
			gap: 8px;
			align-items: flex-start;
			margin-top: 12px;
			font-size: 0.85rem;
			color: var(--muted);
		}
	}
</style>
