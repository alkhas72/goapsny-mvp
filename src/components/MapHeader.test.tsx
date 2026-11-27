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
    const [logo, search, menu] = screen.getAllByRole('button');
    expect(logo.getAttribute('aria-label')).toBe('GoApsny');
    expect(search.getAttribute('aria-label')).toBe('Поиск и фильтр');
    expect(menu.getAttribute('aria-label')).toBe('Меню');
    expect(search.className).toContain('icon-btn');

    await user.click(search);
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
    expect(onOpenMenu).not.toHaveBeenCalled();
  });

  it('знак слева один: название выезжает по нажатию', async () => {
    const user = userEvent.setup();
    setup();
    const logo = screen.getByRole('button', { name: 'GoApsny' });
    expect(logo.className).not.toContain('is-open');
    await user.click(logo);
    expect(logo.className).toContain('is-open');
    await user.click(logo);
    expect(logo.className).not.toContain('is-open');
  });

  it('когда поиск или фильтр что-то отбирают, на кнопке горит точка', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Поиск и фильтр' }).querySelector('.public-search-dot')).toBeTruthy();
    cleanup();
    setup(false);
    expect(screen.getByRole('button', { name: 'Поиск и фильтр' }).querySelector('.public-search-dot')).toBeNull();
  });
});
