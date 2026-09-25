import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FACADE_MAX_BYTES,
  FACADE_TARGET_MIME,
  fit,
  prepareFacadePhoto,
  validateFacadePhoto,
} from './photo';

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  // Реальные байты держать незачем: проверяется только заявленный размер.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateFacadePhoto', () => {
  it('пропускает обычный снимок с телефона', () => {
    expect(validateFacadePhoto(fakeFile('IMG_0042.jpg', 'image/jpeg', 3_000_000))).toBeNull();
  });

  it('пропускает HEIC — конвертация разберётся дальше', () => {
    expect(validateFacadePhoto(fakeFile('IMG_0042.heic', 'image/heic', 4_000_000))).toBeNull();
  });

  it('отклоняет не-изображение с понятным текстом', () => {
    const result = validateFacadePhoto(fakeFile('doc.pdf', 'application/pdf', 1000));
    expect(result?.kind).toBe('not_an_image');
    expect(result?.message).toContain('не фотография');
  });

  it('отклоняет заведомо неподъёмный файл', () => {
    const result = validateFacadePhoto(
      fakeFile('huge.jpg', 'image/jpeg', FACADE_MAX_BYTES * 4 + 1),
    );
    expect(result?.kind).toBe('too_large');
  });

  it('не отклоняет файл, который выйдет за лимит только до сжатия', () => {
    // 20 MiB исходника после пересжатия обычно укладываются в 10 MiB.
    expect(validateFacadePhoto(fakeFile('big.jpg', 'image/jpeg', 20 * 1024 * 1024))).toBeNull();
  });
});

describe('prepareFacadePhoto', () => {
  afterEach(() => vi.restoreAllMocks());

  it('перекодирует даже небольшой JPEG и не копирует EXIF исходника', async () => {
    const original = new File(['EXIF GPS coordinates'], 'ok.jpg', { type: FACADE_TARGET_MIME });
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600 }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      { drawImage } as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['encoded pixels'], { type: FACADE_TARGET_MIME }));
    });

    const result = await prepareFacadePhoto(original);
    expect(result).not.toBe(original);
    expect(result.type).toBe(FACADE_TARGET_MIME);
    expect(await result.text()).toBe('encoded pixels');
    expect(drawImage).toHaveBeenCalled();
  });

  it('бросает понятную ошибку на не-изображении', async () => {
    await expect(prepareFacadePhoto(fakeFile('doc.pdf', 'application/pdf', 100))).rejects.toThrow(
      /не фотография/i,
    );
  });
});

describe('fit', () => {
  it('оставляет небольшой кадр как есть', () => {
    expect(fit(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('вписывает большой кадр, сохраняя пропорции', () => {
    expect(fit(4032, 3024)).toEqual({ width: 2048, height: 1536 });
  });

  it('работает с вертикальной ориентацией', () => {
    expect(fit(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });
});
