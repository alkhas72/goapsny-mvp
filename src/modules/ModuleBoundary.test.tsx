import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy } from 'react';
import { ModuleBoundary } from './ModuleBoundary';
import { isModuleOn, resetModulesForTests } from './registry';

function Broken(): never {
  throw new Error('модуль сломан');
}

describe('ModuleBoundary: сбой модуля не роняет основу', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    resetModulesForTests();
    vi.restoreAllMocks();
  });

  it('модуль упал в отрисовке: основа на месте, вместо модуля строка', () => {
    render(
      <div>
        <p>карта</p>
        <ModuleBoundary id="ramps" title="Заказать пандус">
          <Broken />
        </ModuleBoundary>
      </div>,
    );
    expect(screen.getByText('карта')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('«Заказать пандус» временно недоступен');
  });

  it('код модуля не загрузился: основа на месте', async () => {
    const Missing = lazy(() => Promise.reject(new Error('chunk не пришёл')));
    render(
      <div>
        <p>карта</p>
        <ModuleBoundary id="mapper" title="Добавить локацию">
          <Missing />
        </ModuleBoundary>
      </div>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('карта')).toBeTruthy();
  });

  it('два падения выключают модуль до конца сессии', () => {
    for (let i = 0; i < 2; i += 1) {
      render(
        <ModuleBoundary id="ramps" title="Заказать пандус">
          <Broken />
        </ModuleBoundary>,
      );
      cleanup();
    }
    expect(isModuleOn('ramps')).toBe(false);
    expect(isModuleOn('mapper')).toBe(true);
  });

  it('«Закрыть» сообщает основе', async () => {
    const onDismiss = vi.fn();
    render(
      <ModuleBoundary id="ramps" title="Заказать пандус" onDismiss={onDismiss}>
        <Broken />
      </ModuleBoundary>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
