/**
 * Распознавание доски с тренировкой через OpenRouter.
 *
 * Модель получает фото и JSON-схему ответа, а результат всё равно проходит через
 * `workoutDraft()`: схему соблюдают не все модели, и это лишь черновик, который человек
 * поправит в форме.
 */

import type { WorkoutDraft } from '#shared/types.ts'
import { parseModelJson, workoutDraft } from '#shared/workout.ts'

export const DEFAULT_MODEL = 'google/gemini-3.8-flash'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT = 90_000

const PROMPT = `You are reading a photo of a CrossFit gym whiteboard with today's workout.
Extract it as JSON matching the schema.

Rules:
- "warmup": the warm-up section as plain text with line breaks, empty string if absent.
- "parts": every scored piece after the warm-up (strength, AMRAP, EMOM, For Time, etc.) in board order.
- "kind": one of amrap, emom, for_time, strength, other.
- "title": the heading as written, e.g. "AMRAP 12'" or "EMOM 10".
- "timeCapSec": AMRAP duration or For Time cap in seconds, null if not written.
- "intervalSec": EMOM interval in seconds (E2MOM = 120), null otherwise.
- "rounds": number of EMOM rounds, sets or prescribed rounds, null if not written.
- "description": anything else about the part that does not fit the movements (rest, scheme, notes).
- "movements": each line with a movement. "reps" keeps the text as written ("12", "400m", "15/12 cal", "21-15-9").
  "weightM"/"weightF" are kilograms for men/women when the board says e.g. "43/30" or "60/40kg"; convert lb to kg.
  "equipment" is the implement if obvious (Штанга, Гантели, Гиря, Медбол, Турник, Кольца, Гребля, Байк, Скакалка, Бокс).
- Keep movement names in the language and spelling of the board, fix only obvious handwriting typos.
- Do not invent anything that is not on the board.`

const nullable = (type: string) => ({ type: [type, 'null'] })

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['warmup', 'parts'],
	properties: {
		warmup: { type: 'string' },
		parts: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['kind', 'title', 'description', 'timeCapSec', 'intervalSec', 'rounds', 'movements'],
				properties: {
					kind: { type: 'string', enum: ['amrap', 'emom', 'for_time', 'strength', 'other'] },
					title: { type: 'string' },
					description: { type: 'string' },
					timeCapSec: nullable('integer'),
					intervalSec: nullable('integer'),
					rounds: nullable('integer'),
					movements: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['name', 'reps', 'weightM', 'weightF', 'equipment'],
							properties: {
								name: { type: 'string' },
								reps: { type: 'string' },
								weightM: nullable('number'),
								weightF: nullable('number'),
								equipment: nullable('string'),
							},
						},
					},
				},
			},
		},
	},
}

export type Recognizer = (imageDataUrl: string) => Promise<{ draft: WorkoutDraft; raw: unknown }>

/** Ошибка OpenRouter, которую можно показать пользователю. */
export class RecognizeError extends Error {}

export function openRouterRecognizer(options: { apiKey: string; model: string; appUrl: string }): Recognizer {
	return async (image) => {
		const response = await fetch(ENDPOINT, {
			method: 'POST',
			signal: AbortSignal.timeout(TIMEOUT),
			headers: {
				authorization: `Bearer ${options.apiKey}`,
				'content-type': 'application/json',
				// По ним OpenRouter подписывает приложение в своей статистике.
				'http-referer': options.appUrl,
				'x-title': 'WODlog',
			},
			body: JSON.stringify({
				model: options.model,
				temperature: 0,
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: PROMPT },
							{ type: 'image_url', image_url: { url: image } },
						],
					},
				],
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'workout', strict: true, schema: SCHEMA },
				},
			}),
		})

		if (!response.ok) {
			console.error('openrouter', response.status, (await response.text()).slice(0, 500))

			throw new RecognizeError(`Сервис распознавания ответил ${response.status}, попробуйте ещё раз`)
		}

		const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
		const content = body.choices?.[0]?.message?.content

		if (!content) throw new RecognizeError('Сервис распознавания вернул пустой ответ')

		const raw = parseModelJson(content)

		return { draft: workoutDraft(raw), raw }
	}
}
