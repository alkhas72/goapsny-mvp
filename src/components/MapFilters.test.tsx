import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapFilters } from './MapFilters';

describe('MapFilters keyboard and apply', () => {
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

    const grayButton = screen.getByRole('button', { name: /На проверке/i });
    expect(grayButton.getAttribute('aria-pressed')).toBe('false');
    await user.click(grayButton);
    expect(onApplyStatus).toHaveBeenCalledWith('gray');
  });
});
