/**
 * Места в комплексе и очки за них.
 *
 * Правила такие: RX всегда выше Scaled. Дальше AMRAP, EMOM и прочее -- больше раундов и повторов,
 * For Time -- меньше время, а не уложившиеся в кап идут после всех финишировавших по объёму,
 * силовая -- больше вес. Одинаковый результат делит место.
 */

import type { PartKind, ResultInput } from '#shared/types.ts'

export type Scorable = Pick<ResultInput, 'division' | 'rounds' | 'reps' | 'timeSec' | 'capped' | 'weight'>

/** Очки за 1–8 место. Дальше только очко за участие. */
export const PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2, 1]

export const pointsFor = (place: number) => 1 + (PLACE_POINTS[place - 1] ?? 0)

// Ключ сортировки: чем больше, тем лучше. Повторов в раунде не бывает больше тысячи.
const volume = (r: Scorable) => (r.rounds ?? 0) * 1000 + (r.reps ?? 0)

function key(kind: PartKind, r: Scorable): number[] {
	const division = r.division === 'rx' ? 1 : 0

	if (kind === 'for_time') return r.capped || !r.timeSec ? [division, 0, volume(r)] : [division, 1, -r.timeSec]

	if (kind === 'strength') return [division, r.weight ?? 0]

	return [division, volume(r)]
}

/** Отрицательное, если `a` лучше `b`. */
export function compareResults(kind: PartKind, a: Scorable, b: Scorable): number {
	const [ka, kb] = [key(kind, a), key(kind, b)]

	for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]

	return 0
}

/** Сортирует результаты и проставляет места с очками. Равные делят место, следующее пропускается. */
export function rank<T extends Scorable>(kind: PartKind, results: T[]): (T & { place: number; points: number })[] {
	const sorted = [...results].sort((a, b) => compareResults(kind, a, b))

	let place = 0

	return sorted.map((result, index) => {
		if (index === 0 || compareResults(kind, sorted[index - 1], result) !== 0) place = index + 1

		return { ...result, place, points: pointsFor(place) }
	})
}

export type Standing = { userId: number; points: number; parts: number; wins: number }

/**
 * Сводный рейтинг по нескольким комплексам: сумма очков, при равенстве -- больше побед,
 * потом больше комплексов.
 */
export function standings<T extends Scorable & { userId: number }>(
	parts: { kind: PartKind; results: T[] }[],
): (Standing & { place: number })[] {
	const byUser = new Map<number, Standing>()

	for (const { kind, results } of parts)
		for (const { userId, place, points } of rank(kind, results)) {
			const row = byUser.get(userId) ?? { userId, points: 0, parts: 0, wins: 0 }

			row.points += points
			row.parts += 1
			row.wins += place === 1 ? 1 : 0
			byUser.set(userId, row)
		}

	const cmp = (a: Standing, b: Standing) => b.points - a.points || b.wins - a.wins || b.parts - a.parts
	const sorted = [...byUser.values()].sort(cmp)

	let place = 0

	return sorted.map((row, index) => {
		if (index === 0 || cmp(sorted[index - 1], row) !== 0) place = index + 1

		return { ...row, place }
	})
}
