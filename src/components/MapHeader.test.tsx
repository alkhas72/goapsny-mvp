import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapHeader } from './MapHeader';

function setup(filterActive = false) {
  const onOpenFilters = vi.fn();
  const onOpenMenu = vi.fn();
  render(
    <MapHeader
      onOpenMenu={onOpenMenu}
      onOpenFilters={onOpenFilters}
      filterActive={filterActive}
      menuOpen={false}
      menuButtonRef={createRef<HTMLButtonElement>()}
      filterButtonRef={createRef<HTMLButtonElement>()}
    />,
  );
  return { onOpenFilters, onOpenMenu };
}

describe('MapHeader: поиск свёрнут в кнопку рядом с меню', () => {
  afterEach(cleanup);

  it('строки поиска на экране нет, поиск открывает круглая кнопка перед меню', async () => {
    const user = userEvent.setup();
    const { onOpenFilters, onOpenMenu } = setup();

    expect(screen.queryByText('Улица или название…')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    const [search, menu] = screen.getAllByRole('button');
    expect(search.getAttribute('aria-label')).toBe('Поиск и фильтр');
    expect(menu.getAttribute('aria-label')).toBe('Меню');
    expect(search.className).toContain('icon-btn');

    await user.click(search);
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  it('когда поиск или фильтр что-то отбирают, на кнопке горит точка', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Поиск и фильтр' }).querySelector('.public-search-dot')).toBeTruthy();
    cleanup();
    setup(false);
    expect(screen.getByRole('button', { name: 'Поиск и фильтр' }).querySelector('.public-search-dot')).toBeNull();
  });
});
