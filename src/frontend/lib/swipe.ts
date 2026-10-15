/**
 * Горизонтальный свайп пальцем: листать дни на главной и возвращаться назад с вложенных экранов.
 *
 * Засчитывается только почти горизонтальное движение, иначе свайпом становилась бы обычная
 * прокрутка страницы. Пока палец ведёт, элемент получает `--swipe-dx`, чтобы экран тянулся следом.
 */

export type SwipeDirection = 'left' | 'right'

/** Сдвиг, после которого жест засчитан, px. */
const DISTANCE = 60
/** Насколько горизонталь должна перевешивать вертикаль. */
const RATIO = 1.5
/** Дольше -- это уже не свайп, а неторопливое перетаскивание. */
const MAX_TIME = 800
/** Пока сдвиг меньше, ещё не ясно, листают или прокручивают. */
const DEAD_ZONE = 10

/** Свайп из смещения пальца и длительности жеста, `null` -- не свайп. */
export function swipeDirection(dx: number, dy: number, ms: number): SwipeDirection | null {
	if (ms > MAX_TIME || Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * RATIO) return null

	return dx < 0 ? 'left' : 'right'
}

// В полях и элементах с data-no-swipe палец двигает текст или ползунок, а не экран.
const IGNORED = 'input, textarea, select, [contenteditable], [data-no-swipe]'

type Options = {
	onswipe: (direction: SwipeDirection) => void
	/** `false` -- жест не отслеживается вовсе: например, на главной у главной свой свайп. */
	enabled?: boolean
	/** Можно ли листать в эту сторону: в запрещённую экран тянется туго и не перелистывается. */
	allowed?: (direction: SwipeDirection) => boolean
}

/** Svelte-action: `<section use:swipe={{ onswipe }}>`. */
export function swipe(node: HTMLElement, initial: Options) {
	let options = initial
	let start: { x: number; y: number; t: number; id: number } | null = null
	let horizontal = false

	// Пока палец ведёт, анимация возврата не нужна: экран должен идти за пальцем без задержки.
	const setDx = (dx: number) => {
		node.style.setProperty('--swipe-dx', `${dx}px`)
		node.toggleAttribute('data-swiping', dx !== 0)
	}

	// Горизонтальный жест остаётся нам, иначе браузер забирает его себе и шлёт pointercancel.
	node.style.touchAction = 'pan-y pinch-zoom'

	function down(event: PointerEvent) {
		if (options.enabled === false || event.pointerType === 'mouse' || (event.target as Element).closest(IGNORED))
			return

		start = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId }
		horizontal = false
	}

	function move(event: PointerEvent) {
		if (!start || event.pointerId !== start.id) return

		const dx = event.clientX - start.x
		const dy = event.clientY - start.y

		if (!horizontal) {
			if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return

			// Пошли вертикально -- это прокрутка, свайп больше не ждём.
			if (Math.abs(dy) * RATIO > Math.abs(dx)) {
				start = null

				return
			}

			horizontal = true
		}

		const direction = dx < 0 ? 'left' : 'right'
		const free = options.allowed?.(direction) ?? true

		setDx(free ? dx * 0.5 : dx * 0.15)
	}

	function up(event: PointerEvent) {
		if (!start || event.pointerId !== start.id) return

		const direction = horizontal
			? swipeDirection(event.clientX - start.x, event.clientY - start.y, event.timeStamp - start.t)
			: null

		start = null
		setDx(0)

		if (direction && (options.allowed?.(direction) ?? true)) options.onswipe(direction)
	}

	function cancel() {
		start = null
		setDx(0)
	}

	node.addEventListener('pointerdown', down)
	node.addEventListener('pointermove', move)
	node.addEventListener('pointerup', up)
	node.addEventListener('pointercancel', cancel)

	return {
		update(next: Options) {
			options = next
		},
		destroy() {
			node.removeEventListener('pointerdown', down)
			node.removeEventListener('pointermove', move)
			node.removeEventListener('pointerup', up)
			node.removeEventListener('pointercancel', cancel)
		},
	}
}
