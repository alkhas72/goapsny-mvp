import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapFooter } from './MapFooter';

describe('MapFooter', () => {
  afterEach(cleanup);

  it('shows the cabinet as the one working button', async () => {
    const user = userEvent.setup();
    const onCabinet = vi.fn();
    render(<MapFooter onCabinet={onCabinet} onDisabledLink={vi.fn()} />);

    const cabinet = screen.getByRole('button', { name: 'Кабинет' });
    await user.click(cabinet);
    expect(onCabinet).toHaveBeenCalledTimes(1);
  });

  it('draws no dead buttons for links that have no address yet', () => {
    render(<MapFooter onCabinet={vi.fn()} onDisabledLink={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Instagram')).toBeNull();
    expect(screen.queryByText('Telegram')).toBeNull();
    expect(screen.queryByText('Сайт')).toBeNull();
    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });
});
