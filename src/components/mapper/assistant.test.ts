import { describe, expect, it } from 'vitest';
import { EMPTY_FACTS, nextStep, suggestStatus, type EntranceFacts } from './assistant';

const facts = (patch: Partial<EntranceFacts>): EntranceFacts => ({ ...EMPTY_FACTS, name: 'x', ...patch });

describe('suggestStatus', () => {
  it('green for a step-free entrance', () => {
    expect(suggestStatus(facts({ steps: 0, doorWide: 'yes' }))).toMatchObject({ status: 'green', reason: 'вход без ступеней', unchecked: [] });
  });

  it('green with a permanent ramp despite steps', () => {
    expect(suggestStatus(facts({ steps: 3, ramp: 'permanent', doorWide: 'yes' })).status).toBe('green');
  });

  it('yellow for one low step', () => {
    expect(suggestStatus(facts({ steps: 1, stepHigh: 'no', ramp: 'none', doorWide: 'yes' }))).toMatchObject({
      status: 'yellow',
      reason: 'одна низкая ступень, до 7 см',
    });
  });

  it('yellow with a portable ramp, naming the steps', () => {
    expect(suggestStatus(facts({ steps: 2, ramp: 'portable_on_request', doorWide: 'yes' })).reason).toBe(
      '2 ступени, приставной пандус по просьбе',
    );
  });

  it('red for steps without a ramp', () => {
    expect(suggestStatus(facts({ steps: 5, stepHigh: 'yes', ramp: 'none', doorWide: 'yes' }))).toMatchObject({
      status: 'red',
      reason: '5 ступеней без пандуса',
    });
  });

  it('red for a narrow door even when step-free', () => {
    expect(suggestStatus(facts({ steps: 0, doorWide: 'no' })).status).toBe('red');
  });

  it('lists what is still unchecked', () => {
    expect(suggestStatus(facts({ steps: 1, ramp: 'none' })).unchecked).toEqual(['ширина двери', 'высота ступени']);
  });
});

describe('nextStep', () => {
  it('skips step height and ramp for a step-free entrance', () => {
    expect(nextStep('steps', facts({ steps: 0 }))).toBe('door');
  });

  it('asks step height and ramp when there are steps', () => {
    expect(nextStep('steps', facts({ steps: 2 }))).toBe('stepHigh');
    expect(nextStep('stepHigh', facts({ steps: 2 }))).toBe('ramp');
  });
});
