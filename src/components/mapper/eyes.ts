/**
 * The assistant's eyes: what it reads from the entrance photo.
 *
 * Arbitrator 28.09: the photo goes to a cloud vision model, but only after
 * the phone itself hides faces and car plates. `prepareForCloud` re-encodes
 * the photo on the device (drops EXIF with the location, caps the size);
 * face and plate masking plugs in here before anything leaves the phone.
 *
 * The prototype uses `demoEyes` — a fixed answer, no network — so the flow
 * can be tried on the phone before the cloud call is switched on.
 */
import type { EntranceDraft } from './assistant';
import { maskSensitive, nativeFaceDetector, type SensitiveDetector } from './privacyMask';

export interface AssistantEyes {
  look(photo: File): Promise<EntranceDraft>;
}

const MAX_SIDE = 1280;

/** Detectors available on this device. Plates have none yet (AISP-328), so the cloud path stays closed. */
export function deviceDetectors(): SensitiveDetector[] {
  const face = nativeFaceDetector();
  return face ? [face] : [];
}

/**
 * Re-encode on the device: no EXIF (location), at most 1280 px a side, faces and
 * plates hidden. Throws `privacy_unavailable` when a detector is missing — the
 * photo must then not leave the phone.
 */
export async function prepareForCloud(photo: File, detectors: SensitiveDetector[] = deviceDetectors()): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  await maskSensitive(canvas, detectors);
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', 0.85),
  );
}

export const demoEyes: AssistantEyes = {
  async look() {
    await new Promise((r) => setTimeout(r, 1600));
    return {
      name: 'Аптека «Здоровье»',
      category: 'health',
      subtype: 'Аптека',
      stepsVisible: 2,
      ramp: 'none',
    };
  },
};
