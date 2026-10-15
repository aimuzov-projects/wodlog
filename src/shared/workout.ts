/**
 * Приведение тренировки и результата к строгой форме.
 *
 * Сюда приходит тело запроса от клиента, поэтому ничему на входе не верим:
 * лишнее отбрасываем, числа разбираем из строк, неизвестный формат комплекса становится `other`.
 */

import {
	PART_KINDS,
	type Division,
	type Load,
	type Movement,
	type Part,
	type PartKind,
	type ResultInput,
	type RxWeights,
	type WorkoutDraft,
} from '#shared/types.ts'

const MAX_TEXT = 2000
const MAX_PARTS = 12
const MAX_MOVEMENTS = 30

/** Ошибка формы: сообщение показывается пользователю. */
export class InvalidInput extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export function text(value: unknown, max = MAX_TEXT): string {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)

	return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

const nullableText = (value: unknown, max = 100) => text(value, max) || null

/** Неотрицательное число или `null`. Строку «24 кг» тоже понимает. */
export function number(value: unknown): number | null {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : NaN

	return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

const integer = (value: unknown) => {
	const parsed = number(value)

	return parsed === null ? null : Math.round(parsed)
}

/** Формат текстом как угодно: «For time», «AMRAP 12», «E2MOM». */
export function partKind(value: unknown): PartKind {
	const raw = text(value, 40)
		.toLowerCase()
		.replace(/[\s-]+/g, '_')

	if ((PART_KINDS as readonly string[]).includes(raw)) return raw as PartKind

	if (raw.includes('amrap')) return 'amrap'

	if (/^e\d*mom/.test(raw) || raw.includes('emom')) return 'emom'

	if (raw.includes('time') || raw === 'ft' || raw === 'rft') return 'for_time'

	if (raw.includes('strength') || raw.includes('сил')) return 'strength'

	return 'other'
}

function movement(raw: unknown): Movement | null {
	if (!isObject(raw)) return null

	const name = text(raw.name, 120)

	if (!name) return null

	return {
		name,
		reps: text(raw.reps, 60),
		weightM: number(raw.weightM),
		weightF: number(raw.weightF),
		equipment: nullableText(raw.equipment),
	}
}

export function part(raw: unknown): Part | null {
	if (!isObject(raw)) return null

	const movements = (Array.isArray(raw.movements) ? raw.movements : [])
		.slice(0, MAX_MOVEMENTS)
		.map(movement)
		.filter((m) => m !== null)
	const title = text(raw.title, 120)
	const description = text(raw.description)

	if (!title && !description && movements.length === 0) return null

	return {
		// id приходит при правке сохранённой тренировки, по нему комплекс сохраняет результаты.
		...(Number.isSafeInteger(raw.id) && (raw.id as number) > 0 ? { id: raw.id as number } : {}),
		kind: partKind(raw.kind),
		title,
		description,
		timeCapSec: integer(raw.timeCapSec),
		intervalSec: integer(raw.intervalSec),
		rounds: integer(raw.rounds),
		movements,
	}
}

/** Тренировка из произвольного JSON. Пустая -- без разминки и комплексов -- тоже валидна. */
export function workoutDraft(raw: unknown): WorkoutDraft {
	if (!isObject(raw)) return { warmup: '', parts: [] }

	return {
		warmup: text(raw.warmup),
		parts: (Array.isArray(raw.parts) ? raw.parts : [])
			.slice(0, MAX_PARTS)
			.map(part)
			.filter((p) => p !== null),
	}
}

function load(raw: unknown): Load | null {
	if (!isObject(raw)) return null

	const movementName = text(raw.movement, 120)

	if (!movementName) return null

	return { movement: movementName, weight: number(raw.weight), equipment: nullableText(raw.equipment) }
}

/**
 * Результат участника для комплекса данного формата.
 *
 * Бросает {@link InvalidInput}, если нет того, по чему комплекс ранжируется:
 * времени или раундов в For Time, раундов в AMRAP, веса в силовой.
 */
export function resultInput(raw: unknown, kind: PartKind): ResultInput {
	if (!isObject(raw)) throw new InvalidInput('Пустой результат')

	const division: Division = raw.division === 'scaled' ? 'scaled' : 'rx'
	const capped = kind === 'for_time' && raw.capped === true
	const result: ResultInput = {
		division,
		rounds: integer(raw.rounds),
		reps: integer(raw.reps),
		timeSec: capped ? null : integer(raw.timeSec),
		capped,
		weight: number(raw.weight),
		load: (Array.isArray(raw.load) ? raw.load : [])
			.slice(0, MAX_MOVEMENTS)
			.map(load)
			.filter((l) => l !== null),
		notes: text(raw.notes, 500),
	}

	if (kind === 'for_time' && !capped && !result.timeSec) throw new InvalidInput('Укажите время')

	if (kind === 'for_time' && capped && result.rounds === null && result.reps === null)
		throw new InvalidInput('Укажите, сколько успели до капа')

	if ((kind === 'amrap' || kind === 'emom') && result.rounds === null && result.reps === null)
		throw new InvalidInput('Укажите раунды или повторы')

	if (kind === 'strength' && result.weight === null) throw new InvalidInput('Укажите рабочий вес')

	return result
}

/**
 * RX-вес движения для участника. Пара разных весов без выбора в профиле не угадывается,
 * а одиночный вес («24 кг») общий для всех.
 */
export function rxWeight(movement: Pick<Movement, 'weightM' | 'weightF'>, rx: RxWeights | null): number | null {
	const { weightM: m, weightF: f } = movement

	if (rx === 'm') return m ?? f

	if (rx === 'f') return f ?? m

	return m !== null && f !== null && m !== f ? null : (m ?? f)
}

/** В RX вес и инвентарь не вводятся: они те, что на доске. Scaled остаётся как прислали. */
export function withRxLoad(result: ResultInput, movements: Movement[], rx: RxWeights | null): ResultInput {
	if (result.division !== 'rx') return result

	return {
		...result,
		load: movements.map((m) => ({ movement: m.name, weight: rxWeight(m, rx), equipment: m.equipment })),
	}
}
