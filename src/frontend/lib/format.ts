import { formatClock } from '#shared/timer.ts'
import type { Part, PartKind, ResultInput } from '#shared/types.ts'

/** Сегодняшняя дата по часам телефона в формате YYYY-MM-DD. */
export function localDate(at = new Date()) {
	const pad = (n: number) => String(n).padStart(2, '0')

	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

export function shiftDate(date: string, days: number) {
	const at = new Date(`${date}T12:00:00`)

	at.setDate(at.getDate() + days)

	return localDate(at)
}

const weekday = new Intl.DateTimeFormat('ru', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' })

/** «Сегодня», «Вчера» или «пн, 12 октября». */
export function humanDate(date: string, today = localDate()) {
	if (date === today) return 'Сегодня'

	if (date === shiftDate(today, -1)) return 'Вчера'

	const at = new Date(`${date}T12:00:00`)

	return `${weekday.format(at)}, ${dayMonth.format(at)}`
}

export const shortDate = (date: string) => dayMonth.format(new Date(`${date}T12:00:00`))

/** «12 мин» или «1:30», для капов и интервалов. */
export function duration(sec: number | null) {
	if (!sec) return ''

	return sec % 60 === 0 ? `${sec / 60} мин` : formatClock(sec * 1000)
}

/** Параметры комплекса одной строкой: «12 мин», «каждые 1:30 × 8», «кап 15 мин». */
export function partMeta(part: Part) {
	if (part.kind === 'amrap') return duration(part.timeCapSec)

	if (part.kind === 'emom')
		return [part.intervalSec ? `каждые ${duration(part.intervalSec)}` : '', part.rounds ? `× ${part.rounds}` : '']
			.filter(Boolean)
			.join(' ')

	if (part.kind === 'for_time') return part.timeCapSec ? `кап ${duration(part.timeCapSec)}` : ''

	return part.rounds ? `${part.rounds} подх.` : ''
}

/** Результат одной строкой для таблиц: «6 + 12», «08:42», «кап: 5 + 3», «100 кг». */
export function resultLine(kind: PartKind, r: Pick<ResultInput, 'rounds' | 'reps' | 'timeSec' | 'capped' | 'weight'>) {
	const volume =
		r.rounds !== null && r.reps
			? `${r.rounds} + ${r.reps}`
			: r.rounds !== null
				? `${r.rounds} р.`
				: `${r.reps ?? 0} повт.`

	if (kind === 'for_time') return r.capped ? `кап: ${volume}` : formatClock((r.timeSec ?? 0) * 1000)

	if (kind === 'strength') return `${r.weight ?? 0} кг`

	if (kind === 'other' && r.rounds === null && r.reps === null) return r.weight ? `${r.weight} кг` : '✓'

	return volume
}

/** «1 участник», «3 участника», «5 участников». */
export function plural(n: number, [one, few, many]: [string, string, string]) {
	const mod10 = n % 10
	const mod100 = n % 100
	const word =
		mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many

	return `${n} ${word}`
}
