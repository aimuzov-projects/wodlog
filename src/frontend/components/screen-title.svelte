<script lang="ts">
	let { text }: { text: string } = $props()
</script>

<!-- В полноэкранном Telegram тот же текст показывает top-bar.svelte, а здесь заголовок прячется. -->
<h1 class="screen-title">{text}</h1>

<style>
	.screen-title {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 800;
		letter-spacing: -0.02em;

		:global(html[data-fullscreen]) & {
			display: none;
		}
	}
</style>
