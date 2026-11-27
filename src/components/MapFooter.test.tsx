import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapFooter } from './MapFooter';

describe('MapFooter: вход в кабинет', () => {
  afterEach(cleanup);

  it('ничего не ждёт: кружка нет', () => {
    render(<MapFooter onCabinet={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Кабинет' }).querySelector('.footer-badge')).toBeNull();
  });

  it('что-то ждёт: у входа в кабинет кружок с числом', async () => {
    const user = userEvent.setup();
    const onCabinet = vi.fn();
    render(<MapFooter onCabinet={onCabinet} waiting={2} />);

    const cabinet = screen.getByRole('button', { name: 'Кабинет, ждут: 2' });
    expect(cabinet.querySelector('.footer-badge')?.textContent).toBe('2');
    await user.click(cabinet);
    expect(onCabinet).toHaveBeenCalledTimes(1);
  });

  it('внешних ссылок на карте нет: они живут в меню', () => {
    render(<MapFooter onCabinet={vi.fn()} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('большое число не ломает кружок', () => {
    render(<MapFooter onCabinet={vi.fn()} waiting={140} />);
    expect(screen.getByRole('button', { name: 'Кабинет, ждут: 140' }).textContent).toContain('99+');
  });
});
