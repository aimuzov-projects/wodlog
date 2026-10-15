/**
 * Ужимает снимок с камеры до JPEG data URL.
 *
 * Фото с телефона весит 3–10 МБ, а для распознавания доски хватает 1600 px по длинной стороне.
 * `createImageBitmap` с `imageOrientation` сам разворачивает снимок по EXIF.
 */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
	const canvas = document.createElement('canvas')

	canvas.width = Math.round(bitmap.width * scale)
	canvas.height = Math.round(bitmap.height * scale)
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
	bitmap.close()

	return canvas.toDataURL('image/jpeg', quality)
}
