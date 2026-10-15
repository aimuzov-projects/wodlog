import { expect, test } from '@playwright/test'

// Таймер работает без входа и без API: e2e-сборка поднимает только статику.
test('Tabata timer runs through prep, work and rest', async ({ page }) => {
	await page.clock.install()
	await page.goto('/')
	await page.getByRole('button', { name: 'Просто открыть таймер' }).click()
	await page.getByRole('button', { name: 'Tabata' }).click()
	await page.getByRole('button', { name: 'Старт' }).click()

	const phase = page.locator('.timer-run__phase')
	const clock = page.locator('.timer-run__clock')

	await expect(phase).toHaveText('Приготовиться')
	await page.getByRole('button', { name: 'Старт' }).click()

	await page.clock.runFor(10_500)
	await expect(phase).toHaveText('Работа')
	await expect(page.locator('.timer-run__round')).toHaveText('Раунд 1 / 8')

	await page.clock.runFor(20_000)
	await expect(phase).toHaveText('Отдых')

	await page.getByRole('button', { name: 'Пауза' }).click()

	const paused = await clock.textContent()

	await page.clock.runFor(5_000)
	await expect(clock).toHaveText(paused!)

	await page.getByRole('button', { name: 'Закрыть таймер' }).click()
	await expect(page.getByRole('heading', { name: 'Таймер' })).toBeVisible()
})
