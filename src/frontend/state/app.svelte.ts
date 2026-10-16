/**
 * Состояние приложения: кто вошёл, в каком зале и какой экран открыт.
 *
 * Навигация без роутера: главный экран -- тренировка дня, всё остальное открывается стеком
 * поверх него из меню. Стек нужен, чтобы системная «Назад» Telegram закрывала ровно последний
 * открытый экран.
 */

import { api, getToken, handleUnauthorized, setToken } from '#frontend/lib/api.ts'
import { localDate } from '#frontend/lib/format.ts'
import { confirmAction, insideTelegram, inviteFromLaunch, setBackButton, webApp } from '#frontend/lib/telegram.ts'
import { timer } from '#frontend/state/timer.svelte.ts'
import { configForPart, type TimerResult } from '#shared/timer.ts'
import { PART_KIND_LABELS, type Gym, type Me, type Part, type Workout, type WorkoutDraft } from '#shared/types.ts'

export type Screen =
	| { name: 'editor'; date: string; draft: WorkoutDraft }
	| { name: 'part'; part: Part; date: string; prefill?: TimerResult }
	/** Сам таймер живёт в `state/timer.svelte.ts`, экран только показывает его. */
	| { name: 'timer' }
	| { name: 'timer-setup' }
	| { name: 'rating' }
	| { name: 'profile' }
	| { name: 'gyms' }

type Login = { token: string; me: Me; gyms: Gym[]; startParam?: string | null }

const GYM_KEY = 'wodlog.gym'

class AppState {
	/** `timer` -- только таймер, без входа: он нужен и офлайн, и до регистрации. */
	status = $state<'loading' | 'login' | 'ready' | 'error' | 'timer'>('loading')
	error = $state('')
	me = $state<Me | null>(null)
	gyms = $state<Gym[]>([])
	gymId = $state<number | null>(null)
	stack = $state<Screen[]>([])
	/** Выбранный день на главном экране. */
	date = $state(localDate())
	/** Тренировки по ключу `зал:дата`, `null` -- на этот день тренировки нет. */
	workouts = $state<Record<string, Workout | null>>({})
	/** Даты с тренировками в текущем зале. */
	dates = $state<string[]>([])
	/** Сообщение внизу экрана: результат сохранён, ошибка сети и т. п. */
	toast = $state<{ text: string; error: boolean; detail: string } | null>(null)

	gym = $derived(this.gyms.find((g) => g.id === this.gymId) ?? this.gyms[0] ?? null)
	screen = $derived(this.stack.at(-1) ?? null)

	#toastTimer: ReturnType<typeof setTimeout> | undefined

	async start() {
		handleUnauthorized(() => void this.start())

		try {
			if (insideTelegram()) {
				const login = await api<Login>('POST', '/api/auth/telegram', { initData: webApp()!.initData })

				await this.#signedIn(login)
			} else if (getToken()) {
				const { me, gyms } = await api<{ me: Me; gyms: Gym[] }>('GET', '/api/me')

				await this.#signedIn({ token: getToken()!, me, gyms })
			} else {
				this.status = 'login'
			}
		} catch (error) {
			if (this.status !== 'login') {
				this.status = 'error'
				this.error = (error as Error).message
			}
		}
	}

	/** Вход из Login Widget или dev-входа. */
	async signIn(path: string, payload: unknown) {
		await this.#signedIn(await api<Login>('POST', path, payload))
	}

	async #signedIn(login: Login) {
		setToken(login.token)
		this.me = login.me
		this.gyms = login.gyms

		try {
			this.gymId = Number(localStorage.getItem(GYM_KEY)) || null
		} catch {
			this.gymId = null
		}

		const invite = inviteFromLaunch(login.startParam ?? null)

		if (invite) {
			try {
				await this.join(invite)
			} catch (error) {
				this.notify((error as Error).message, true)
			}

			// Повторное открытие той же ссылки не должно снова дёргать вступление.
			history.replaceState(null, '', location.pathname)
		}

		this.status = 'ready'
	}

	signOut() {
		setToken(null)
		this.me = null
		this.status = 'login'
	}

	selectGym(id: number) {
		this.gymId = id

		try {
			localStorage.setItem(GYM_KEY, String(id))
		} catch {
			// Без хранилища зал просто не запомнится.
		}
	}

	async join(code: string) {
		const gym = await api<Gym>('POST', '/api/gyms/join', { code })

		this.gyms = [...this.gyms.filter((g) => g.id !== gym.id), gym]
		this.selectGym(gym.id)
		this.notify(`Вы в зале «${gym.name}»`)
	}

	async createGym(name: string) {
		const gym = await api<Gym>('POST', '/api/gyms', { name })

		this.gyms = [...this.gyms, gym]
		this.selectGym(gym.id)
	}

	async leaveGym(id: number) {
		await api('DELETE', `/api/gyms/${id}/membership`)
		this.gyms = this.gyms.filter((g) => g.id !== id)

		if (this.gymId === id) this.gymId = null
	}

	workout = $derived(this.gym ? this.workouts[`${this.gym.id}:${this.date}`] : undefined)

	async loadWorkout(force = false) {
		const gym = this.gym

		if (!gym) return

		const key = `${gym.id}:${this.date}`

		if (!force && key in this.workouts) return

		const { workout, dates } = await api<{ workout: Workout | null; dates: string[] }>(
			'GET',
			`/api/gyms/${gym.id}/workouts/${this.date}`,
		)

		this.workouts[key] = workout
		this.dates = dates
	}

	setWorkout(workout: Workout) {
		this.workouts[`${workout.gymId}:${workout.date}`] = workout

		if (!this.dates.includes(workout.date)) this.dates = [...this.dates, workout.date].sort().reverse()
	}

	/**
	 * Закрывает таймер комплекса и открывает этот комплекс с формой, заполненной результатом
	 * таймера. Если таймер запускали прямо с экрана комплекса, тот же экран и переиспользуется.
	 */
	showTimerResult() {
		const source = timer.session?.source
		const prefill = timer.result()

		timer.close()

		if (!source || !prefill) return this.back()

		const stack = this.stack.filter((s) => s.name !== 'timer')
		const top = stack.at(-1)
		const screen: Screen = { name: 'part', part: source.part, date: source.date, prefill }

		this.stack =
			top?.name === 'part' && top.part.id === source.part.id
				? [...stack.slice(0, -1), screen]
				: [...stack, screen]

		this.#syncBack()
	}

	open(screen: Screen) {
		this.stack = [...this.stack, screen]
		this.#syncBack()
	}

	back() {
		this.stack = this.stack.slice(0, -1)
		this.#syncBack()
	}

	/** Заменяет верхний экран, например редактор -- на сохранённую тренировку. */
	replace(screen: Screen | null) {
		this.stack = [...this.stack.slice(0, -1), ...(screen ? [screen] : [])]
		this.#syncBack()
	}

	/** Пункт меню: открывается поверх главного экрана, а не поверх того, что было открыто до. */
	go(screen: Screen) {
		this.stack = [screen]
		this.#syncBack()
	}

	home() {
		this.stack = []
		this.#syncBack()
	}

	/** Таймер комплекса: если он уже идёт -- просто вернуться к нему. */
	async startTimer(part: Part, date: string) {
		const own = timer.session?.source?.part.id === part.id && !timer.finished

		if (!own) {
			if (timer.session && !timer.finished && !(await confirmAction('Другой таймер ещё идёт. Запустить новый?')))
				return

			timer.start(configForPart(part), part.title || PART_KIND_LABELS[part.kind], { part, date })
		}

		this.open({ name: 'timer' })
	}

	#syncBack() {
		setBackButton(this.stack.length ? () => this.back() : null)
	}

	/** Сообщение внизу экрана. `detail` -- пояснение мелким текстом, с ним висит подольше: его читают. */
	notify(text: string, error = false, detail = '') {
		clearTimeout(this.#toastTimer)
		this.toast = { text, error, detail }
		this.#toastTimer = setTimeout(() => (this.toast = null), error || detail ? 5000 : 2500)
	}
}

export const app = new AppState()
