import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { generateSW } from 'workbox-build'

/**
 * Сервис-воркер: после сборки Workbox прекэширует оболочку приложения, и таймер открывается
 * без сети. API в кэш не попадает -- данные всегда свежие. Манифест лежит статикой
 * в `public/manifest.webmanifest`, регистрирует воркер `lib/pwa.ts`.
 */
export default function pwa(): AstroIntegration {
	return {
		name: 'wodlog-pwa',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir)
				const { count, size, warnings } = await generateSW({
					globDirectory: root,
					globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
					globIgnores: ['404.html', 'sitemap-*.xml'],
					swDest: `${root}/sw.js`,
					// Экраны переключаются внутри приложения, любой адрес открывает его же.
					navigateFallback: '/index.html',
					navigateFallbackDenylist: [/^\/api\//],
					skipWaiting: true,
					clientsClaim: true,
					cleanupOutdatedCaches: true,
					sourcemap: false,
				})

				for (const warning of warnings) logger.warn(warning)

				logger.info(`sw.js: ${count} файлов, ${Math.round(size / 1024)} КБ в прекэше`)
			},
		},
	}
}
