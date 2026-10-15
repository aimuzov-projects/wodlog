<script lang="ts" module>
	// Иконки в духе Lucide, нарисованы вручную: так не нужна зависимость ради десятка штук.
	const paths = {
		board: 'M3 4h18v12H3z M8 20h8 M12 16v4 M7 8h6 M7 12h10',
		timer: 'M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
		trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
		bandage:
			'M4.9 14.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a3.5 3.5 0 0 1-5-5z M8.5 10.5l5 5 M10.5 12.5h.01 M12 11h.01 M11 14h.01 M13.5 12.5h.01',
		alert: 'M12 3L2 20h20z M12 10v4 M12 17h.01',
		user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
		camera: 'M3 7h4l2-3h6l2 3h4v13H3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
		edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
		plus: 'M12 5v14 M5 12h14',
		chevron: 'M9 6l6 6-6 6',
		left: 'M15 6l-6 6 6 6',
		right: 'M9 6l6 6-6 6',
		play: 'M7 4l13 8-13 8z',
		pause: 'M7 4h3v16H7z M14 4h3v16h-3z',
		reset: 'M4 12a8 8 0 1 0 3-6.2 M4 4v5h5',
		trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
		share: 'M12 3v12 M7 8l5-5 5 5 M5 14v6h14v-6',
		image: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M15 9.5a1.5 1.5 0 1 0 0-.1z',
		lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
		close: 'M6 6l12 12 M18 6L6 18',
		up: 'M6 15l6-6 6 6',
		down: 'M6 9l6 6 6-6',
	}

	export type IconName = keyof typeof paths
</script>

<script lang="ts">
	let { name, size = 24 }: { name: IconName; size?: number } = $props()
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={paths[name]} />
</svg>

<style>
	.icon {
		flex: none;
	}
</style>
