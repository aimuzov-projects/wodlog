<script lang="ts">
	import type { UserBrief } from '#shared/types.ts'

	let { user, size = 36 }: { user: UserBrief; size?: number } = $props()

	let broken = $state(false)

	const initials = $derived(
		user.name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0] ?? '')
			.join('')
			.toUpperCase(),
	)
	// Стабильный цвет по id, чтобы люди без фото различались.
	const hue = $derived((user.id * 47) % 360)
</script>

<span class="avatar" style:width="{size}px" style:height="{size}px" style:--hue={hue}>
	{#if user.photoUrl && !broken}
		<img class="avatar__img" src={user.photoUrl} alt="" onerror={() => (broken = true)} />
	{:else}
		<span class="avatar__initials" style:font-size="{size * 0.4}px">{initials}</span>
	{/if}
</span>

<style>
	.avatar {
		overflow: hidden;
		display: inline-grid;
		flex: none;
		place-items: center;
		border-radius: 50%;
		background: hsl(var(--hue) 55% 55%);

		&__img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		&__initials {
			font-weight: 700;
			color: #ffffff;
		}
	}
</style>
