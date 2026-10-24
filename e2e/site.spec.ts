import { siteChecks } from '@aimuzov/infra-site-kit/playwright/checks'

// Проверки, общие для всех сайтов: страницы из sitemap, axe и 404. Подсказок на 404 нет:
// в sitemap одна главная, а её not-found.astro не предлагает.
siteChecks({ notFound: { suggest: false } })
