import { describe, expect, it } from 'vitest';
import { expandBox, maskBoxes, maskSensitive, PrivacyUnavailableError, type SensitiveDetector } from './privacyMask';

describe('expandBox', () => {
  it('adds a margin and stays inside the image', () => {
    expect(expandBox({ x: 10, y: 10, width: 40, height: 40 }, 100, 100)).toEqual({ x: 0, y: 0, width: 60, height: 60 });
    expect(expandBox({ x: 80, y: 80, width: 40, height: 40 }, 100, 100)).toEqual({ x: 70, y: 70, width: 30, height: 30 });
  });
});

function fakeCanvas() {
  const calls: string[] = [];
  const ctx = {
    canvas: { width: 100, height: 100 },
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(100) }),
    fillRect: (...a: number[]) => calls.push(a.join(',')),
    fillStyle: '',
  };
  const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx, calls };
}

describe('maskBoxes', () => {
  it('paints blocks over the box and nothing when there are no hits', () => {
    const { ctx, calls } = fakeCanvas();
    maskBoxes(ctx as unknown as CanvasRenderingContext2D, []);
    expect(calls).toHaveLength(0);
    maskBoxes(ctx as unknown as CanvasRenderingContext2D, [{ x: 20, y: 20, width: 40, height: 40 }]);
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('maskSensitive', () => {
  const face: SensitiveDetector = { kind: 'face', detect: async () => [{ x: 20, y: 20, width: 20, height: 20 }] };
  const plate: SensitiveDetector = { kind: 'plate', detect: async () => [] };

  it('fails closed when a required detector is missing', async () => {
    const { canvas } = fakeCanvas();
    await expect(maskSensitive(canvas, [face])).rejects.toBeInstanceOf(PrivacyUnavailableError);
    await expect(maskSensitive(canvas, [])).rejects.toMatchObject({ message: 'privacy_unavailable:face,plate' });
  });

  it('fails closed when a detector throws', async () => {
    const { canvas } = fakeCanvas();
    const broken: SensitiveDetector = { kind: 'plate', detect: async () => { throw new Error('boom'); } };
    await expect(maskSensitive(canvas, [face, broken])).rejects.toThrow('boom');
  });

  it('masks hits from every detector', async () => {
    const { canvas, calls } = fakeCanvas();
    expect(await maskSensitive(canvas, [face, plate])).toBe(1);
    expect(calls.length).toBeGreaterThan(0);
  });
});
