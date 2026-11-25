import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapFilters } from './MapFilters';

describe('MapFilters keyboard and apply', () => {
  afterEach(cleanup);

  it('applies status and closes via handler', async () => {
    const user = userEvent.setup();
    const onApplyStatus = vi.fn();
    const onClose = vi.fn();

    render(
      <MapFilters
        open
        filters={{ categories: [], status: 'all', query: '' }}
        onChange={vi.fn()}
        onClose={onClose}
        onApplyStatus={onApplyStatus}
      />,
    );

    const grayButton = screen.getByRole('button', { name: /Ещё не оценено/i });
    expect(grayButton.getAttribute('aria-pressed')).toBe('false');
    await user.click(grayButton);
    expect(onApplyStatus).toHaveBeenCalledWith('gray');
  });

  it('открылся: строка поиска сразу готова к вводу', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MapFilters
        open
        filters={{ categories: [], status: 'all', query: '' }}
        onChange={onChange}
        onClose={vi.fn()}
        onApplyStatus={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(screen.getByLabelText('Поиск по улице или названию'));
    await user.keyboard('а');
    expect(onChange).toHaveBeenCalledWith({ categories: [], status: 'all', query: 'а' });
  });
});
