/**
 * The assistant's eyes: what it reads from the entrance photo.
 *
 * `cloudEyes` sends the photo to the volunteers' assistant (DeepSeek Flash
 * behind `api/assistant.js`): the photo is re-encoded on the phone (no EXIF
 * with the location, at most 1280 px a side) and goes to the model as taken
 * (Arbitrator 25.11). The answer is a draft: rough centimetres are marked
 * preliminary and the mapper corrects them. When the assistant is not
 * connected or fails, the fields simply stay empty.
 *
 * `demoEyes` is a fixed answer with no network, for tests and demos.
 */
import { CATEGORY_SLUGS, type RampType } from '../../shared/index';
import { postAssistant, type AssistantApiOptions } from '../../services/assistantApi';
import { shrinkToBase64 } from '../../utils/photo';
import { DOOR_WIDTH_RANGE, STEP_HEIGHT_RANGE, SUBTYPES, TOILET_NOTE_MAX, type EntranceDraft } from './assistant';

export interface AssistantEyes {
  look(photo: File): Promise<EntranceDraft>;
  /** Короткое описание туалета по фото; null — сказать нечего. */
  describeToilet?(photo: File): Promise<string | null>;
}

const RAMPS: readonly RampType[] = ['none', 'permanent', 'portable_on_request', 'portable_available', 'lift'];

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** The server's draft, checked once more: nothing outside the lists gets in. */
export function draftFromServer(raw: unknown): EntranceDraft {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const category = typeof d.category === 'string' && CATEGORY_SLUGS.includes(d.category) ? d.category : null;
  const subtype =
    category && typeof d.subtype === 'string' && (SUBTYPES[category] ?? []).includes(d.subtype) ? d.subtype : null;
  return {
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : null,
    category,
    subtype,
    stepsVisible: whole(d.steps, 0, 60),
    ramp: RAMPS.includes(d.ramp as RampType) ? (d.ramp as RampType) : null,
    stepHeightCm: whole(d.step_height_cm, STEP_HEIGHT_RANGE[0], STEP_HEIGHT_RANGE[1]),
    doorWidthCm: whole(d.door_width_cm, DOOR_WIDTH_RANGE[0], DOOR_WIDTH_RANGE[1]),
  };
}

export function cloudEyes(options: AssistantApiOptions = {}): AssistantEyes {
  return {
    async look(photo) {
      const image = await shrinkToBase64(photo);
      const data = await postAssistant<{ draft?: unknown }>('/api/assistant', { mode: 'look', image }, options);
      return draftFromServer(data.draft);
    },
    async describeToilet(photo) {
      const image = await shrinkToBase64(photo);
      const data = await postAssistant<{ note?: unknown }>('/api/assistant', { mode: 'toilet', image }, options);
      const note = typeof data.note === 'string' ? data.note.trim().slice(0, TOILET_NOTE_MAX) : '';
      return note || null;
    },
  };
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
      stepHeightCm: 15,
      doorWidthCm: 90,
    };
  },
};
