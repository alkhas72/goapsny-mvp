import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    category: 'shop',
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
    onSelectPlace,
    onMarkerButton,
  }: {
    places: Array<{ id: string; name: string }>;
    onSelectPlace: (id: string) => void;
    onMarkerButton?: (id: string, button: HTMLButtonElement | null) => void;
  }) => (
    <div data-testid="mock-map">
      {places.map((place) => (
        <button
          key={place.id}
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

describe('PublicMap integration', () => {
  beforeEach(() => {
    vi.mocked(fetchPublishedPlaces).mockReset();
    vi.mocked(fetchPlaceById).mockReset();
  });

  it('loads published places and renders markers', async () => {
    vi.mocked(fetchPublishedPlaces).mockResolvedValue(mockPlaces);

    render(<PublicMap />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Кафе Серый' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Магазин Зелёный' })).toBeTruthy();
    });
  });

  it('shows configuration error when Supabase fetch fails', async () => {
    vi.mocked(fetchPublishedPlaces).mockRejectedValue(new Error('network down'));

    render(<PublicMap />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('network down')).toBeTruthy();
    });
  });

  it('filters visible markers by status', async () => {
    vi.mocked(fetchPublishedPlaces).mockResolvedValue(mockPlaces);
    const user = userEvent.setup();

    render(<PublicMap />);
    await screen.findByRole('button', { name: 'Кафе Серый' });

    await user.click(screen.getByRole('button', { name: /поиск и фильтр/i }));
    await user.click(screen.getByRole('button', { name: /На проверке/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Кафе Серый' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Магазин Зелёный' })).toBeNull();
    });
  });

  it('opens place sheet on marker selection with partial photo state', async () => {
    vi.mocked(fetchPublishedPlaces).mockResolvedValue(mockPlaces);
    vi.mocked(fetchPlaceById).mockResolvedValue({
      ...mockPlaces[1],
      facadePhotoUrl: null,
      facadePhotoError: true,
    });
    const user = userEvent.setup();

    render(<PublicMap />);
    await screen.findByRole('button', { name: 'Магазин Зелёный' });
    await user.click(screen.getByRole('button', { name: 'Магазин Зелёный' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Магазин Зелёный' })).toBeTruthy();
    });
  });

  it('closes filters and restores focus to filter trigger after apply', async () => {
    vi.mocked(fetchPublishedPlaces).mockResolvedValue(mockPlaces);
    const user = userEvent.setup();

    render(<PublicMap />);
    const filterTrigger = await screen.findByRole('button', { name: /поиск и фильтр/i });
    await user.click(filterTrigger);
    await user.click(screen.getByRole('button', { name: /На проверке/i }));

    await waitFor(() => {
      expect(filterTrigger).toBe(document.activeElement);
      expect(screen.queryByRole('button', { name: /закрыть фильтр/i })).toBeNull();
    });
  });
});
