/** Формат комплекса. `other` -- всё, что не легло в остальные: скилл, техника, кардио. */
export type PartKind = 'amrap' | 'emom' | 'for_time' | 'strength' | 'other'

export const PART_KINDS: readonly PartKind[] = ['amrap', 'emom', 'for_time', 'strength', 'other']

export const PART_KIND_LABELS: Record<PartKind, string> = {
	amrap: 'AMRAP',
	emom: 'EMOM',
	for_time: 'For Time',
	strength: 'Силовая',
	other: 'Другое',
}

/** Движение в комплексе так, как оно написано на доске. */
export type Movement = {
	name: string
	/** Повторы, дистанция или калории текстом: «12», «400 м», «15/12 cal». */
	reps: string
	/** Рекомендованный вес RX у мужчин и женщин, кг. */
	weightM: number | null
	weightF: number | null
	equipment: string | null
}

export type Part = {
	id?: number
	kind: PartKind
	title: string
	description: string
	/** Кап для For Time, длительность для AMRAP. */
	timeCapSec: number | null
	/** Интервал EMOM. */
	intervalSec: number | null
	/** Число раундов EMOM или подходов. */
	rounds: number | null
	movements: Movement[]
}

/** Тренировка без привязки к залу и дате: то, что распознаётся с доски и правится в форме. */
export type WorkoutDraft = {
	warmup: string
	parts: Part[]
}

export type Workout = WorkoutDraft & {
	id: number
	gymId: number
	/** YYYY-MM-DD. */
	date: string
	updatedBy: UserBrief | null
	updatedAt: number
}

export type Division = 'rx' | 'scaled'

/** Что взял участник на конкретное движение. */
export type Load = {
	movement: string
	weight: number | null
	equipment: string | null
}

export type ResultInput = {
	division: Division
	rounds: number | null
	reps: number | null
	timeSec: number | null
	/** Не уложился в кап For Time: тогда в зачёт идут раунды и повторы. */
	capped: boolean
	/** Рабочий вес силовой, кг. */
	weight: number | null
	load: Load[]
	notes: string
}

export type Result = ResultInput & {
	partId: number
	user: UserBrief
	updatedAt: number
}

export type Visibility = 'public' | 'private'

export type UserBrief = {
	id: number
	name: string
	photoUrl: string | null
}

/** Какой из пары RX-весов на доске («43/30») мой: мужской или женский. */
export type RxWeights = 'm' | 'f'

export type Me = UserBrief & {
	username: string | null
	visibility: Visibility
	/** `null` -- ещё не выбрано, тогда пара разных весов в RX не подставляется. */
	rxWeights: RxWeights | null
}

export type GymRole = 'admin' | 'member'

export type Gym = {
	id: number
	name: string
	inviteCode: string
	role: GymRole
	members: number
}

export type RatingPeriod = 'week' | 'month' | 'all'

export type RatingRow = {
	user: UserBrief
	place: number
	points: number
	/** В скольких комплексах есть результат. */
	parts: number
	/** Сколько раз занял первое место. */
	wins: number
}

export type LeaderboardRow = Result & { place: number; points: number }

/** Мой результат в истории вместе с тем, к чему он относится. */
export type HistoryRow = Result & {
	gymName: string
	date: string
	part: Part
}

/** Инвентарь, из которого выбирают в форме результата. Свободный текст тоже принимается. */
export const EQUIPMENT = [
	'Штанга',
	'Гантели',
	'Гиря',
	'Вейт-жилет',
	'Медбол',
	'Слэмбол',
	'Турник',
	'Кольца',
	'Бокс',
	'Скакалка',
	'Гребля',
	'Байк',
	'Лыжи',
	'Резина',
] as const
