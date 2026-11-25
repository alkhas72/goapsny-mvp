import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapViewControls } from './MapViewControls';
import { BASEMAP_PALETTES } from './goapsnyBasemap';

describe('MapViewControls: вид карты', () => {
  afterEach(cleanup);

  it('цветов карты два: светлый и более тёмный, среднего нет', async () => {
    const user = userEvent.setup();
    const onPalette = vi.fn();
    render(
      <MapViewControls palette="gray" preset="day" threeD={false} onPalette={onPalette} onPreset={vi.fn()} onThreeD={vi.fn()} />,
    );

    expect(BASEMAP_PALETTES).toEqual(['gray', 'violet']);
    const colours = within(screen.getByRole('group', { name: 'Цвет карты' })).getAllByRole('button');
    expect(colours.map((b) => b.getAttribute('aria-label'))).toEqual(['Серая карта', 'Сиреневая карта']);
    expect(screen.queryByRole('button', { name: 'Синяя карта' })).toBeNull();

    await user.click(colours[1]);
    expect(onPalette).toHaveBeenCalledWith('violet');
  });
});
