<script lang="ts">
	import { haptic } from '#frontend/lib/telegram.ts'

	let {
		label,
		value,
		onchange,
		step = 1,
		min = 0,
		unit = '',
		format = String,
		compact = false,
	}: {
		label: string
		value: number
		onchange: (value: number) => void
		step?: number
		min?: number
		unit?: string
		/** Как показать число: например, секунды интервала как «1:30». */
		format?: (value: number) => string
		/** Поменьше: для формы, где степперов несколько подряд. */
		compact?: boolean
	} = $props()

	function change(delta: number) {
		haptic('select')
		onchange(Math.max(min, value + delta))
	}
</script>

<!-- type="button": степпер стоит и в формах, там кнопка по умолчанию отправляла бы форму. -->
<div class="stepper" class:stepper--compact={compact}>
	<span class="field__label">{label}</span>
	<div class="stepper__controls">
		<button
			type="button"
			class="btn stepper__step"
			aria-label={`${label}: меньше`}
			disabled={value <= min}
			onclick={() => change(-step)}>−</button
		>
		<span class="stepper__value">{format(value)}<small class="stepper__unit">{unit}</small></span>
		<button type="button" class="btn stepper__step" aria-label={`${label}: больше`} onclick={() => change(step)}
			>+</button
		>
	</div>
</div>

<style>
	.stepper {
		display: grid;
		gap: 8px;

		&__controls {
			display: grid;
			grid-template-columns: 64px 1fr 64px;
			align-items: center;
		}

		&__step {
			font-size: 1.6rem;
		}

		&__value {
			font-family: var(--font-mono);
			font-size: 2.2rem;
			font-weight: 800;
			text-align: center;
		}

		&__unit {
			margin-left: 4px;
			font-size: 1rem;
			font-weight: 600;
			color: var(--muted);
		}
	}

	.stepper--compact {
		gap: 4px;

		.stepper__controls {
			grid-template-columns: 52px 1fr 52px;
		}

		.stepper__value {
			font-size: 1.6rem;
		}
	}
</style>
