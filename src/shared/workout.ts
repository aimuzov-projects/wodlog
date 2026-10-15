/**
 * Приведение тренировки и результата к строгой форме.
 *
 * Сюда приходит и ответ модели, и тело запроса от клиента, поэтому ничему на входе не верим:
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

/** Модель пишет формат как ей вздумается: «For time», «AMRAP 12», «E2MOM». */
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

/**
 * Достаёт JSON из ответа модели.
 *
 * Даже со схемой ответа модели иногда заворачивают его в ```json или пишут пару слов до и после.
 */
export function parseModelJson(content: string): unknown {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
	const body = fenced ? fenced[1] : content
	const start = body.indexOf('{')
	const end = body.lastIndexOf('}')

	if (start === -1 || end <= start) throw new InvalidInput('Модель не вернула JSON')

	try {
		return JSON.parse(body.slice(start, end + 1))
	} catch {
		throw new InvalidInput('Модель вернула битый JSON')
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
