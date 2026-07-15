import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../services/places', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/places')>();
  return {
    ...actual,
    fetchPublishedPlaces: vi.fn(),
    fetchPlaceById: vi.fn(),
  };
});

vi.mock('./LeafletMap', () => ({
  LeafletMap: ({
    places,
    selectedPlaceId,
    onSelectPlace,
    onMarkerButton,
  }: {
    places: Array<{ id: string; name: string }>;
    selectedPlaceId: string | null;
    onSelectPlace: (id: string) => void;
    onMarkerButton?: (id: string, button: HTMLButtonElement | null) => void;
  }) => (
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
  ),
}));

import { fetchPlaceById, fetchPublishedPlaces } from '../services/places';

async function renderLoadedMap() {
  vi.mocked(fetchPublishedPlaces).mockResolvedValueOnce(mockPlaces);
  render(<PublicMap />);
  await screen.findByRole('button', { name: 'Кафе Серый' });
}

function filterTriggerButton() {
  return screen.getByRole('button', { name: 'Поиск и фильтр' });
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
    await user.click(screen.getByRole('button', { name: /На проверке/i }));

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
    await user.click(screen.getByRole('button', { name: /На проверке/i }));

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
});
