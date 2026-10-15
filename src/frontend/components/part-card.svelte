<script lang="ts">
	import Icon from '#frontend/components/icon.svelte'
	import { partMeta } from '#frontend/lib/format.ts'
	import { PART_KIND_LABELS, type Part } from '#shared/types.ts'

	let { part, onclick }: { part: Part; onclick?: () => void } = $props()

	const meta = $derived(partMeta(part))
</script>

<svelte:element this={onclick ? 'button' : 'div'} class="card part-card" {onclick} role={onclick ? undefined : 'group'}>
	<div class="part-card__head">
		<span class="part-card__kind">{PART_KIND_LABELS[part.kind]}</span>
		{#if meta}<span class="part-card__meta">{meta}</span>{/if}
		{#if onclick}<span class="part-card__go"><Icon name="chevron" size={20} /></span>{/if}
	</div>

	{#if part.title && part.title !== PART_KIND_LABELS[part.kind]}
		<p class="part-card__title">{part.title}</p>
	{/if}

	{#if part.movements.length}
		<ul class="part-card__movements">
			{#each part.movements as m, i (i)}
				<li class="part-card__movement">
					<span class="part-card__reps">{m.reps}</span>
					<span>{m.name}</span>
					{#if m.weightM || m.weightF}
						<span class="part-card__weight">{[m.weightM, m.weightF].filter(Boolean).join('/')} кг</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if part.description}
		<p class="part-card__description">{part.description}</p>
	{/if}
</svelte:element>

<style>
	.part-card {
		display: grid;
		gap: 8px;
		width: 100%;
		border: 0;
		text-align: left;

		&__head {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		&__kind {
			padding: 2px 8px;
			border-radius: 6px;
			font-size: 0.8rem;
			font-weight: 800;
			color: var(--accent-fg);
			text-transform: uppercase;
			letter-spacing: 0.04em;
			background: var(--accent);
		}

		&__meta {
			font-weight: 600;
			color: var(--muted);
		}

		&__go {
			margin-left: auto;
			color: var(--muted);
		}

		&__title {
			font-size: 1.1rem;
			font-weight: 700;
		}

		&__movements {
			display: grid;
			gap: 4px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__movement {
			display: flex;
			gap: 8px;
			align-items: baseline;
		}

		&__reps {
			min-width: 2.5ch;
			font-family: var(--font-mono);
			font-weight: 700;
		}

		&__weight {
			margin-left: auto;
			font-size: 0.9rem;
			color: var(--muted);
			white-space: nowrap;
		}

		&__description {
			font-size: 0.9rem;
			color: var(--muted);
			white-space: pre-line;
		}
	}
</style>
