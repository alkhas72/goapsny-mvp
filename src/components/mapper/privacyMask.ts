/**
 * Hides faces and car plates on the phone before a photo leaves it.
 *
 * Fail closed: a detector that cannot run is an error, never "nothing found".
 * The caller decides what the person sees; the photo does not go to the cloud.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Finds regions to hide on a canvas that holds the (already resized) photo. */
export interface SensitiveDetector {
  kind: 'face' | 'plate';
  detect(canvas: HTMLCanvasElement): Promise<Box[]>;
}

/** Margin around a hit so hair, chin and plate frame are covered too. */
const PAD = 0.25;
/** Blocks per box side: coarse enough that nothing can be read back. */
const BLOCKS = 6;

export function expandBox(box: Box, width: number, height: number): Box {
  const px = box.width * PAD;
  const py = box.height * PAD;
  const x = Math.max(0, Math.floor(box.x - px));
  const y = Math.max(0, Math.floor(box.y - py));
  const right = Math.min(width, Math.ceil(box.x + box.width + px));
  const bottom = Math.min(height, Math.ceil(box.y + box.height + py));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** Solid-colour blocks over each box: destroys detail instead of blurring it. */
export function maskBoxes(ctx: CanvasRenderingContext2D, boxes: Box[]): void {
  const { width, height } = ctx.canvas;
  for (const raw of boxes) {
    const b = expandBox(raw, width, height);
    if (b.width < 1 || b.height < 1) continue;
    const data = ctx.getImageData(b.x, b.y, b.width, b.height).data;
    const bw = Math.max(1, Math.ceil(b.width / BLOCKS));
    const bh = Math.max(1, Math.ceil(b.height / BLOCKS));
    for (let by = 0; by < b.height; by += bh) {
      for (let bx = 0; bx < b.width; bx += bw) {
        let r = 0;
        let g = 0;
        let bl = 0;
        let n = 0;
        for (let y = by; y < Math.min(by + bh, b.height); y++) {
          for (let x = bx; x < Math.min(bx + bw, b.width); x++) {
            const i = (y * b.width + x) * 4;
            r += data[i];
            g += data[i + 1];
            bl += data[i + 2];
            n++;
          }
        }
        ctx.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)})`;
        ctx.fillRect(b.x + bx, b.y + by, Math.min(bw, b.width - bx), Math.min(bh, b.height - by));
      }
    }
  }
}

interface NativeFaceDetector {
  detect(source: CanvasImageSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}
type NativeFaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector;

/** Faces through the browser's own detector (Chrome on Android); absent elsewhere. */
export function nativeFaceDetector(): SensitiveDetector | null {
  const Ctor = (globalThis as { FaceDetector?: NativeFaceDetectorCtor }).FaceDetector;
  if (!Ctor) return null;
  const detector = new Ctor({ fastMode: false, maxDetectedFaces: 20 });
  return {
    kind: 'face',
    async detect(canvas) {
      const faces = await detector.detect(canvas);
      return faces.map((f) => ({
        x: f.boundingBox.x,
        y: f.boundingBox.y,
        width: f.boundingBox.width,
        height: f.boundingBox.height,
      }));
    },
  };
}

export class PrivacyUnavailableError extends Error {
  readonly missing: Array<SensitiveDetector['kind']>;
  constructor(missing: Array<SensitiveDetector['kind']>) {
    super(`privacy_unavailable:${missing.join(',')}`);
    this.missing = missing;
  }
}

/**
 * Runs every detector and masks the hits in place. Throws when a required kind
 * has no detector or a detector fails, so an unmasked photo is never returned.
 */
export async function maskSensitive(
  canvas: HTMLCanvasElement,
  detectors: SensitiveDetector[],
  required: Array<SensitiveDetector['kind']> = ['face', 'plate'],
): Promise<number> {
  const missing = required.filter((kind) => !detectors.some((d) => d.kind === kind));
  if (missing.length) throw new PrivacyUnavailableError(missing);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  const boxes: Box[] = [];
  for (const d of detectors) boxes.push(...(await d.detect(canvas)));
  maskBoxes(ctx, boxes);
  return boxes.length;
}
