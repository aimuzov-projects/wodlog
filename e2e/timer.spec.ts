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

	// Второй раз жать «Старт» не нужно: отсчёт уже идёт, а кнопок внизу нет вовсе.
	await expect(phase).toHaveText('Приготовиться')
	await expect(page.locator('.timer-run button')).toHaveCount(3)

	await page.clock.runFor(10_500)
	await expect(phase).toHaveText('Работа')
	await expect(page.locator('.timer-run__round')).toHaveText('Раунд 1 / 8')

	await page.clock.runFor(20_000)
	await expect(phase).toHaveText('Отдых')

	// Свёрнутый таймер продолжает идти, а плашка внизу возвращает к нему.
	await page.getByRole('button', { name: 'Свернуть таймер' }).click()
	await expect(page.getByRole('heading', { name: 'Таймер' })).toBeVisible()

	const bar = page.locator('.timer-bar')

	await expect(bar).toContainText('Интервалы')

	// И даже перезагрузку переживает: время считается по часам и лежит в localStorage.
	await page.reload()
	await page.getByRole('button', { name: 'Просто открыть таймер' }).click()
	// 10 с подготовки + (20 работы + 10 отдыха) × 2 = 70 с, к этому моменту набегает 70,5 -- третий раунд.
	await page.clock.runFor(40_000)
	await bar.click()
	await expect(page.locator('.timer-run__round')).toHaveText('Раунд 3 / 8')

	await page.getByRole('button', { name: 'Завершить' }).click()
	await expect(bar).toHaveCount(0)
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
	await page.getByRole('button', { name: 'Отметить раунд' }).click()
	await expect(page.locator('.timer-run__round')).toHaveText('Раундов: 1')
})
