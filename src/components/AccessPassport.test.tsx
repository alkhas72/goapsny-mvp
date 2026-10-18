import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { AccessPassport, stepsText } from './AccessPassport';
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

describe('AccessPassport', () => {
  afterEach(cleanup);

  it('shows the three groups under one heading', () => {
    render(<AccessPassport place={BLANK} />);
    const section = screen.getByRole('region', { name: 'Доступность' });
    for (const title of ['Вход', 'Туалет', 'Парковка']) {
      expect(within(section).getByRole('heading', { name: title })).toBeTruthy();
    }
  });

  it('shows unknown for every unfilled field, never zero or "нет"', () => {
    render(<AccessPassport place={BLANK} />);
    for (const label of ['Ступени', 'Высота ступени', 'Ширина двери', 'Пандус', 'Лифт', 'Туалет', 'Доступен для коляски', 'Парковка']) {
      expect(valueOf(label)).toBe('неизвестно');
    }
    expect(screen.queryByText(/0 см|Нет ступеней/)).toBeNull();
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
    expect(valueOf('Туалет')).toBe('есть');
    expect(valueOf('Доступен для коляски')).toBe('частично');
    expect(valueOf('Парковка')).toBe('есть');
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
    expect(valueOf('Туалет')).toBe('нет');
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
