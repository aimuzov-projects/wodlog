/**
 * Логика кроссфит-таймера без привязки к экрану.
 *
 * Таймер -- это лента отрезков (подготовка, работа, отдых), а состояние в любой момент
 * вычисляется из прошедшего времени. Поэтому ничего не уплывает, когда вкладка уходит в фон
 * и интервалы браузера засыпают: UI просто спрашивает состояние на текущий момент.
 */

export type TimerMode = 'for_time' | 'amrap' | 'emom' | 'intervals'

export type TimerConfig =
	| { mode: 'for_time'; capSec: number | null }
	| { mode: 'amrap'; durationSec: number }
	| { mode: 'emom'; intervalSec: number; rounds: number }
	| { mode: 'intervals'; workSec: number; restSec: number; rounds: number }

export const TABATA: TimerConfig = { mode: 'intervals', workSec: 20, restSec: 10, rounds: 8 }

export const PREP_SEC = 10

export type Phase = 'prep' | 'work' | 'rest' | 'done'

type Segment = { phase: Exclude<Phase, 'done'>; ms: number; round: number }

export type TimerState = {
	phase: Phase
	/** Текущий раунд с единицы, 0 на подготовке. */
	round: number
	/** Всего раундов, `null` -- для For Time и AMRAP раунды считает сам спортсмен. */
	rounds: number | null
	/** Что показывать на табло: прошедшее время для For Time, оставшееся для остальных. */
	displayMs: number
	/** Сколько осталось до конца отрезка, `Infinity` для For Time без капа. */
	phaseLeftMs: number
	/** Время с конца подготовки. */
	workElapsedMs: number
}

function segments(config: TimerConfig): Segment[] {
	const prep: Segment = { phase: 'prep', ms: PREP_SEC * 1000, round: 0 }

	switch (config.mode) {
		case 'for_time':
			return [prep, { phase: 'work', ms: config.capSec ? config.capSec * 1000 : Infinity, round: 1 }]
		case 'amrap':
			return [prep, { phase: 'work', ms: config.durationSec * 1000, round: 1 }]
		case 'emom':
			return [
				prep,
				...Array.from({ length: config.rounds }, (_, i) => ({
					phase: 'work' as const,
					ms: config.intervalSec * 1000,
					round: i + 1,
				})),
			]
		case 'intervals':
			return [
				prep,
				...Array.from({ length: config.rounds }, (_, i) => [
					{ phase: 'work' as const, ms: config.workSec * 1000, round: i + 1 },
					// Последний отдых не нужен: после последней работы таймер заканчивается.
					...(i < config.rounds - 1 && config.restSec > 0
						? [{ phase: 'rest' as const, ms: config.restSec * 1000, round: i + 1 }]
						: []),
				]).flat(),
			]
	}
}

/** Полная длительность без подготовки, `Infinity` для For Time без капа. */
export function totalMs(config: TimerConfig): number {
	return segments(config)
		.slice(1)
		.reduce((sum, s) => sum + s.ms, 0)
}

export function timerState(config: TimerConfig, elapsedMs: number): TimerState {
	const rounds = config.mode === 'emom' || config.mode === 'intervals' ? config.rounds : null
	const list = segments(config)
	const prepMs = list[0].ms

	let start = 0

	for (const segment of list) {
		const end = start + segment.ms

		if (elapsedMs < end) {
			const inPhase = elapsedMs - start
			const left = end - elapsedMs

			return {
				phase: segment.phase,
				round: segment.round,
				rounds,
				displayMs: config.mode === 'for_time' && segment.phase === 'work' ? inPhase : left,
				phaseLeftMs: left,
				workElapsedMs: Math.max(0, elapsedMs - prepMs),
			}
		}

		start = end
	}

	return {
		phase: 'done',
		round: rounds ?? 1,
		rounds,
		displayMs: config.mode === 'for_time' ? start - prepMs : 0,
		phaseLeftMs: 0,
		workElapsedMs: start - prepMs,
	}
}

/**
 * Секундомер с паузой. Время передаётся снаружи, чтобы в тестах не ждать по-настоящему,
 * а в браузере брать `performance.now()`.
 */
export class Stopwatch {
	#startedAt: number | null = null
	#accumulated = 0

	get running() {
		return this.#startedAt !== null
	}

	start(now: number) {
		if (this.#startedAt === null) this.#startedAt = now
	}

	pause(now: number) {
		if (this.#startedAt === null) return

		this.#accumulated += now - this.#startedAt
		this.#startedAt = null
	}

	reset() {
		this.#startedAt = null
		this.#accumulated = 0
	}

	elapsed(now: number) {
		return this.#accumulated + (this.#startedAt === null ? 0 : now - this.#startedAt)
	}
}

/** 75 000 мс → «01:15», час и больше → «1:02:03». Доли секунды округляются вверх на обратном отсчёте. */
export function formatClock(ms: number, roundUp = false): string {
	const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const pad = (n: number) => String(n).padStart(2, '0')

	return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export type TimerResult = {
	rounds: number | null
	timeSec: number | null
	capped: boolean
}

/**
 * Что записать в результат комплекса после таймера.
 *
 * AMRAP и упёршийся в кап For Time -- раунды, отмеченные тапами. Финиш For Time -- время.
 * EMOM -- сколько интервалов прошло, все, если таймер дошёл до конца.
 */
export function resultFromTimer(config: TimerConfig, elapsedMs: number, laps: number): TimerResult {
	const state = timerState(config, elapsedMs)
	const done = state.phase === 'done'

	switch (config.mode) {
		case 'for_time':
			return done
				? { rounds: laps, timeSec: null, capped: true }
				: { rounds: null, timeSec: Math.round(state.workElapsedMs / 1000), capped: false }
		case 'emom':
		case 'intervals':
			return { rounds: done ? config.rounds : Math.max(0, state.round - 1), timeSec: null, capped: false }
		case 'amrap':
			return { rounds: laps, timeSec: null, capped: false }
	}
}

/** Таймер под комплекс тренировки: формат и параметры с доски. */
export function configForPart(part: {
	kind: string
	timeCapSec: number | null
	intervalSec: number | null
	rounds: number | null
}): TimerConfig {
	switch (part.kind) {
		case 'amrap':
			return { mode: 'amrap', durationSec: part.timeCapSec || 12 * 60 }
		case 'emom':
			return { mode: 'emom', intervalSec: part.intervalSec || 60, rounds: part.rounds || 10 }
		default:
			return { mode: 'for_time', capSec: part.timeCapSec }
	}
}
