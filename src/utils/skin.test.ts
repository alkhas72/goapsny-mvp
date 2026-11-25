import { describe, expect, it } from 'vitest';
import { resolveMood, resolveSkin } from './skin';

describe('resolveSkin', () => {
  it('по умолчанию прежний вид', () => {
    expect(resolveSkin('', null)).toBe('classic');
  });

  it('адрес включает и выключает оболочку', () => {
    expect(resolveSkin('?skin=living', null)).toBe('living');
    expect(resolveSkin('?skin=classic', 'living')).toBe('classic');
  });

  it('без параметра берёт сохранённый выбор', () => {
    expect(resolveSkin('?mapper=1', 'living')).toBe('living');
  });

  it('неизвестное значение не включает оболочку', () => {
    expect(resolveSkin('?skin=neon', null)).toBe('classic');
  });
});

describe('resolveMood', () => {
  it('базовое настроение — мята', () => {
    expect(resolveMood('', null)).toBe('sage');
  });

  it('адрес важнее сохранённого, мусор отбрасывается', () => {
    expect(resolveMood('?mood=orchid', 'lime')).toBe('orchid');
    expect(resolveMood('?mood=pink', 'lime')).toBe('lime');
    expect(resolveMood('', 'purple')).toBe('sage');
  });
});
