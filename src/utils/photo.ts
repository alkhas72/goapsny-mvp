// Подготовка фото фасада под контракт Storage.
//
// Бакет place-photos принимает только image/jpeg и не больше 10 MiB
// (0001_initial_schema.sql: allowed_mime_types = {image/jpeg},
// file_size_limit = 10485760). Телефон при этом отдаёт что угодно:
// iPhone по умолчанию снимает в HEIC, Android — в JPEG или WebP,
// а размер снимка современной камеры легко превышает лимит.
//
// Раньше клиент отправлял любые байты с заголовком image/jpeg — Storage
// отклонял их без внятного объяснения, и основной мобильный сценарий рвался.

export const FACADE_MAX_BYTES = 10 * 1024 * 1024;
export const FACADE_TARGET_MIME = 'image/jpeg';

/** Максимальная сторона после сжатия. Больше для фасада не нужно. */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;

export type PhotoPrepareError =
  | { kind: 'too_large'; message: string }
  | { kind: 'not_an_image'; message: string }
  | { kind: 'decode_failed'; message: string };

export class FacadePhotoError extends Error {
  readonly kind: PhotoPrepareError['kind'];

  constructor(error: PhotoPrepareError) {
    super(error.message);
    this.name = 'FacadePhotoError';
    this.kind = error.kind;
  }
}

/**
 * Проверяет файл до всякой обработки. Отдельно от конвертации, чтобы
 * логику можно было проверить тестом без canvas.
 */
export function validateFacadePhoto(file: File): PhotoPrepareError | null {
  if (!file.type.startsWith('image/')) {
    return {
      kind: 'not_an_image',
      message: 'Это не фотография. Выберите изображение.',
    };
  }
  // Исходник больше лимита ещё не приговор: после сжатия он обычно
  // уменьшается в разы. Отсекаем только заведомо неподъёмное.
  if (file.size > FACADE_MAX_BYTES * 4) {
    return {
      kind: 'too_large',
      message: 'Фотография слишком большая. Выберите снимок поменьше.',
    };
  }
  return null;
}

/** Уже готовый JPEG нужного размера пересжимать незачем. */
function needsConversion(file: File): boolean {
  return file.type !== FACADE_TARGET_MIME || file.size > FACADE_MAX_BYTES;
}

/**
 * Приводит снимок к контракту бакета: JPEG, вписанный в MAX_DIMENSION.
 * Декодирование выполняет браузер, поэтому HEIC с iPhone проходит там,
 * где Safari умеет его читать — то есть на самом iPhone.
 */
export async function prepareFacadePhoto(file: File): Promise<File> {
  const invalid = validateFacadePhoto(file);
  if (invalid) throw new FacadePhotoError(invalid);

  if (!needsConversion(file)) return file;

  const bitmap = await decode(file);
  const { width, height } = fit(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new FacadePhotoError({
      kind: 'decode_failed',
      message: 'Не удалось обработать фотографию. Попробуйте другой снимок.',
    });
  }
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, FACADE_TARGET_MIME, JPEG_QUALITY);
  });

  if (!blob) {
    throw new FacadePhotoError({
      kind: 'decode_failed',
      message: 'Не удалось обработать фотографию. Попробуйте другой снимок.',
    });
  }
  if (blob.size > FACADE_MAX_BYTES) {
    throw new FacadePhotoError({
      kind: 'too_large',
      message: 'Фотография слишком большая даже после сжатия. Выберите другой снимок.',
    });
  }

  return new File([blob], 'facade.jpg', { type: FACADE_TARGET_MIME });
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Формат, который не берёт createImageBitmap, может взять <img>.
    }
  }
  return await decodeViaImageElement(file);
}

function decodeViaImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new FacadePhotoError({
          kind: 'decode_failed',
          message: 'Не удалось прочитать фотографию. Попробуйте другой формат.',
        }),
      );
    };
    image.src = url;
  });
}

/** Вписывает кадр в квадрат MAX_DIMENSION, сохраняя пропорции. */
export function fit(
  width: number,
  height: number,
  max = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
