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

/** Короткий писк. Высокий и длинный -- смена отрезка, низкий короткий -- обратный отсчёт. */
export function beep(kind: 'tick' | 'go' | 'end') {
	if (!context) return

	const [frequency, length] = kind === 'tick' ? [660, 0.12] : kind === 'go' ? [990, 0.45] : [440, 0.9]
	const oscillator = context.createOscillator()
	const gain = context.createGain()
	const t = context.currentTime

	oscillator.type = 'square'
	oscillator.frequency.value = frequency
	gain.gain.setValueAtTime(0.0001, t)
	gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01)
	gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
	oscillator.connect(gain).connect(context.destination)
	oscillator.start(t)
	oscillator.stop(t + length + 0.05)
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
