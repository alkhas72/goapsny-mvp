import { describe, expect, it } from 'vitest';
import {
  DOOR_WIDTH_RANGE,
  EMPTY_AMENITIES,
  EMPTY_FACTS,
  STEP_HEIGHT_RANGE,
  amenitiesTouched,
  doorWideOf,
  factsFromDraft,
  parseCm,
  stepHighOf,
  suggestStatus,
  type EntranceFacts,
} from './assistant';

const facts = (patch: Partial<EntranceFacts>): EntranceFacts => ({ ...EMPTY_FACTS, name: 'x', ...patch });

describe('suggestStatus', () => {
  it('green for a step-free entrance', () => {
    expect(suggestStatus(facts({ steps: 0, doorWidthCm: 90 }))).toMatchObject({ status: 'green', reason: 'вход без ступеней', unchecked: [] });
  });

  it('green with a permanent ramp despite steps', () => {
    expect(suggestStatus(facts({ steps: 3, ramp: 'permanent', doorWidthCm: 90 })).status).toBe('green');
  });

  it('green with a platform lift at the entrance', () => {
    expect(suggestStatus(facts({ steps: 12, ramp: 'lift', doorWidthCm: 90 }))).toMatchObject({
      status: 'green',
      reason: 'есть подъёмник у входа',
    });
  });

  it('yellow for one low step, naming the centimetres', () => {
    expect(suggestStatus(facts({ steps: 1, stepHeightCm: 4, ramp: 'none', doorWidthCm: 90 }))).toMatchObject({
      status: 'yellow',
      reason: 'одна низкая ступень, 4 см',
    });
  });

  it('keeps the 5 cm border: 5 is low, 6 is not', () => {
    expect(suggestStatus(facts({ steps: 1, stepHeightCm: 5, ramp: 'none', doorWidthCm: 90 })).status).toBe('yellow');
    expect(suggestStatus(facts({ steps: 1, stepHeightCm: 6, ramp: 'none', doorWidthCm: 90 })).status).toBe('red');
  });

  it('yellow with a portable ramp, naming the steps', () => {
    expect(suggestStatus(facts({ steps: 2, ramp: 'portable_on_request', doorWidthCm: 90 })).reason).toBe(
      '2 ступени, приставной пандус по просьбе',
    );
  });

  it('red for steps without a ramp', () => {
    expect(suggestStatus(facts({ steps: 5, stepHeightCm: 15, ramp: 'none', doorWidthCm: 90 }))).toMatchObject({
      status: 'red',
      reason: '5 ступеней без пандуса',
    });
  });

  it('red for a narrow door even when step-free, naming the width', () => {
    expect(suggestStatus(facts({ steps: 0, doorWidthCm: 70 }))).toMatchObject({
      status: 'red',
      reason: 'дверь 70 см, уже 80 см — коляска не проходит',
    });
  });

  it('lists what is still unchecked', () => {
    expect(suggestStatus(facts({ steps: 1, ramp: 'none' })).unchecked).toEqual(['ширина двери', 'высота ступени']);
  });
});

describe('measures', () => {
  it('derives the old yes/no answers from centimetres', () => {
    expect(stepHighOf(null)).toBe('unknown');
    expect(stepHighOf(5)).toBe('no');
    expect(stepHighOf(6)).toBe('yes');
    expect(doorWideOf(null)).toBe('unknown');
    expect(doorWideOf(79)).toBe('no');
    expect(doorWideOf(80)).toBe('yes');
  });

  it('reads typed centimetres and refuses what the server would reject', () => {
    expect(parseCm('', STEP_HEIGHT_RANGE)).toBeNull();
    expect(parseCm(' 12 ', STEP_HEIGHT_RANGE)).toBe(12);
    expect(parseCm('4,6', STEP_HEIGHT_RANGE)).toBe(5);
    expect(parseCm('101', STEP_HEIGHT_RANGE)).toBeNull();
    expect(parseCm('20', DOOR_WIDTH_RANGE)).toBeNull();
    expect(parseCm('abc', DOOR_WIDTH_RANGE)).toBeNull();
  });

  it('takes rough centimetres from the photo draft', () => {
    const f = factsFromDraft({
      name: 'Аптека',
      category: 'health',
      subtype: 'Аптека',
      stepsVisible: 1,
      ramp: 'none',
      stepHeightCm: 12,
      doorWidthCm: 85,
    });
    expect(f).toMatchObject({ steps: 1, stepHeightCm: 12, doorWidthCm: 85 });
  });
});

describe('amenities', () => {
  it('an untouched step counts as skipped', () => {
    expect(amenitiesTouched(EMPTY_AMENITIES, 0)).toBe(false);
    expect(amenitiesTouched({ ...EMPTY_AMENITIES, handWash: 'no' }, 0)).toBe(true);
    expect(amenitiesTouched(EMPTY_AMENITIES, 1)).toBe(true);
  });
});
