import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { AccessPassport } from './AccessPassport';
import { stepsText } from '../utils/accessText';
import type { PublicPlace } from '../services/places';

const BLANK: PublicPlace = {
  id: 'p1',
  name: 'Аптека',
  category: 'pharmacy',
  lat: 43,
  lng: 41,
  status: 'gray',
  stepsCount: null,
  stepHeightCm: null,
  rampType: 'none',
  doorWidthCm: null,
  entranceNotes: null,
  toiletExists: 'unknown',
  toiletAccessible: 'unknown',
  parking: 'unknown',
  comment: null,
  osmTags: {},
  details: { schema_version: 1 },
  moderationStatus: 'published',
  source: 'public',
  createdBy: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function valueOf(label: string): string {
  const term = screen.getAllByText(label, { selector: 'dt' })[0];
  return term.nextElementSibling?.textContent ?? '';
}

function groupValue(key: 'entrance' | 'toilet' | 'parking'): string {
  return screen.getByTestId(`passport-${key}-value`).textContent ?? '';
}

describe('AccessPassport', () => {
  afterEach(cleanup);

  it('shows the three groups under one heading', () => {
    render(<AccessPassport place={BLANK} />);
    const section = screen.getByRole('region', { name: 'Доступность' });
    for (const title of ['Вход', 'Туалет', 'Парковка']) {
      expect(within(section).getByRole('heading', { name: title })).toBeTruthy();
    }
  });

  it('collapses a group with nothing recorded to one "неизвестно", never zero or "нет"', () => {
    render(<AccessPassport place={BLANK} />);
    expect(groupValue('entrance')).toBe('неизвестно');
    expect(groupValue('toilet')).toBe('неизвестно');
    expect(groupValue('parking')).toBe('неизвестно');
    expect(screen.queryByText('Ступени')).toBeNull();
    expect(screen.queryByText(/0 см|Нет ступеней|^нет$/)).toBeNull();
  });

  it('shows unknown for the unfilled fields of a partly recorded group', () => {
    render(<AccessPassport place={{ ...BLANK, doorWidthCm: 90, toiletExists: 'yes' }} />);
    for (const label of ['Ступени', 'Высота ступени', 'Пандус', 'Лифт', 'Доступен для коляски']) {
      expect(valueOf(label)).toBe('неизвестно');
    }
    expect(valueOf('Ширина двери')).toBe('90 см');
    expect(groupValue('toilet')).toBe('есть');
  });

  it('formats known values with units and plurals', () => {
    render(
      <AccessPassport
        place={{
          ...BLANK,
          stepsCount: 3,
          stepHeightCm: 15,
          doorWidthCm: 90,
          rampType: 'portable_on_request',
          toiletExists: 'yes',
          toiletAccessible: 'partial',
          parking: 'yes',
          entranceNotes: '  вход со двора ',
          details: { schema_version: 1, elevator: 'no' },
        }}
      />,
    );
    expect(valueOf('Ступени')).toBe('3 ступени');
    expect(valueOf('Высота ступени')).toBe('15 см');
    expect(valueOf('Ширина двери')).toBe('90 см');
    expect(valueOf('Пандус')).toBe('Пандус по запросу');
    expect(valueOf('Лифт')).toBe('нет');
    expect(groupValue('toilet')).toBe('есть');
    expect(valueOf('Доступен для коляски')).toBe('частично');
    expect(groupValue('parking')).toBe('есть');
    expect(valueOf('Заметка о входе')).toBe('вход со двора');
  });

  it('treats the default "none" ramp as "нет" only when steps were recorded', () => {
    render(<AccessPassport place={{ ...BLANK, stepsCount: 2 }} />);
    expect(valueOf('Пандус')).toBe('нет');
  });

  it('with zero steps hides step height and an unrecorded ramp', () => {
    render(<AccessPassport place={{ ...BLANK, stepsCount: 0, stepHeightCm: 0 }} />);
    expect(valueOf('Ступени')).toBe('Нет ступеней');
    expect(screen.queryByText('Высота ступени')).toBeNull();
    expect(screen.queryByText('Пандус')).toBeNull();
  });

  it('hides toilet access when there is no toilet', () => {
    render(<AccessPassport place={{ ...BLANK, toiletExists: 'no', toiletAccessible: 'no' }} />);
    expect(groupValue('toilet')).toBe('нет');
    expect(screen.queryByText('Доступен для коляски')).toBeNull();
  });

  it('pluralises steps in Russian', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map(stepsText)).toEqual([
      '1 ступень',
      '2 ступени',
      '5 ступеней',
      '11 ступеней',
      '21 ступень',
      '22 ступени',
      '25 ступеней',
    ]);
  });
});
