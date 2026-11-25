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

  it('«Туалетов» среди групп нет, есть переключатель доступного туалета', async () => {
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
    expect(screen.queryByRole('button', { name: 'Туалеты' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Есть доступный туалет' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accessibleToilet: true }));
  });

  it('выбранная группа раскрывается в типы OpenStreetMap', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MapFilters
        open
        filters={{ categories: [], status: 'all', query: '' }}
        onChange={onChange}
        onClose={vi.fn()}
        onApplyStatus={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Аптека' })).toBeNull();

    rerender(
      <MapFilters
        open
        filters={{ categories: ['health'], types: [], status: 'all', query: '' }}
        onChange={onChange}
        onClose={vi.fn()}
        onApplyStatus={vi.fn()}
      />,
    );
    const types = screen.getByRole('group', { name: 'Здоровье: что именно' });
    expect(types.textContent).toContain('Поликлиника');
    expect(types.textContent).toContain('Больница');
    await user.click(screen.getByRole('button', { name: 'Аптека' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categories: ['health'], types: ['pharmacy'] }));
  });

  it('смена группы сбрасывает выбранные типы', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MapFilters
        open
        filters={{ categories: ['health'], types: ['pharmacy'], status: 'all', query: '' }}
        onChange={onChange}
        onClose={vi.fn()}
        onApplyStatus={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Магазины/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categories: ['health', 'shops'], types: [] }));
  });
});
