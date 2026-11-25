import { describe, expect, it } from 'vitest';
import { CATEGORY_SLUGS as SERVER_SLUGS, RAMP_TYPES, SUBTYPES as SERVER_SUBTYPES } from '../../api/_lib/catalog.js';
import { DOOR_WIDTH_RANGE as SERVER_DOOR, STEP_HEIGHT_RANGE as SERVER_STEP } from '../../api/_lib/catalog.js';
import { CATEGORY_SLUGS } from '../../src/shared/index';
import { DOOR_WIDTH_RANGE, STEP_HEIGHT_RANGE, SUBTYPES } from '../../src/components/mapper/assistant';

// Серверная функция держит свою копию справочников: расхождение с приложением
// значило бы, что помощник предлагает то, чего в карточке выбрать нельзя.
describe('справочники помощника на сервере', () => {
  it('категории те же, что в приложении', () => {
    expect([...SERVER_SLUGS].sort()).toEqual([...CATEGORY_SLUGS].sort());
  });

  it('типы объектов те же, что в приложении', () => {
    expect(SERVER_SUBTYPES).toEqual(SUBTYPES);
  });

  it('пределы сантиметров те же, что в приложении', () => {
    expect(SERVER_STEP).toEqual([...STEP_HEIGHT_RANGE]);
    expect(SERVER_DOOR).toEqual([...DOOR_WIDTH_RANGE]);
  });

  it('подъёмник есть среди видов пандуса', () => {
    expect(RAMP_TYPES).toContain('lift');
  });
});
