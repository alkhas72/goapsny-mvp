import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeafletMap } from './LeafletMap';
import { MapHeader } from './MapHeader';
import { MapFooter } from './MapFooter';
import { MapFilters } from './MapFilters';
import { MenuOverlay } from './MenuOverlay';
import { PlaceSheet, type PlaceSheetState } from './PlaceSheet';
import { EmailOtpSheet } from './EmailOtpSheet';
import { PublicAddSheet } from './PublicAddSheet';
import {
  applyPlaceFilters,
  fetchPlaceById,
  fetchPublishedPlaces,
  type PlaceFilters,
  type PublicPlace,
  type StatusFilter,
} from '../services/places';
import {
  getPublicSession,
  maskEmailDomain,
  signOutPublicUser,
  subscribePublicSession,
} from '../services/publicAuth';
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
  const [authOpen, setAuthOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [pendingAddAfterAuth, setPendingAddAfterAuth] = useState(false);
  const [authSheetKey, setAuthSheetKey] = useState(0);
  const [addSheetKey, setAddSheetKey] = useState(0);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const markerButtonsRef = useRef<Record<string, HTMLButtonElement>>({});
  const pendingMarkerFocusRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void getPublicSession().then((session) => {
      if (!cancelled) {
        setAuthEmail(session?.user.email ?? null);
      }
    });
    const unsubscribe = subscribePublicSession((session) => {
      setAuthEmail(session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const reloadPlaces = useCallback(async () => {
    const data = await fetchPublishedPlaces();
    setPlaces(data);
    setLoadState('ready');
    setLoadError(null);
  }, []);

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
  }, []);

  const handleApplyStatus = (status: StatusFilter) => {
    setFilters((current) => ({ ...current, status }));
    setFiltersOpen(false);
    filterButtonRef.current?.focus();
  };

  const beginAddFlow = useCallback(() => {
    if (authEmail) {
      setAddSheetKey((key) => key + 1);
      setAddOpen(true);
      return;
    }
    setPendingAddAfterAuth(true);
    setAuthSheetKey((key) => key + 1);
    setAuthOpen(true);
  }, [authEmail]);

  const handleCabinet = useCallback(() => {
    if (authEmail) {
      setCabinetNote(`Вход выполнен: ${maskEmailDomain(authEmail)}. Можно добавить одно место.`);
      return;
    }
    setPendingAddAfterAuth(false);
    setAuthSheetKey((key) => key + 1);
    setAuthOpen(true);
  }, [authEmail]);

  const handleAuthVerified = useCallback(() => {
    setAuthOpen(false);
    if (pendingAddAfterAuth) {
      setPendingAddAfterAuth(false);
      setAddSheetKey((key) => key + 1);
      setAddOpen(true);
    }
  }, [pendingAddAfterAuth]);

  const handlePlaceSubmitted = useCallback(
    async (placeId: string) => {
      setAddOpen(false);
      try {
        await reloadPlaces();
      } catch {
        // DG-3: не подставляем выдуманные данные вместо серверных. Запись прошла,
        // но список не обновился — говорим об этом прямо. Прежняя версия рисовала
        // метку с чужим названием и координатами 43,41, из-за чего человек видел
        // свою точку не там, где ставил, и считал это нормой.
        setCabinetNote(
          'Место отправлено. Обновить список сейчас не удалось — перезагрузите страницу, чтобы увидеть метку.',
        );
      }
      void openPlaceSheet(placeId);
    },
    [openPlaceSheet, reloadPlaces],
  );

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
            beginAddFlow();
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
        />
        <EmailOtpSheet
          key={authSheetKey}
          open={authOpen}
          onClose={() => {
            setAuthOpen(false);
            setPendingAddAfterAuth(false);
          }}
          onVerified={handleAuthVerified}
        />
        <PublicAddSheet
          key={addSheetKey}
          open={addOpen}
          theme={theme}
          onClose={() => setAddOpen(false)}
          onSubmitted={(placeId) => void handlePlaceSubmitted(placeId)}
        />
      </main>

      <MapFooter
        onCabinet={handleCabinet}
        onDisabledLink={(label) => setCabinetNote(`${label} — ссылка появится позже`)}
      />

      {cabinetNote && (
        <div className="public-toast" role="status">
          {cabinetNote}
          {authEmail && (
            <button
              type="button"
              className="public-toast-close"
              onClick={() => void signOutPublicUser().then(() => setCabinetNote(null))}
            >
              Выйти
            </button>
          )}
          <button type="button" className="public-toast-close" onClick={() => setCabinetNote(null)}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
