import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeafletMap } from './LeafletMap';
import { MapHeader } from './MapHeader';
import { MapFooter } from './MapFooter';
import { MapFilters } from './MapFilters';
import { MenuOverlay } from './MenuOverlay';
import { PlaceSheet, type PlaceSheetState } from './PlaceSheet';
import {
  applyPlaceFilters,
  fetchPlaceById,
  fetchPublishedPlaces,
  type PlaceFilters,
  type PublicPlace,
  type StatusFilter,
} from '../services/places';
import { isSupabaseConfigured } from '../services/supabase';
import type { Place } from '../types';

function toMapPlace(place: PublicPlace): Place {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    lat: place.lat,
    lng: place.lng,
    status: place.status,
    stepsCount: place.stepsCount,
    stepHeightCm: place.stepHeightCm,
    rampType: place.rampType,
    doorWidthCm: place.doorWidthCm,
    entranceNotes: place.entranceNotes,
    toiletExists: place.toiletExists,
    toiletAccessible: place.toiletAccessible,
    parking: place.parking,
    comment: place.comment,
    osmTags: place.osmTags,
    moderationStatus: place.moderationStatus,
    source: place.source as Place['source'],
    createdBy: place.createdBy,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
    mainPhoto: place.facadePhotoUrl ?? undefined,
  };
}

export function PublicMap() {
  const [theme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const [places, setPlaces] = useState<PublicPlace[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [sheetPlace, setSheetPlace] = useState<PublicPlace | null>(null);
  const [sheetState, setSheetState] = useState<PlaceSheetState>('idle');
  const [sheetError, setSheetError] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PlaceFilters>({
    categories: [],
    status: 'all',
    query: '',
  });
  const [cabinetNote, setCabinetNote] = useState<string | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const markerButtonsRef = useRef<Record<string, HTMLButtonElement>>({});
  const activeMarkerRef = useRef<HTMLButtonElement | null>(null);
  const pendingMarkerFocusRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setLoadState('error');
          setLoadError('Нет конфигурации Supabase. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.');
        }
        return;
      }

      if (!cancelled) setLoadState('loading');
      try {
        const data = await fetchPublishedPlaces();
        if (!cancelled) {
          setPlaces(data);
          setLoadState('ready');
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState('error');
          setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить карту');
        }
      }
    }

    void loadPlaces();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const visiblePlaces = useMemo(
    () => applyPlaceFilters(places, filters).map(toMapPlace),
    [places, filters],
  );

  useEffect(() => {
    const placeId = pendingMarkerFocusRef.current;
    if (!placeId || selectedPlaceId !== null) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const marker = markerButtonsRef.current[placeId];
        if (!marker) return;
        pendingMarkerFocusRef.current = null;
        marker.focus();
      });
    });
  }, [selectedPlaceId, visiblePlaces]);

  const closeSheet = useCallback(() => {
    setSelectedPlaceId(null);
    setSheetPlace(null);
    setSheetState('idle');
    setSheetError(undefined);
  }, []);

  const openPlaceSheet = useCallback(async (placeId: string) => {
    setSelectedPlaceId(placeId);
    setSheetState('loading');
    setSheetError(undefined);
    const cached = places.find((item) => item.id === placeId) ?? null;
    setSheetPlace(cached);
    try {
      const fresh = await fetchPlaceById(placeId);
      if (!fresh) {
        setSheetState('error');
        setSheetError('Место не найдено или скрыто');
        return;
      }
      setSheetPlace(fresh);
      setSheetState(fresh.facadePhotoError ? 'partial' : 'idle');
    } catch (error) {
      if (cached) {
        setSheetPlace(cached);
        setSheetState('partial');
      } else {
        setSheetState('error');
        setSheetError(error instanceof Error ? error.message : 'Не удалось загрузить место');
      }
    }
  }, [places]);


  const handleMarkerButton = useCallback((placeId: string, button: HTMLButtonElement | null) => {
    if (button) {
      markerButtonsRef.current[placeId] = button;
    } else {
      delete markerButtonsRef.current[placeId];
    }
    if (placeId === selectedPlaceId) {
      activeMarkerRef.current = button;
    }
  }, [selectedPlaceId]);

  const handleApplyStatus = (status: StatusFilter) => {
    setFilters((current) => ({ ...current, status }));
    setFiltersOpen(false);
    filterButtonRef.current?.focus();
  };

  if (loadState === 'loading') {
    return (
      <div className="public-loading" role="status">
        Загрузка карты…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="public-error" role="alert">
        <p>{loadError}</p>
        <button type="button" className="primary-btn" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="public-map-shell">
      <MapHeader
        onOpenMenu={() => {
          setMenuOpen((open) => !open);
          setFiltersOpen(false);
        }}
        onOpenFilters={() => {
          setFiltersOpen(true);
          setMenuOpen(false);
        }}
        filterQuery={filters.query}
        onFilterQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        filterButtonRef={filterButtonRef}
      />

      <main className="public-map-main">
        <LeafletMap
          places={visiblePlaces}
          selectedPlaceId={selectedPlaceId}
          theme={theme}
          onSelectPlace={(id) => void openPlaceSheet(id)}
          onClearSelection={closeSheet}
          useBrowserGeolocation
          onMarkerButton={handleMarkerButton}
        />
        <MenuOverlay
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAddLocation={() => {
            setMenuOpen(false);
            setCabinetNote('Добавление локации — вход по email (T2, в разработке)');
          }}
          returnFocusRef={menuButtonRef}
        />
        <MapFilters
          open={filtersOpen}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          onApplyStatus={handleApplyStatus}
          returnFocusRef={filterButtonRef}
        />
        <PlaceSheet
          open={Boolean(selectedPlaceId)}
          place={sheetPlace}
          state={sheetState}
          errorMessage={sheetError}
          onClose={() => {
            pendingMarkerFocusRef.current = selectedPlaceId;
            closeSheet();
          }}
          onRetry={() => selectedPlaceId && void openPlaceSheet(selectedPlaceId)}
          returnFocusRef={activeMarkerRef}
        />
      </main>

      <MapFooter
        onCabinet={() => setCabinetNote('Кабинет — вход по email (T2, в разработке)')}
        onDisabledLink={(label) => setCabinetNote(`${label} — ссылка появится позже`)}
      />

      {cabinetNote && (
        <div className="public-toast" role="status">
          {cabinetNote}
          <button type="button" className="public-toast-close" onClick={() => setCabinetNote(null)}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
