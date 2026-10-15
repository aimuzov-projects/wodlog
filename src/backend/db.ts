/**
 * Всё состояние приложения в одной SQLite через встроенный `node:sqlite`.
 *
 * Схема создаётся при старте. Колонки, добавленные после первого релиза, дописывает
 * {@link MIGRATIONS}: `CREATE TABLE IF NOT EXISTS` сам их не добавит.
 */

import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import { rank, standings } from '#shared/scoring.ts'
import type {
	Gym,
	GymRole,
	HistoryRow,
	LeaderboardRow,
	Me,
	Movement,
	Part,
	PartKind,
	RatingPeriod,
	RatingRow,
	Result,
	ResultInput,
	RxWeights,
	UserBrief,
	Visibility,
	Workout,
	WorkoutDraft,
} from '#shared/types.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT,
	username TEXT,
	photo_url TEXT,
	visibility TEXT NOT NULL DEFAULT 'public',
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token_hash TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id),
	expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gyms (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	invite_code TEXT NOT NULL UNIQUE,
	created_by INTEGER NOT NULL REFERENCES users(id),
	created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gym_members (
	gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id),
	role TEXT NOT NULL,
	joined_at INTEGER NOT NULL,
	PRIMARY KEY (gym_id, user_id)
);
CREATE INDEX IF NOT EXISTS gym_members_user ON gym_members(user_id);
CREATE TABLE IF NOT EXISTS workouts (
	id INTEGER PRIMARY KEY,
	gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
	date TEXT NOT NULL,
	warmup TEXT NOT NULL DEFAULT '',
	has_photo INTEGER NOT NULL DEFAULT 0,
	recognized TEXT,
	created_by INTEGER NOT NULL REFERENCES users(id),
	updated_by INTEGER NOT NULL REFERENCES users(id),
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	UNIQUE (gym_id, date)
);
CREATE TABLE IF NOT EXISTS parts (
	id INTEGER PRIMARY KEY,
	workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	kind TEXT NOT NULL,
	title TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	time_cap_sec INTEGER,
	interval_sec INTEGER,
	rounds INTEGER,
	movements TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS parts_workout ON parts(workout_id, position);
CREATE TABLE IF NOT EXISTS results (
	part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id),
	division TEXT NOT NULL,
	rounds INTEGER,
	reps INTEGER,
	time_sec INTEGER,
	capped INTEGER NOT NULL DEFAULT 0,
	weight REAL,
	load TEXT NOT NULL DEFAULT '[]',
	notes TEXT NOT NULL DEFAULT '',
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (part_id, user_id)
);
CREATE INDEX IF NOT EXISTS results_user ON results(user_id);
`

const MIGRATIONS: Record<string, Record<string, string>> = {
	users: { rx_weights: 'TEXT' },
}

const SESSION_TTL = 30 * 24 * 3600

/** Пользователь Telegram в том виде, в каком его присылают initData и Login Widget. */
export type TelegramUser = {
	id: number
	first_name: string
	last_name?: string
	username?: string
	photo_url?: string
}

type Row = Record<string, SQLInputValue>

const now = () => Math.floor(Date.now() / 1000)

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Без 0/o и 1/l: код могут продиктовать голосом.
const INVITE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

const inviteCode = () => [...randomBytes(8)].map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('')

const brief = (row: Row, prefix = ''): UserBrief => ({
	id: Number(row[`${prefix}id`]),
	name: [row[`${prefix}first_name`], row[`${prefix}last_name`]].filter(Boolean).join(' '),
	photoUrl: (row[`${prefix}photo_url`] as string | null) ?? null,
})

function partFromRow(row: Row): Part {
	return {
		id: Number(row.id),
		kind: row.kind as PartKind,
		title: String(row.title),
		description: String(row.description),
		timeCapSec: row.time_cap_sec as number | null,
		intervalSec: row.interval_sec as number | null,
		rounds: row.rounds as number | null,
		movements: JSON.parse(String(row.movements)),
	}
}

function resultFromRow(row: Row): Result {
	return {
		partId: Number(row.part_id),
		user: brief(row, 'u_'),
		division: row.division as Result['division'],
		rounds: row.rounds as number | null,
		reps: row.reps as number | null,
		timeSec: row.time_sec as number | null,
		capped: Boolean(row.capped),
		weight: row.weight as number | null,
		load: JSON.parse(String(row.load)),
		notes: String(row.notes),
		updatedAt: Number(row.updated_at),
	}
}

const USER_COLUMNS = `u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name,
	u.photo_url AS u_photo_url, u.visibility AS u_visibility`

/** Первый день периода рейтинга в формате YYYY-MM-DD: неделя с понедельника, месяц с первого числа. */
export function periodStart(period: RatingPeriod, today: string): string {
	if (period === 'all') return '0000-00-00'

	const date = new Date(`${today}T00:00:00Z`)

	if (period === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
	else date.setUTCDate(1)

	return date.toISOString().slice(0, 10)
}

export class Db {
	readonly sql: DatabaseSync

	constructor(path: string) {
		if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

		this.sql = new DatabaseSync(path)

		for (const pragma of ['journal_mode = WAL', 'foreign_keys = ON', 'busy_timeout = 5000'])
			this.sql.prepare(`PRAGMA ${pragma}`).get()

		this.#script(SCHEMA)
		this.#migrate()
	}

	/** Несколько операторов через `;` по одному, в схеме нет строк с точкой с запятой внутри. */
	#script(script: string) {
		for (const statement of script.split(';')) if (statement.trim()) this.sql.prepare(statement).run()
	}

	#migrate() {
		for (const [table, columns] of Object.entries(MIGRATIONS)) {
			const existing = new Set(
				this.sql
					.prepare(`PRAGMA table_info(${table})`)
					.all()
					.map((c) => c.name),
			)

			for (const [column, type] of Object.entries(columns))
				if (!existing.has(column)) this.sql.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run()
		}
	}

	#tx<T>(fn: () => T): T {
		this.sql.prepare('BEGIN').run()

		try {
			const result = fn()

			this.sql.prepare('COMMIT').run()

			return result
		} catch (error) {
			this.sql.prepare('ROLLBACK').run()

			throw error
		}
	}

	close() {
		this.sql.close()
	}

	// Пользователи и сессии

	upsertUser(user: TelegramUser) {
		this.sql
			.prepare(
				`INSERT INTO users (id, first_name, last_name, username, photo_url, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name,
					username = excluded.username, photo_url = COALESCE(excluded.photo_url, users.photo_url)`,
			)
			.run(user.id, user.first_name, user.last_name ?? null, user.username ?? null, user.photo_url ?? null, now())
	}

	me(userId: number): Me | null {
		const row = this.sql.prepare('SELECT * FROM users WHERE id = ?').get(userId)

		if (!row) return null

		return {
			...brief(row),
			username: (row.username as string | null) ?? null,
			visibility: row.visibility as Visibility,
			rxWeights: (row.rx_weights as RxWeights | null) ?? null,
		}
	}

	setVisibility(userId: number, visibility: Visibility) {
		this.sql.prepare('UPDATE users SET visibility = ? WHERE id = ?').run(visibility, userId)
	}

	setRxWeights(userId: number, rxWeights: RxWeights | null) {
		this.sql.prepare('UPDATE users SET rx_weights = ? WHERE id = ?').run(rxWeights, userId)
	}

	createSession(userId: number): string {
		const token = randomBytes(32).toString('base64url')

		this.sql.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now())

		this.sql
			.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
			.run(hashToken(token), userId, now() + SESSION_TTL)

		return token
	}

	sessionUser(token: string): number | null {
		const row = this.sql
			.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
			.get(hashToken(token), now())

		return row ? Number(row.user_id) : null
	}

	// Залы

	createGym(userId: number, name: string): Gym {
		return this.#tx(() => {
			const { lastInsertRowid } = this.sql
				.prepare('INSERT INTO gyms (name, invite_code, created_by, created_at) VALUES (?, ?, ?, ?)')
				.run(name, inviteCode(), userId, now())
			const gymId = Number(lastInsertRowid)

			this.#addMember(gymId, userId, 'admin')

			return this.gym(gymId, userId)!
		})
	}

	#addMember(gymId: number, userId: number, role: GymRole) {
		this.sql
			.prepare('INSERT OR IGNORE INTO gym_members (gym_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
			.run(gymId, userId, role, now())
	}

	/** Вступает в зал по коду приглашения. `null`, если такого кода нет. */
	joinGym(userId: number, code: string): Gym | null {
		const row = this.sql.prepare('SELECT id FROM gyms WHERE invite_code = ?').get(code)

		if (!row) return null

		this.#addMember(Number(row.id), userId, 'member')

		return this.gym(Number(row.id), userId)
	}

	leaveGym(userId: number, gymId: number) {
		this.sql.prepare('DELETE FROM gym_members WHERE gym_id = ? AND user_id = ?').run(gymId, userId)
	}

	role(gymId: number, userId: number): GymRole | null {
		const row = this.sql.prepare('SELECT role FROM gym_members WHERE gym_id = ? AND user_id = ?').get(gymId, userId)

		return row ? (row.role as GymRole) : null
	}

	static #GYM_SELECT = `
		SELECT g.id, g.name, g.invite_code, m.role,
			(SELECT COUNT(*) FROM gym_members WHERE gym_id = g.id) AS members
		FROM gyms g JOIN gym_members m ON m.gym_id = g.id AND m.user_id = ?`

	static #gymFromRow = (row: Row): Gym => ({
		id: Number(row.id),
		name: String(row.name),
		inviteCode: String(row.invite_code),
		role: row.role as GymRole,
		members: Number(row.members),
	})

	gym(gymId: number, userId: number): Gym | null {
		const row = this.sql.prepare(`${Db.#GYM_SELECT} WHERE g.id = ?`).get(userId, gymId)

		return row ? Db.#gymFromRow(row) : null
	}

	gyms(userId: number): Gym[] {
		return this.sql
			.prepare(`${Db.#GYM_SELECT} ORDER BY m.joined_at`)
			.all(userId)
			.map((row) => Db.#gymFromRow(row))
	}

	renameGym(gymId: number, name: string) {
		this.sql.prepare('UPDATE gyms SET name = ? WHERE id = ?').run(name, gymId)
	}

	// Тренировки

	workout(gymId: number, date: string): Workout | null {
		const row = this.sql
			.prepare(
				`SELECT w.*, ${USER_COLUMNS} FROM workouts w JOIN users u ON u.id = w.updated_by
				WHERE w.gym_id = ? AND w.date = ?`,
			)
			.get(gymId, date)

		if (!row) return null

		return {
			id: Number(row.id),
			gymId,
			date,
			warmup: String(row.warmup),
			hasPhoto: Boolean(row.has_photo),
			updatedBy: brief(row, 'u_'),
			updatedAt: Number(row.updated_at),
			parts: this.sql
				.prepare('SELECT * FROM parts WHERE workout_id = ? ORDER BY position')
				.all(row.id)
				.map(partFromRow),
		}
	}

	workoutId(gymId: number, date: string): number | null {
		const row = this.sql.prepare('SELECT id FROM workouts WHERE gym_id = ? AND date = ?').get(gymId, date)

		return row ? Number(row.id) : null
	}

	/** Даты, на которые в зале есть тренировки, свежие первыми. */
	workoutDates(gymId: number, limit = 60): string[] {
		return this.sql
			.prepare('SELECT date FROM workouts WHERE gym_id = ? ORDER BY date DESC LIMIT ?')
			.all(gymId, limit)
			.map((row) => String(row.date))
	}

	/**
	 * Сохраняет тренировку дня.
	 *
	 * Комплексы с `id` обновляются на месте, чтобы не потерять результаты по ним. Новые
	 * добавляются, а пропавшие из списка удаляются вместе с результатами.
	 */
	saveWorkout(
		gymId: number,
		date: string,
		userId: number,
		draft: WorkoutDraft,
		extra: { hasPhoto?: boolean; recognized?: unknown } = {},
	): Workout {
		return this.#tx(() => {
			const t = now()

			this.sql
				.prepare(
					`INSERT INTO workouts (gym_id, date, warmup, created_by, updated_by, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT (gym_id, date) DO UPDATE SET warmup = excluded.warmup,
						updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
				)
				.run(gymId, date, draft.warmup, userId, userId, t, t)

			const workoutId = this.workoutId(gymId, date)!

			if (extra.hasPhoto) this.sql.prepare('UPDATE workouts SET has_photo = 1 WHERE id = ?').run(workoutId)

			if (extra.recognized !== undefined)
				this.sql
					.prepare('UPDATE workouts SET recognized = ? WHERE id = ?')
					.run(JSON.stringify(extra.recognized), workoutId)

			const existing = new Set(
				this.sql
					.prepare('SELECT id FROM parts WHERE workout_id = ?')
					.all(workoutId)
					.map((row) => Number(row.id)),
			)
			const kept = new Set<number>()

			draft.parts.forEach((part, position) => {
				const values = [
					position,
					part.kind,
					part.title,
					part.description,
					part.timeCapSec,
					part.intervalSec,
					part.rounds,
					JSON.stringify(part.movements),
				]

				if (part.id !== undefined && existing.has(part.id)) {
					kept.add(part.id)

					this.sql
						.prepare(
							`UPDATE parts SET position = ?, kind = ?, title = ?, description = ?, time_cap_sec = ?,
								interval_sec = ?, rounds = ?, movements = ? WHERE id = ?`,
						)
						.run(...values, part.id)
				} else {
					this.sql
						.prepare(
							`INSERT INTO parts (position, kind, title, description, time_cap_sec, interval_sec, rounds,
								movements, workout_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						)
						.run(...values, workoutId)
				}
			})

			for (const id of existing) if (!kept.has(id)) this.sql.prepare('DELETE FROM parts WHERE id = ?').run(id)

			return this.workout(gymId, date)!
		})
	}

	/** Отмечает у сохранённой тренировки фото доски и сырой ответ модели. Новую не создаёт. */
	markPhoto(gymId: number, date: string, recognized: unknown) {
		this.sql
			.prepare('UPDATE workouts SET has_photo = 1, recognized = ? WHERE gym_id = ? AND date = ?')
			.run(JSON.stringify(recognized), gymId, date)
	}

	/** Зал и комплекс: по ним проверяется доступ, валидируется результат и подставляются RX-веса. */
	partInfo(partId: number): { gymId: number; kind: PartKind; movements: Movement[] } | null {
		const row = this.sql
			.prepare(
				'SELECT w.gym_id, p.kind, p.movements FROM parts p JOIN workouts w ON w.id = p.workout_id WHERE p.id = ?',
			)
			.get(partId)

		return row
			? { gymId: Number(row.gym_id), kind: row.kind as PartKind, movements: JSON.parse(String(row.movements)) }
			: null
	}

	// Результаты

	saveResult(partId: number, userId: number, input: ResultInput) {
		this.sql
			.prepare(
				`INSERT INTO results (part_id, user_id, division, rounds, reps, time_sec, capped, weight, load, notes, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (part_id, user_id) DO UPDATE SET division = excluded.division, rounds = excluded.rounds,
					reps = excluded.reps, time_sec = excluded.time_sec, capped = excluded.capped,
					weight = excluded.weight, load = excluded.load, notes = excluded.notes,
					updated_at = excluded.updated_at`,
			)
			.run(
				partId,
				userId,
				input.division,
				input.rounds,
				input.reps,
				input.timeSec,
				input.capped ? 1 : 0,
				input.weight,
				JSON.stringify(input.load),
				input.notes,
				now(),
			)
	}

	deleteResult(partId: number, userId: number) {
		this.sql.prepare('DELETE FROM results WHERE part_id = ? AND user_id = ?').run(partId, userId)
	}

	/**
	 * Лидерборд комплекса из публичных профилей. Свой результат зритель получает отдельно
	 * в `mine`, даже если его профиль закрыт и в таблицу он не попал.
	 */
	leaderboard(partId: number, kind: PartKind, viewerId: number): { rows: LeaderboardRow[]; mine: Result | null } {
		const rows = this.sql
			.prepare(`SELECT r.*, ${USER_COLUMNS} FROM results r JOIN users u ON u.id = r.user_id WHERE r.part_id = ?`)
			.all(partId)

		return {
			rows: rank(kind, rows.filter((row) => row.u_visibility === 'public').map(resultFromRow)),
			mine: rows.filter((row) => row.u_id === viewerId).map(resultFromRow)[0] ?? null,
		}
	}

	/** Сводный рейтинг зала за период, только публичные профили. */
	rating(gymId: number, period: RatingPeriod, today: string): RatingRow[] {
		const rows = this.sql
			.prepare(
				`SELECT r.*, p.kind AS p_kind, ${USER_COLUMNS}
				FROM results r JOIN users u ON u.id = r.user_id
				JOIN parts p ON p.id = r.part_id JOIN workouts w ON w.id = p.workout_id
				WHERE w.gym_id = ? AND w.date BETWEEN ? AND ? AND u.visibility = 'public'`,
			)
			.all(gymId, periodStart(period, today), today)
		const parts = new Map<number, { kind: PartKind; results: (Result & { userId: number })[] }>()
		const users = new Map<number, UserBrief>()

		for (const row of rows) {
			const result = resultFromRow(row)
			const part = parts.get(result.partId) ?? { kind: row.p_kind as PartKind, results: [] }

			part.results.push({ ...result, userId: result.user.id })
			parts.set(result.partId, part)
			users.set(result.user.id, result.user)
		}

		return standings([...parts.values()]).map(({ userId, ...rest }) => ({ ...rest, user: users.get(userId)! }))
	}

	/** Мои результаты во всех залах, свежие первыми. */
	history(userId: number, limit = 100): HistoryRow[] {
		return this.sql
			.prepare(
				`SELECT r.*, ${USER_COLUMNS}, p.id AS p_id, p.kind, p.title, p.description, p.time_cap_sec,
					p.interval_sec, p.rounds AS p_rounds, p.movements, w.date, g.name AS gym_name
				FROM results r JOIN users u ON u.id = r.user_id
				JOIN parts p ON p.id = r.part_id JOIN workouts w ON w.id = p.workout_id JOIN gyms g ON g.id = w.gym_id
				WHERE r.user_id = ? ORDER BY w.date DESC, p.position LIMIT ?`,
			)
			.all(userId, limit)
			.map((row) => ({
				...resultFromRow(row),
				gymName: String(row.gym_name),
				date: String(row.date),
				part: partFromRow({ ...row, id: row.p_id, rounds: row.p_rounds }),
			}))
	}
}
