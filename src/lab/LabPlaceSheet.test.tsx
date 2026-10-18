import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabPlaceSheet } from './LabPlaceSheet';
import type { LabDraft, LabPlace, LabSaveResult } from './contract';
import { labFixtures } from './fixtures';
import {
  ACCESSIBLE_OPTIONS,
  FACT_LABEL,
  LAB_TEXT,
  NUMBER_UNIT,
  PROBLEM_OPTIONS,
  RAMP_OPTIONS,
  RATING_LABEL,
  YES_NO_OPTIONS,
  stepsText,
  type FactField,
} from './labText';
import { STATUS_META } from '../shared';

const OK: LabSaveResult = { ok: true, duplicate: false, items: [] };
const DUPLICATE: LabSaveResult = { ok: true, duplicate: true, items: [] };
const QUOTA: LabSaveResult = { ok: false, error: 'quota' };

// labFixtures[1]: steps 2, step 12 cm, door 85 cm, ramp on request, toilet no, parking yes / not accessible.
const KNOWN: LabPlace = labFixtures[1];
// labFixtures[5]: gray, every passport field null / 'unknown'.
const UNKNOWN: LabPlace = labFixtures[5];
// labFixtures[2]: red. Its status word never collides with rating button labels.
const RED: LabPlace = labFixtures[2];

function setup(place: LabPlace, result: LabSaveResult = OK) {
  const onClose = vi.fn<() => void>();
  const onSubmit = vi.fn<(draft: LabDraft) => LabSaveResult>(() => result);
  const user = userEvent.setup();
  render(<LabPlaceSheet place={place} onClose={onClose} onSubmit={onSubmit} />);
  return { onClose, onSubmit, user };
}

function isDisabled(el: HTMLElement): boolean {
  return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
}

function addButtonName(field: FactField): string {
  return `${LAB_TEXT.add}: ${FACT_LABEL[field]}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelMatcher(label: string): RegExp {
  return new RegExp(`^${escapeRegExp(label)}:?$`);
}

// Smallest ancestor of the row label that carries more than the label itself,
// i.e. the passport row with its value (or "unknown" + add button).
function rowOf(label: string): HTMLElement {
  const matcher = labelMatcher(label);
  let el: HTMLElement | null = screen.getByText(matcher);
  while (el && matcher.test((el.textContent ?? '').trim())) el = el.parentElement;
  if (!el) throw new Error(`Row for "${label}" not found`);
  return el;
}

function liveText(role: 'status' | 'alert'): string {
  return screen
    .queryAllByRole(role)
    .map((el) => el.textContent ?? '')
    .join(' ');
}

describe('LabPlaceSheet', () => {
  afterEach(() => {
    cleanup();
  });

  describe('frame', () => {
    it('renders a dialog named after the place with the lab note', () => {
      setup(KNOWN);
      expect(screen.getByRole('dialog', { name: KNOWN.name })).toBeTruthy();
      expect(screen.getByText(LAB_TEXT.labNote)).toBeTruthy();
    });

    it('close button calls onClose', async () => {
      const { onClose, onSubmit, user } = setup(KNOWN);
      await user.click(screen.getByRole('button', { name: LAB_TEXT.close }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('Escape calls onClose', async () => {
      const { onClose, onSubmit, user } = setup(KNOWN);
      screen.getByRole('button', { name: RATING_LABEL.green }).focus();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it.each([
      ['green', labFixtures[0]],
      ['red', RED],
      ['gray', UNKNOWN],
    ] as const)('shows the verified status word for a %s place', (_status, place) => {
      setup(place);
      expect(screen.getByText(STATUS_META[place.status].ru)).toBeTruthy();
    });

    it('shows the gray note only for gray places', () => {
      setup(UNKNOWN);
      expect(screen.getByText(LAB_TEXT.grayNote)).toBeTruthy();
      cleanup();
      setup(RED);
      expect(screen.queryByText(LAB_TEXT.grayNote)).toBeNull();
    });
  });

  describe('rating', () => {
    it('offers three named buttons inside the rating group', () => {
      setup(RED);
      const group = screen.getByRole('group', { name: LAB_TEXT.rateQuestion });
      for (const label of [RATING_LABEL.green, RATING_LABEL.yellow, RATING_LABEL.red]) {
        expect(within(group).getByRole('button', { name: label })).toBeTruthy();
      }
    });

    it('submits exactly the rating draft and marks the button pressed on save', async () => {
      const { onSubmit, user } = setup(RED, OK);
      const group = screen.getByRole('group', { name: LAB_TEXT.rateQuestion });
      const yellow = within(group).getByRole('button', { name: RATING_LABEL.yellow });
      await user.click(yellow);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'rating',
        proposedStatus: 'yellow',
        placeId: RED.id,
        placeName: RED.name,
      });
      const status = liveText('status');
      expect(status).toContain(LAB_TEXT.saved);
      expect(status).not.toContain(LAB_TEXT.duplicate);
      expect(within(group).getByRole('button', { name: RATING_LABEL.yellow }).getAttribute('aria-pressed')).toBe('true');
    });

    it('reports a duplicate rating', async () => {
      const { user } = setup(RED, DUPLICATE);
      await user.click(screen.getByRole('button', { name: RATING_LABEL.green }));
      expect(liveText('status')).toContain(LAB_TEXT.duplicate);
    });

    it('shows an alert when saving fails', async () => {
      const { user } = setup(RED, QUOTA);
      await user.click(screen.getByRole('button', { name: RATING_LABEL.green }));
      expect(liveText('alert')).toContain(LAB_TEXT.saveFailed);
      expect(liveText('status')).not.toContain(LAB_TEXT.saved);
    });

    it.each([
      ['saved', OK],
      ['duplicate', DUPLICATE],
      ['quota', QUOTA],
    ] as const)('never repaints the verified status (%s)', async (_case, result) => {
      const { user } = setup(RED, result);
      await user.click(screen.getByRole('button', { name: RATING_LABEL.green }));
      expect(screen.getByText(STATUS_META.red.ru)).toBeTruthy();
      expect(screen.queryByText(STATUS_META.green.ru)).toBeNull();
    });
  });

  describe('passport', () => {
    it('shows the passport heading and the three groups', () => {
      setup(KNOWN);
      expect(screen.getByRole('heading', { name: LAB_TEXT.passportTitle })).toBeTruthy();
      expect(screen.getByText(labelMatcher(LAB_TEXT.groups.entrance))).toBeTruthy();
      expect(screen.getByText(labelMatcher(LAB_TEXT.groups.toilet))).toBeTruthy();
      expect(screen.getByText(labelMatcher(LAB_TEXT.groups.parking))).toBeTruthy();
    });

    it('formats known values without add buttons', () => {
      setup(KNOWN);
      expect(rowOf(FACT_LABEL.steps_count).textContent).toContain(stepsText(2));
      expect(rowOf(FACT_LABEL.step_height_cm).textContent).toContain('12 см');
      expect(rowOf(FACT_LABEL.door_width_cm).textContent).toContain('85 см');
      expect(rowOf(FACT_LABEL.ramp_type).textContent).toContain('По запросу');
      expect(rowOf(FACT_LABEL.toilet_exists).textContent).toContain('Нет');
      expect(rowOf(FACT_LABEL.parking).textContent).toContain('Да');
      expect(rowOf(FACT_LABEL.parking_accessible).textContent).toContain('Нет');

      for (const field of ['steps_count', 'step_height_cm', 'door_width_cm', 'ramp_type', 'toilet_exists', 'parking', 'parking_accessible'] as const) {
        expect(screen.queryByRole('button', { name: addButtonName(field) })).toBeNull();
      }
      expect(screen.queryByText(LAB_TEXT.unknown)).toBeNull();
    });

    it('shows zero steps as "Нет ступеней", "Нет" ramp and partial access', () => {
      setup({ ...labFixtures[0], ramp_type: 'none', toilet_accessible: 'partial' });
      expect(rowOf(FACT_LABEL.steps_count).textContent).toContain(stepsText(0));
      expect(rowOf(FACT_LABEL.ramp_type).textContent).toContain('Нет');
      expect(rowOf(FACT_LABEL.toilet_accessible).textContent).toContain('Частично');
    });

    it('hides dependent rows: step height at 0 steps, toilet access without toilet, parking access without parking', () => {
      setup({ ...labFixtures[0], steps_count: 0, toilet_exists: 'no', parking: 'no' });
      for (const field of ['step_height_cm', 'toilet_accessible', 'parking_accessible'] as const) {
        expect(screen.queryByText(labelMatcher(FACT_LABEL[field]))).toBeNull();
        expect(screen.queryByRole('button', { name: addButtonName(field) })).toBeNull();
      }
    });

    it('keeps dependent access rows when the parent fact is yes', () => {
      setup(labFixtures[0]); // steps 0 hides height; toilet yes and parking yes keep their access rows
      expect(rowOf(FACT_LABEL.toilet_accessible).textContent).toContain('Да');
      expect(rowOf(FACT_LABEL.parking_accessible).textContent).toContain('Да');
    });

    it('shows unknown with an add button for every null / unknown field and never renders null as zero', () => {
      setup(UNKNOWN);
      const fields: FactField[] = [
        'steps_count',
        'step_height_cm',
        'door_width_cm',
        'ramp_type',
        'toilet_exists',
        'toilet_accessible',
        'parking',
        'parking_accessible',
      ];
      for (const field of fields) {
        expect(screen.getByRole('button', { name: addButtonName(field) })).toBeTruthy();
        expect(rowOf(FACT_LABEL[field]).textContent).toContain(LAB_TEXT.unknown);
      }
      expect(screen.getAllByText(LAB_TEXT.unknown)).toHaveLength(fields.length);
      expect(screen.queryByText(stepsText(0))).toBeNull();
      expect(rowOf(FACT_LABEL.steps_count).textContent).not.toMatch(/\d/);
    });
  });

  describe('fact forms', () => {
    it.each([
      ['steps_count', '3', 3],
      ['step_height_cm', '15', 15],
      ['door_width_cm', '90', 90],
    ] as const)('number field %s: Save gated on a non-negative value, submits the number', async (field, typed, value) => {
      const { onSubmit, user } = setup(UNKNOWN, OK);
      await user.click(screen.getByRole('button', { name: addButtonName(field) }));

      const input = screen.getByRole('spinbutton', { name: FACT_LABEL[field] + (NUMBER_UNIT[field] ? `, ${NUMBER_UNIT[field]}` : '') });
      const save = () => screen.getByRole('button', { name: LAB_TEXT.save });
      expect(isDisabled(save())).toBe(true);

      fireEvent.change(input, { target: { value: '-1' } });
      expect(isDisabled(save())).toBe(true);

      await user.clear(input);
      await user.type(input, typed);
      expect(isDisabled(save())).toBe(false);
      await user.click(save());

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'fact',
        fact: { field, value },
        placeId: UNKNOWN.id,
        placeName: UNKNOWN.name,
      });
      expect(screen.queryByRole('spinbutton')).toBeNull();
      expect(liveText('status')).toContain(LAB_TEXT.saved);
    });

    it('Cancel closes the form without submitting', async () => {
      const { onSubmit, user } = setup(UNKNOWN);
      await user.click(screen.getByRole('button', { name: addButtonName('steps_count') }));
      await user.type(screen.getByRole('spinbutton', { name: FACT_LABEL.steps_count }), '3');
      await user.click(screen.getByRole('button', { name: LAB_TEXT.cancel }));

      expect(screen.queryByRole('spinbutton')).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps the form open with an alert when saving fails', async () => {
      const { onSubmit, user } = setup(UNKNOWN, QUOTA);
      await user.click(screen.getByRole('button', { name: addButtonName('door_width_cm') }));
      await user.type(screen.getByRole('spinbutton', { name: FACT_LABEL.door_width_cm + ', см' }), '80');
      await user.click(screen.getByRole('button', { name: LAB_TEXT.save }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('spinbutton', { name: FACT_LABEL.door_width_cm + ', см' })).toBeTruthy();
      expect(liveText('alert')).toContain(LAB_TEXT.saveFailed);
    });

    it('ramp: radios from RAMP_OPTIONS, Save gated on a choice, submits the value', async () => {
      const { onSubmit, user } = setup(UNKNOWN, OK);
      await user.click(screen.getByRole('button', { name: addButtonName('ramp_type') }));

      expect(screen.getAllByRole('radio')).toHaveLength(RAMP_OPTIONS.length);
      for (const option of RAMP_OPTIONS) {
        expect(screen.getByRole('radio', { name: option.label })).toBeTruthy();
      }
      expect(isDisabled(screen.getByRole('button', { name: LAB_TEXT.save }))).toBe(true);

      await user.click(screen.getByRole('radio', { name: 'Стационарный' }));
      await user.click(screen.getByRole('button', { name: LAB_TEXT.save }));

      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'fact',
        fact: { field: 'ramp_type', value: 'permanent' },
        placeId: UNKNOWN.id,
        placeName: UNKNOWN.name,
      });
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(liveText('status')).toContain(LAB_TEXT.saved);
    });

    it('parking: yes/no radios, submits the chosen value', async () => {
      const { onSubmit, user } = setup(UNKNOWN, OK);
      await user.click(screen.getByRole('button', { name: addButtonName('parking') }));

      expect(screen.getAllByRole('radio')).toHaveLength(YES_NO_OPTIONS.length);
      expect(isDisabled(screen.getByRole('button', { name: LAB_TEXT.save }))).toBe(true);
      await user.click(screen.getByRole('radio', { name: 'Нет' }));
      await user.click(screen.getByRole('button', { name: LAB_TEXT.save }));

      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'fact',
        fact: { field: 'parking', value: 'no' },
        placeId: UNKNOWN.id,
        placeName: UNKNOWN.name,
      });
    });

    it('toilet access: yes/partial/no radios, submits partial', async () => {
      const { onSubmit, user } = setup(UNKNOWN, OK);
      await user.click(screen.getByRole('button', { name: addButtonName('toilet_accessible') }));

      expect(screen.getAllByRole('radio')).toHaveLength(ACCESSIBLE_OPTIONS.length);
      expect(isDisabled(screen.getByRole('button', { name: LAB_TEXT.save }))).toBe(true);
      await user.click(screen.getByRole('radio', { name: 'Частично' }));
      await user.click(screen.getByRole('button', { name: LAB_TEXT.save }));

      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'fact',
        fact: { field: 'toilet_accessible', value: 'partial' },
        placeId: UNKNOWN.id,
        placeName: UNKNOWN.name,
      });
    });
  });

  describe('problem report', () => {
    it('opens a form with problem radios and a comment, Save gated on a choice, submits trimmed comment', async () => {
      const { onSubmit, user } = setup(KNOWN, OK);
      await user.click(screen.getByRole('button', { name: LAB_TEXT.reportOpen }));

      const box =
        screen.queryByRole('radiogroup', { name: LAB_TEXT.reportTitle }) ??
        screen.getByRole('group', { name: LAB_TEXT.reportTitle });
      for (const option of PROBLEM_OPTIONS) {
        expect(within(box).getByRole('radio', { name: option.label })).toBeTruthy();
      }

      const send = () => screen.getByRole('button', { name: LAB_TEXT.reportSend });
      expect(isDisabled(send())).toBe(true);

      await user.click(screen.getByRole('radio', { name: PROBLEM_OPTIONS[1].label }));
      await user.type(screen.getByRole('textbox', { name: LAB_TEXT.reportComment }), '  дверь узкая  ');
      expect(isDisabled(send())).toBe(false);
      await user.click(send());

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'problem',
        problem: 'information',
        comment: 'дверь узкая',
        placeId: KNOWN.id,
        placeName: KNOWN.name,
      });
    });
  });
});
