import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_SLUGS, PLACE_TYPES, categoryName, placeTypeByName, placeTypesOf } from './index';

describe('классификатор мест по OpenStreetMap', () => {
  it('групп одиннадцать, «Туалетов» среди них нет', () => {
    expect(CATEGORIES).toHaveLength(11);
    expect(CATEGORY_SLUGS).not.toContain('toilets');
  });

  it('у каждой группы есть типы, у каждого типа — тег OSM и своя группа', () => {
    for (const group of CATEGORIES) expect(placeTypesOf(group.slug).length).toBeGreaterThan(0);
    for (const type of PLACE_TYPES) {
      expect(CATEGORY_SLUGS).toContain(type.group);
      expect(type.osmKey).toMatch(/^[a-z_]+$/);
      expect(type.osmValue).toMatch(/^[a-z_]+$/);
    }
  });

  it('типы не повторяются ни по тегу, ни по названию', () => {
    expect(new Set(PLACE_TYPES.map((item) => item.slug)).size).toBe(PLACE_TYPES.length);
    expect(new Set(PLACE_TYPES.map((item) => item.ru)).size).toBe(PLACE_TYPES.length);
  });

  it('«Здоровье» раскрывается в аптеку, поликлинику и больницу', () => {
    const names = placeTypesOf('health').map((item) => item.ru);
    expect(names).toEqual(expect.arrayContaining(['Аптека', 'Поликлиника', 'Больница']));
  });

  it('общественный туалет — тип amenity=toilets, а не группа', () => {
    const toilet = placeTypeByName('Общественный туалет');
    expect(toilet).toMatchObject({ osmKey: 'amenity', osmValue: 'toilets' });
    // Старые карточки с выключенной группой показываются по-человечески.
    expect(categoryName('toilets')).toBe('Общественный туалет');
  });
});
