import { expect, test } from '@playwright/test'

// Таймер работает без входа и без API: e2e-сборка поднимает только статику.
test('interval timer starts right away and runs through prep, work and rest', async ({ page }) => {
	await page.clock.install()
	await page.goto('/')
	await page.getByRole('button', { name: 'Просто открыть таймер' }).click()
	await page.getByRole('button', { name: 'Интервалы' }).click()

	// По умолчанию 40/20, сводим к 20 работы и 10 отдыха.
	for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Работа: меньше' }).click()

	for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Отдых: меньше' }).click()

	await page.getByRole('button', { name: 'Старт' }).click()

	const phase = page.locator('.timer-run__phase')

	// Второй раз жать «Старт» не нужно: отсчёт уже идёт. Кнопки -- «Свернуть», экран и «Завершить».
	await expect(phase).toHaveText('Приготовиться')
	await expect(page.locator('.timer-run button')).toHaveCount(3)

	await page.clock.runFor(10_500)
	await expect(phase).toHaveText('Работа')
	await expect(page.locator('.timer-run__laps-value')).toHaveText('1/8')

	await page.clock.runFor(20_000)
	await expect(phase).toHaveText('Отдых')

	// Свёрнутый таймер продолжает идти: после заголовка раздела сверху встаёт его остров.
	await page.getByRole('button', { name: 'Свернуть таймер' }).click()
	await expect(page.getByRole('heading', { name: 'Таймер' })).toBeVisible()

	const island = page.getByRole('button', { name: 'Открыть таймер' })

	await expect(island).toHaveCount(0)
	await page.clock.runFor(2_600)
	await expect(island).toBeVisible()

	// И даже перезагрузку переживает: время считается по часам и лежит в localStorage.
	await page.reload()
	await page.getByRole('button', { name: 'Просто открыть таймер' }).click()
	// 10 с подготовки + (20 работы + 10 отдыха) × 2 = 70 с, к этому моменту набегает 73 -- третий раунд.
	await page.clock.runFor(40_000)
	await island.click()
	await expect(page.locator('.timer-run__laps-value')).toHaveText('3/8')

	await page.getByRole('button', { name: 'Завершить' }).click()
	await page.clock.runFor(3_000)
	await expect(island).toHaveCount(0)
})

test('a tap during the prep countdown skips it', async ({ page }) => {
	await page.clock.install()
	await page.goto('/')
	await page.getByRole('button', { name: 'Просто открыть таймер' }).click()
	await page.getByRole('button', { name: 'AMRAP' }).click()
	await page.getByRole('button', { name: 'Старт' }).click()

	const phase = page.locator('.timer-run__phase')

	await page.clock.runFor(3_000)
	await expect(phase).toHaveText('Приготовиться')
	await page.getByRole('button', { name: 'Пропустить отсчёт' }).click()
	await expect(phase).toHaveText('Работа')

	// Дальше тот же тап по экрану отмечает круги.
	await page.getByRole('button', { name: 'Засчитать круг' }).click()
	await expect(page.locator('.timer-run__laps')).toHaveText(/^\s*1\s*раунд\s*$/)
})
