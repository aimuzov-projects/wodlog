/**
 * Запущенный таймер, общий для всего приложения.
 *
 * Живёт отдельно от экрана: его можно закрыть, уйти в другую вкладку или перезагрузить Mini App,
 * а отсчёт продолжится. Поэтому время считается по настоящим часам и сохраняется
 * в localStorage, а сигналы подаёт сам стор, а не компонент экрана.
 */

import { beep, keepAwake, unlockAudio } from '#frontend/lib/sound.ts'
import { haptic } from '#frontend/lib/telegram.ts'
import {
	PREP_SEC,
	resultFromTimer,
	timerState,
	type TimerConfig,
	type TimerResult,
	type TimerState,
} from '#shared/timer.ts'
import type { Part } from '#shared/types.ts'

const STORAGE_KEY = 'wodlog.timer.session'
const TICK = 200

/** Комплекс, из которого запустили таймер: туда и уйдёт результат. */
export type TimerSource = { part: Part; date: string }

type Session = {
	config: TimerConfig
	title: string
	source: TimerSource | null
	/** Набежавшее до последней паузы время. */
	accumulatedMs: number
	/** `Date.now()` последнего старта, `null` на паузе. */
	startedAt: number | null
	/** Раунды, отмеченные тапами: в AMRAP и For Time таймер их сам не знает. */
	laps: number
	/** Время вышло или нажат «Финиш». Пауза -- не финиш. */
	finished: boolean
}

function load(): Session | null {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
	} catch {
		return null
	}
}

class TimerSession {
	session = $state<Session | null>(load())
	now = $state(Date.now())

	elapsedMs = $derived(
		this.session
			? this.session.accumulatedMs + (this.session.startedAt ? this.now - this.session.startedAt : 0)
			: 0,
	)
	view = $derived<TimerState | null>(this.session ? timerState(this.session.config, this.elapsedMs) : null)
	running = $derived(Boolean(this.session?.startedAt))
	finished = $derived(Boolean(this.session?.finished))

	#interval: ReturnType<typeof setInterval> | undefined
	#lastSecond = -1
	#lastPhase = ''

	constructor() {
		const session = this.session

		if (!session || session.finished) return

		// Пауз больше нет: таймер, сохранённый на паузе старой версией, просто продолжает идти.
		session.startedAt ??= Date.now()
		this.#run()
	}

	/**
	 * Запускает таймер сразу с отсчёта подготовки: «Старт» уже нажат, второй раз жать незачем.
	 * Вызывается по нажатию, поэтому здесь же можно разбудить звук.
	 */
	start(config: TimerConfig, title: string, source: TimerSource | null) {
		this.#stop()
		unlockAudio()
		this.session = { config, title, source, accumulatedMs: 0, startedAt: Date.now(), laps: 0, finished: false }
		this.#lastSecond = -1
		this.#lastPhase = ''
		this.#save()
		this.#run()
	}

	/** Сразу к работе, без отсчёта подготовки. */
	skipPrep() {
		const session = this.session

		if (!session?.startedAt || this.view?.phase !== 'prep') return

		haptic('medium')
		session.startedAt = Date.now() - (PREP_SEC * 1000 - session.accumulatedMs)
		this.#save()
		this.#tick()
	}

	lap() {
		if (!this.session || this.view?.phase !== 'work') return

		haptic('light')
		this.session.laps += 1
		this.#save()
	}

	/** Результат для комплекса, из которого запустили таймер. */
	result(): TimerResult | null {
		const session = this.session

		return session?.source ? resultFromTimer(session.config, this.elapsedMs, session.laps) : null
	}

	/** Закрывает таймер насовсем. */
	close() {
		this.#stop()
		this.session = null
		this.#save()
	}

	#pause() {
		const session = this.session

		if (!session?.startedAt) return

		session.accumulatedMs += Date.now() - session.startedAt
		session.startedAt = null
		this.#stop()
		this.#save()
	}

	#run() {
		this.#stop()
		void keepAwake(true)
		this.#interval = setInterval(() => this.#tick(), TICK)
		this.#tick()
	}

	#stop() {
		clearInterval(this.#interval)
		this.#interval = undefined
		void keepAwake(false)
	}

	#tick() {
		this.now = Date.now()

		const view = this.view

		if (!view) return

		const second = Math.ceil(view.phaseLeftMs / 1000)
		const phase = `${view.phase}:${view.round}`

		// 3-2-1 перед концом отрезка и длинный сигнал на смену. После перезагрузки первый тик
		// только запоминает фазу, чтобы не пищать задним числом.
		if (this.#lastPhase && phase !== this.#lastPhase) {
			beep(view.phase === 'done' ? 'end' : 'go')
			haptic(view.phase === 'done' ? 'success' : 'heavy')
		} else if (this.#lastPhase && second !== this.#lastSecond && second <= 3 && second > 0) {
			beep('tick')
		}

		this.#lastSecond = second
		this.#lastPhase = phase

		if (view.phase === 'done' && this.session) {
			this.#pause()
			this.session.finished = true
			this.#save()
		}
	}

	#save() {
		try {
			if (this.session) localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(this.session)))
			else localStorage.removeItem(STORAGE_KEY)
		} catch {
			// Без хранилища таймер просто не переживёт перезагрузку.
		}
	}
}

export const timer = new TimerSession()

// Вернулись в приложение: экран снова не должен гаснуть, Wake Lock снимается при уходе.
if (typeof document !== 'undefined')
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && timer.running) void keepAwake(true)
	})
