/**
 * Сигналы таймера через Web Audio: без файлов, работает офлайн.
 *
 * Браузеры дают запустить звук только после жеста пользователя, поэтому контекст создаётся
 * в {@link unlockAudio}, который вызывается на нажатие «Старт».
 */

let context: AudioContext | null = null

export function unlockAudio() {
	context ??= new AudioContext()

	if (context.state === 'suspended') void context.resume()
}

function tone(frequency: number, length: number, delay = 0, type: OscillatorType = 'square') {
	if (!context) return

	const oscillator = context.createOscillator()
	const gain = context.createGain()
	const t = context.currentTime + delay

	oscillator.type = type
	oscillator.frequency.value = frequency
	gain.gain.setValueAtTime(0.0001, t)
	gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01)
	gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
	oscillator.connect(gain).connect(context.destination)
	oscillator.start(t)
	oscillator.stop(t + length + 0.05)
}

/**
 * Сигналы таймера. Высокий и длинный -- смена отрезка, низкий короткий -- обратный отсчёт,
 * два быстрых звонких -- засчитанный круг, чтобы его было слышно и не глядя на экран.
 */
export function beep(kind: 'tick' | 'go' | 'end' | 'lap') {
	if (kind === 'tick') tone(660, 0.12)
	else if (kind === 'go') tone(990, 0.45)
	else if (kind === 'end') tone(440, 0.9)
	else {
		tone(1175, 0.08, 0, 'triangle')
		tone(1568, 0.12, 0.09, 'triangle')
	}
}

let lock: WakeLockSentinel | null = null

/** Не даёт экрану погаснуть, пока идёт таймер. Если API нет -- молча обходимся без него. */
export async function keepAwake(on: boolean) {
	try {
		if (on && !lock) lock = (await navigator.wakeLock?.request('screen')) ?? null
		else if (!on && lock) {
			await lock.release()
			lock = null
		}
	} catch {
		lock = null
	}
}
