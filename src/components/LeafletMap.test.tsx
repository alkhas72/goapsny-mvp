import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const leafletMocks = vi.hoisted(() => {
  const map = {
    invalidateSize: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    removeLayer: vi.fn(),
    setView: vi.fn(),
  };
  const userMarker = {
    addTo: vi.fn(),
  };
  userMarker.addTo.mockReturnValue(userMarker);

  return {
    map,
    userMarker,
    marker: vi.fn(() => userMarker),
  };
});

vi.mock('leaflet', () => ({
  default: {
    control: {
      attribution: () => ({ addTo: vi.fn() }),
      zoom: () => ({ addTo: vi.fn() }),
    },
    divIcon: vi.fn(() => ({})),
    layerGroup: () => ({ addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() }),
    map: () => leafletMocks.map,
    marker: leafletMocks.marker,
    tileLayer: () => ({ addTo: vi.fn().mockReturnThis() }),
  },
}));

const { getBrowserLocation } = vi.hoisted(() => ({
  getBrowserLocation: vi.fn(),
}));

vi.mock('../utils/location', () => ({ getBrowserLocation }));

import { LeafletMap } from './LeafletMap';

describe('LeafletMap user location control', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    leafletMocks.map.removeLayer.mockClear();
    leafletMocks.map.setView.mockClear();
    leafletMocks.marker.mockClear();
    getBrowserLocation.mockReset();
    getBrowserLocation.mockResolvedValue({ lat: 43.0033, lng: 41.0237 });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // Поведение изменено 20.07 по решению Арбитра: точка показывается сразу
  // при открытии карты — её человек ищет первым делом. Поэтому первый клик
  // теперь СКРЫВАЕТ метку, а не показывает.
  it('shows the user pin automatically on mount, then toggles it off and on', async () => {
    const user = userEvent.setup();
    render(
      <LeafletMap
        places={[]}
        selectedPlaceId={null}
        theme="light"
        useBrowserGeolocation
      />,
    );

    // Автопоказ: метка появилась без единого действия пользователя.
    const hideButton = await screen.findByRole('button', { name: 'Скрыть моё местоположение' });
    expect(hideButton.getAttribute('aria-pressed')).toBe('true');
    expect(getBrowserLocation).toHaveBeenCalledTimes(1);
    expect(leafletMocks.marker).toHaveBeenCalledWith(
      [43.0033, 41.0237],
      expect.objectContaining({ interactive: false }),
    );

    // Скрыть.
    await user.click(hideButton);
    const showButton = await screen.findByRole('button', {
      name: 'Показать моё местоположение',
    });
    expect(showButton.getAttribute('aria-pressed')).toBe('false');
    expect(leafletMocks.map.removeLayer).toHaveBeenCalledWith(leafletMocks.userMarker);

    // И вернуть обратно — кнопка остаётся рабочей в обе стороны.
    await user.click(showButton);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Скрыть моё местоположение' })).toBeTruthy();
    });
    expect(getBrowserLocation).toHaveBeenCalledTimes(2);
  });
});
