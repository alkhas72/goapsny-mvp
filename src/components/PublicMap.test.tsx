import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicMap } from './PublicMap';
import type { PublicPlace } from '../services/places';

const mockPlaces: PublicPlace[] = [
  {
    id: 'place-gray',
    name: 'Кафе Серый',
    category: 'food',
    lat: 43.0015,
    lng: 41.0232,
    status: 'gray',
    stepsCount: null,
    stepHeightCm: null,
    rampType: 'none',
    doorWidthCm: null,
    entranceNotes: null,
    toiletExists: 'unknown',
    toiletAccessible: 'unknown',
    parking: 'unknown',
    comment: null,
    osmTags: {},
    details: { schema_version: 1, address: 'ул. Ленина 1' },
    moderationStatus: 'published',
    source: 'public',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    facadePhotoUrl: 'https://example.com/gray.jpg',
  },
  {
    id: 'place-green',
    name: 'Магазин Зелёный',
    category: 'food',
    lat: 43.002,
    lng: 41.024,
    status: 'green',
    stepsCount: 0,
    stepHeightCm: null,
    rampType: 'permanent',
    doorWidthCm: 90,
    entranceNotes: null,
    toiletExists: 'yes',
    toiletAccessible: 'yes',
    parking: 'yes',
    comment: null,
    osmTags: {},
    details: { schema_version: 1, address: 'ул. Пушкина 2' },
    moderationStatus: 'published',
    source: 'public',
    createdBy: null,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    facadePhotoUrl: null,
    facadePhotoError: true,
  },
];

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock('../services/publicAuth', () => ({
  getPublicSession: vi.fn().mockResolvedValue(null),
  subscribePublicSession: vi.fn(() => () => undefined),
  maskEmailDomain: (email: string) => email,
  signOutPublicUser: vi.fn().mockResolvedValue(undefined),
  requestEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
  isValidEmail: (email: string) => email.includes('@'),
  isValidOtpCode: (code: string) => /^\d{8}$/.test(code),
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  otpResendRemainingMs: () => 0,
  OTP_RESEND_COOLDOWN_MS: 60_000,
}));

vi.mock('./EmailOtpSheet', () => ({
  EmailOtpSheet: ({
    open,
    onVerified,
  }: {
    open: boolean;
    onVerified: () => void;
  }) =>
    open ? (
      <button type="button" onClick={onVerified}>
        Mock verify OTP
      </button>
    ) : null,
}));

vi.mock('./PublicAddSheet', () => ({
  PublicAddSheet: ({
    open,
    onSubmitted,
  }: {
    open: boolean;
    onSubmitted: (result: {
      placeId: string;
      storagePath: string;
      snapshot: { placeId: string; name: string; category: string; lat: number; lng: number };
    }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onSubmitted({
            placeId: 'new-gray-place',
            storagePath: 'new-gray-place/facade.jpg',
            snapshot: {
              placeId: 'new-gray-place',
              name: 'Новая серая метка',
              category: 'food',
              lat: 43.05,
              lng: 41.05,
            },
          })
        }
      >
        Mock publish gray pin
      </button>
    ) : null,
}));

vi.mock('../services/places', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/places')>();
  return {
    ...actual,
    fetchPublishedPlaces: vi.fn(),
    fetchPlaceById: vi.fn(),
  };
});

// The visible area the mock map reports; null means the map never reports one.
const WHOLE_WORLD = { west: -180, south: -85, east: 180, north: 85 };
let mockBounds: { west: number; south: number; east: number; north: number } | null = WHOLE_WORLD;

vi.mock('./map/MapLibreMap', async () => {
  const { useEffect } = await import('react');
  return {
  MapLibreMap: ({
    places,
    selectedPlaceId,
    onSelectPlace,
    onMarkerButton,
    onBoundsChange,
  }: {
    places: Array<{ id: string; name: string }>;
    selectedPlaceId: string | null;
    onSelectPlace: (id: string) => void;
    onMarkerButton?: (id: string, button: HTMLButtonElement | null) => void;
    onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- mock component body
    useEffect(() => {
      if (mockBounds) onBoundsChange?.(mockBounds);
    }, [onBoundsChange]);
    return (
    <div data-testid="mock-map">
      {places.map((place) => (
        <button
          key={`${place.id}-${place.id === selectedPlaceId ? 'selected' : 'idle'}`}
          type="button"
          aria-label={place.name}
          onClick={() => onSelectPlace(place.id)}
          ref={(el) => onMarkerButton?.(place.id, el)}
        >
          {place.name}
        </button>
      ))}
    </div>
    );
  },
  };
});

import { fetchPlaceById, fetchPublishedPlaces } from '../services/places';

async function renderLoadedMap() {
  vi.mocked(fetchPublishedPlaces).mockResolvedValueOnce(mockPlaces);
  render(<PublicMap />);
  await screen.findByRole('button', { name: 'Кафе Серый' });
}

function filterTriggerButton() {
  return screen.getByRole('button', { name: /^Категории/ });
}

describe('PublicMap integration', () => {
  beforeEach(() => {
    vi.mocked(fetchPublishedPlaces).mockReset();
    vi.mocked(fetchPlaceById).mockReset();
    vi.mocked(fetchPublishedPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(fetchPlaceById).mockImplementation(async (id) => mockPlaces.find((p) => p.id === id) ?? null);
  });

  afterEach(() => {
    cleanup();
    mockBounds = WHOLE_WORLD;
    window.history.replaceState(null, '', '/');
  });

  it('loads published places and renders markers', async () => {
    await renderLoadedMap();
    expect(screen.getByRole('button', { name: 'Магазин Зелёный' })).toBeTruthy();
  });

  it('shows configuration error when Supabase fetch fails', async () => {
    vi.mocked(fetchPublishedPlaces).mockReset();
    vi.mocked(fetchPublishedPlaces).mockRejectedValueOnce(new Error('network down'));

    render(<PublicMap />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('network down')).toBeTruthy();
    });
  });

  it('recovers from load error when retry is activated', async () => {
    vi.mocked(fetchPublishedPlaces)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(mockPlaces);
    const user = userEvent.setup();

    render(<PublicMap />);
    await screen.findByText('network down');
    await user.click(screen.getByRole('button', { name: /повторить/i }));
    await screen.findByRole('button', { name: 'Кафе Серый' });
  });

  it('filters visible markers by status', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();

    await user.click(filterTriggerButton());
    await user.click(screen.getByRole('button', { name: /Ещё не оценено/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Кафе Серый' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Магазин Зелёный' })).toBeNull();
    });
  });

  it('opens place sheet on marker selection with partial photo state', async () => {
    vi.mocked(fetchPlaceById).mockResolvedValueOnce({
      ...mockPlaces[1],
      facadePhotoUrl: null,
      facadePhotoError: true,
    });
    const user = userEvent.setup();

    await renderLoadedMap();
    await user.click(screen.getByRole('button', { name: 'Магазин Зелёный' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Магазин Зелёный' })).toBeTruthy();
      expect(screen.getByText('Фото недоступно')).toBeTruthy();
    });
  });

  it('recovers place sheet from error on retry', async () => {
    vi.mocked(fetchPlaceById)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockPlaces[0]);
    const user = userEvent.setup();

    await renderLoadedMap();
    await user.click(screen.getByRole('button', { name: 'Кафе Серый' }));
    await screen.findByText('Место не найдено или скрыто');
    await user.click(screen.getByRole('button', { name: /повторить/i }));
    await screen.findByRole('dialog', { name: 'Кафе Серый' });
  });

  it('closes filters and restores focus to filter trigger after apply', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();

    const filterTrigger = filterTriggerButton();
    await user.click(filterTrigger);
    await user.click(screen.getByRole('button', { name: /Ещё не оценено/i }));

    await waitFor(() => {
      expect(filterTrigger).toBe(document.activeElement);
      expect(screen.queryByRole('button', { name: /закрыть фильтр/i })).toBeNull();
    });
  });

  it('returns focus to remounted marker when place sheet closes', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();
    await user.click(screen.getByRole('button', { name: 'Кафе Серый' }));
    await screen.findByRole('dialog', { name: 'Кафе Серый' });
    await user.click(screen.getByRole('button', { name: /закрыть карточку/i }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const currentMarker = screen.getByRole('button', { name: 'Кафе Серый' });
    await waitFor(() => {
      expect(currentMarker).toBe(document.activeElement);
    });
  });

  // Вход через «Кабинет» — путь, которым человек идёт, не найдя кнопку
  // добавления в меню. Раньше он упирался в тупик: код принят, а формы нет.
  it('leads from cabinet login straight to the add form', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();

    await user.click(screen.getByRole('button', { name: /кабинет/i }));
    // Сначала подтверждение почты.
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));
    // И сразу форма — вход ради самого входа никому не нужен.
    expect(await screen.findByRole('button', { name: 'Mock publish gray pin' })).toBeTruthy();
  });

  it('opens OTP auth when adding a location without a session', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();
    await user.click(screen.getByRole('button', { name: /меню/i }));
    await user.click(screen.getByRole('button', { name: /добавить локацию/i }));
    expect(screen.getByRole('button', { name: 'Mock verify OTP' })).toBeTruthy();
  });

  it('opens add sheet after OTP verification', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();
    await user.click(screen.getByRole('button', { name: /меню/i }));
    await user.click(screen.getByRole('button', { name: /добавить локацию/i }));
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));
    expect(screen.getByRole('button', { name: 'Mock publish gray pin' })).toBeTruthy();
  });

  it('reloads places after a successful submit and renders the new gray marker', async () => {
    const newGrayPlace: PublicPlace = {
      id: 'new-gray-place',
      name: 'Новая серая метка',
      category: 'food',
      lat: 43.05,
      lng: 41.05,
      status: 'gray',
      stepsCount: null,
      stepHeightCm: null,
      rampType: 'none',
      doorWidthCm: null,
      entranceNotes: null,
      toiletExists: 'unknown',
      toiletAccessible: 'unknown',
      parking: 'unknown',
      comment: null,
      osmTags: {},
      details: { schema_version: 1 },
      moderationStatus: 'published',
      source: 'public',
      createdBy: null,
      createdAt: '2026-07-16T00:00:00Z',
      updatedAt: '2026-07-16T00:00:00Z',
      facadePhotoUrl: null,
    };

    const user = userEvent.setup();
    await renderLoadedMap();

    // The reload after submit returns the existing places plus the new gray pin.
    vi.mocked(fetchPublishedPlaces).mockResolvedValueOnce([...mockPlaces, newGrayPlace]);

    await user.click(screen.getByRole('button', { name: /меню/i }));
    await user.click(screen.getByRole('button', { name: /добавить локацию/i }));
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));

    const callsBefore = vi.mocked(fetchPublishedPlaces).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Mock publish gray pin' }));

    // 1) The map reloaded (fetchPublishedPlaces called again after submit)...
    await waitFor(() => {
      expect(vi.mocked(fetchPublishedPlaces).mock.calls.length).toBeGreaterThan(callsBefore);
    });
    // 2) ...and the new gray place is now in the visible marker list.
    await screen.findByRole('button', { name: 'Новая серая метка' });
    expect(screen.getByRole('button', { name: 'Новая серая метка' })).toBeTruthy();
  });

  it('shows the submitted gray marker immediately before the list reload finishes', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();

    let resolveReload: ((value: PublicPlace[]) => void) | undefined;
    const reloadPromise = new Promise<PublicPlace[]>((resolve) => {
      resolveReload = resolve;
    });
    vi.mocked(fetchPublishedPlaces).mockReturnValueOnce(reloadPromise);

    await user.click(screen.getByRole('button', { name: /меню/i }));
    await user.click(screen.getByRole('button', { name: /добавить локацию/i }));
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));
    await user.click(screen.getByRole('button', { name: 'Mock publish gray pin' }));

    await screen.findByRole('button', { name: 'Новая серая метка' });
    resolveReload?.([...mockPlaces, {
      id: 'new-gray-place',
      name: 'Новая серая метка',
      category: 'food',
      lat: 43.05,
      lng: 41.05,
      status: 'gray',
      stepsCount: null,
      stepHeightCm: null,
      rampType: 'none',
      doorWidthCm: null,
      entranceNotes: null,
      toiletExists: 'unknown',
      toiletAccessible: 'unknown',
      parking: 'unknown',
      comment: null,
      osmTags: {},
      details: { schema_version: 1 },
      moderationStatus: 'published',
      source: 'public',
      createdBy: null,
      createdAt: '2026-07-16T00:00:00Z',
      updatedAt: '2026-07-16T00:00:00Z',
      facadePhotoUrl: null,
    }]);
    await waitFor(() => {
      expect(vi.mocked(fetchPublishedPlaces).mock.calls.length).toBeGreaterThan(1);
    });
  });

  // DG-3: при сбое сервера показываем правду, а не выдуманные данные.
  it('keeps the submitted marker with real form data when reload after submit fails', async () => {
    const user = userEvent.setup();
    await renderLoadedMap();

    // Запись прошла, но перезагрузка списка не удалась.
    vi.mocked(fetchPublishedPlaces).mockRejectedValueOnce(new Error('network down'));

    await user.click(screen.getByRole('button', { name: /меню/i }));
    await user.click(screen.getByRole('button', { name: /добавить локацию/i }));
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));

    const callsBefore = vi.mocked(fetchPublishedPlaces).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Mock publish gray pin' }));

    await waitFor(() => {
      expect(vi.mocked(fetchPublishedPlaces).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    // Метка с реальными данными формы остаётся видимой; выдуманных координат нет.
    expect(screen.getByRole('button', { name: 'Новая серая метка' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Новое место' })).toBeNull();
    for (const place of mockPlaces) {
      expect(screen.getByRole('button', { name: place.name })).toBeTruthy();
    }
  });
  describe('discovery', () => {
    it('shows status chips with counts and toggles a status with one tap', async () => {
      const user = userEvent.setup();
      await renderLoadedMap();

      const all = screen.getByRole('button', { name: /^Все\s*2$/ });
      const green = screen.getByRole('button', { name: /^Доступно\s*1$/ });
      expect(all.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: /^Не оценено\s*1$/ })).toBeTruthy();

      await user.click(green);
      expect(green.getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByRole('button', { name: 'Кафе Серый' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Магазин Зелёный' })).toBeTruthy();

      await user.click(green);
      expect(screen.getByRole('button', { name: /^Все/ }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Кафе Серый' })).toBeTruthy();
    });

    it('counts and lists only places inside the visible area', async () => {
      // Only the green place (43.002, 41.024) is inside.
      mockBounds = { west: 41.0236, south: 43.0018, east: 41.0300, north: 43.0100 };
      const user = userEvent.setup();
      await renderLoadedMap();

      await user.click(screen.getByRole('button', { name: /Списком\s*·\s*1/ }));
      const dialog = screen.getByRole('dialog', { name: 'Места на карте' });
      const rows = within(dialog).getAllByRole('button').filter((button) => button.className.includes('dv-row'));
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('Магазин Зелёный');
      expect(rows[0].textContent).toContain('Еда и напитки');
      expect(rows[0].textContent).toContain('Доступно');
      expect(rows[0].textContent).toContain('Нет ступеней');
    });

    it('sorts the list by distance from the map centre and opens the card from a row', async () => {
      // Centre is right on the green place.
      mockBounds = { west: 41.014, south: 42.992, east: 41.034, north: 43.012 };
      const user = userEvent.setup();
      await renderLoadedMap();

      const pill = screen.getByRole('button', { name: /Списком\s*·\s*2/ });
      await user.click(pill);
      const dialog = screen.getByRole('dialog', { name: 'Места на карте' });
      const rows = within(dialog).getAllByRole('button').filter((button) => button.className.includes('dv-row'));
      expect(rows.map((row) => row.querySelector('.dv-row-name')?.textContent)).toEqual([
        'Магазин Зелёный',
        'Кафе Серый',
      ]);

      await user.click(rows[1]);
      expect(screen.queryByRole('dialog', { name: 'Места на карте' })).toBeNull();
      await screen.findByRole('dialog', { name: 'Кафе Серый' });
      expect(new URLSearchParams(window.location.search).get('place')).toBe('place-gray');
    });

    it('closes the list with Escape and returns focus to the list button', async () => {
      const user = userEvent.setup();
      await renderLoadedMap();
      const pill = screen.getByRole('button', { name: /Списком/ });
      await user.click(pill);
      expect(screen.getByRole('dialog', { name: 'Места на карте' })).toBeTruthy();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Места на карте' })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Списком/ }));
    });

    it('invites to add the first place when the visible area is empty', async () => {
      mockBounds = { west: 40, south: 42, east: 40.1, north: 42.1 };
      const user = userEvent.setup();
      await renderLoadedMap();

      expect(screen.getByText('Здесь пока нет отметок — будьте первым')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Списком/ })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Добавить место' }));
      expect(screen.getByRole('button', { name: 'Mock verify OTP' })).toBeTruthy();
    });

    it('offers to reset the filter when nothing in the area matches it', async () => {
      const user = userEvent.setup();
      await renderLoadedMap();

      await user.click(screen.getByRole('button', { name: /^Недоступно/ }));
      expect(screen.getByText('Нет мест по фильтру')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Сбросить' }));
      expect(screen.queryByText('Нет мест по фильтру')).toBeNull();
      expect(screen.getByRole('button', { name: 'Кафе Серый' })).toBeTruthy();
    });

    it('shows no empty notice while the map has not reported its area', async () => {
      mockBounds = null;
      const user = userEvent.setup();
      await renderLoadedMap();
      await user.click(screen.getByRole('button', { name: /^Недоступно/ }));
      expect(screen.queryByText('Нет мест по фильтру')).toBeNull();
    });

    it('lists search matches under the search bar and says when nothing is found', async () => {
      const user = userEvent.setup();
      await renderLoadedMap();

      const input = screen.getByRole('searchbox', { name: 'Поиск мест' });
      await user.type(input, 'Пушкина');
      const results = screen.getByRole('region', { name: 'Результаты поиска' });
      expect(within(results).getByText('Магазин Зелёный')).toBeTruthy();
      expect(within(results).queryByText('Кафе Серый')).toBeNull();

      await user.keyboard('{ArrowDown}');
      expect(document.activeElement?.textContent).toContain('Магазин Зелёный');
      await user.keyboard('{Enter}');
      await screen.findByRole('dialog', { name: 'Магазин Зелёный' });
      expect(screen.queryByRole('region', { name: 'Результаты поиска' })).toBeNull();
    });

    it('says «Ничего не найдено» for a query without matches', async () => {
      const user = userEvent.setup();
      await renderLoadedMap();
      await user.type(screen.getByRole('searchbox', { name: 'Поиск мест' }), 'кинотеатр');
      expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    });

    it('opens the card from ?place= and keeps other parameters when it closes', async () => {
      window.history.replaceState(null, '', '/?lang=ru&place=place-green');
      const user = userEvent.setup();
      vi.mocked(fetchPublishedPlaces).mockResolvedValueOnce(mockPlaces);
      render(<PublicMap />);

      await screen.findByRole('dialog', { name: 'Магазин Зелёный' });
      await user.click(screen.getByRole('button', { name: /закрыть карточку/i }));
      expect(window.location.search).toBe('?lang=ru');
    });

    it('writes ?place= when a card opens from a marker', async () => {
      window.history.replaceState(null, '', '/?mapper_off=1');
      const user = userEvent.setup();
      await renderLoadedMap();
      await user.click(screen.getByRole('button', { name: 'Кафе Серый' }));
      await screen.findByRole('dialog', { name: 'Кафе Серый' });
      const params = new URLSearchParams(window.location.search);
      expect(params.get('place')).toBe('place-gray');
      expect(params.get('mapper_off')).toBe('1');
    });
  });
});
