import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { List, MapPinPlus, SearchX } from 'lucide-react';
import { MapLibreMap } from './map/MapLibreMap';
import type { MapBounds } from './map/types';
import { AccessibleIconLogo, MapHeader } from './MapHeader';
import { MapFooter } from './MapFooter';
import { MapFilters } from './MapFilters';
import { MenuOverlay } from './MenuOverlay';
import { PlaceSheet, type PlaceSheetState } from './PlaceSheet';
import { EmailOtpSheet } from './EmailOtpSheet';
import { PublicAddSheet } from './PublicAddSheet';
import { PlaceListSheet, SearchResults } from './PlaceList';
import {
  EMPTY_FILTERS,
  boundsCenter,
  cameraNeedsPlace,
  countByStatus,
  emptyStateKind,
  placesInView,
  readPlaceParam,
  sortByDistance,
  syncPlaceParam,
  withoutStatus,
} from './PlaceListModel';
import './discovery.css';
import { MapperDay } from './mapper/MapperDay';
import { MapperFlow } from './mapper/MapperFlow';
import { readDay, type DayEntry } from './mapper/dayLog';
import {
  applyPlaceFilters,
  fetchPlaceById,
  fetchPublishedPlaces,
  publicPlaceFromSubmission,
  upsertPublicPlace,
  type PlaceFilters,
  type PublicPlace,
  type StatusFilter,
} from '../services/places';
import type { SubmitPublicPlaceResult } from '../services/submit-place';
import {
  getPublicSession,
  signOutPublicUser,
  subscribePublicSession,
} from '../services/publicAuth';
import { isSupabaseConfigured } from '../services/supabase';
import type { Place } from '../types';

const SEARCH_RESULTS_ID = 'dv-search-results';
/** How long a shared `?place=` link may still pull the camera to its place. */
const PLACE_LINK_CAMERA_MS = 10000;
const PLACE_LINK_CAMERA_TRIES = 2;
const PLACE_LINK_CAMERA_SETTLE_MS = 300;

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
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cabinetNote, setCabinetNote] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Mapper prototype (AISP-328): guided add flow with Нуца, behind ?mapper=1.
  const mapperEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mapper');
  const [mapperOpen, setMapperOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>(() => (mapperEnabled ? readDay() : []));
  const [flowKey, setFlowKey] = useState(0);
  const getCenterRef = useRef<(() => { lat: number; lng: number } | null) | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [pendingAddAfterAuth, setPendingAddAfterAuth] = useState(false);
  const [authSheetKey, setAuthSheetKey] = useState(0);
  const [addSheetKey, setAddSheetKey] = useState(0);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const listButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const firstResultRef = useRef<HTMLButtonElement | null>(null);
  const placeLinkHandledRef = useRef(false);
  const placeLinkCameraRef = useRef<{ placeId: string; until: number; tries: number } | null>(null);
  const [cameraNonce, setCameraNonce] = useState(0);
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

  const filteredPlaces = useMemo(() => applyPlaceFilters(places, filters), [places, filters]);
  // A new array makes the map fly to the selected place again (see handleBoundsChange).
  const visiblePlaces = useMemo(() => {
    void cameraNonce;
    return filteredPlaces.map(toMapPlace);
  }, [filteredPlaces, cameraNonce]);
  const mapCenter = useMemo(() => (bounds ? boundsCenter(bounds) : null), [bounds]);
  const placesInArea = useMemo(() => placesInView(filteredPlaces, bounds), [filteredPlaces, bounds]);
  const statusCounts = useMemo(
    () => countByStatus(placesInView(applyPlaceFilters(places, withoutStatus(filters)), bounds)),
    [places, filters, bounds],
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const place of placesInView(applyPlaceFilters(places, { ...filters, categories: [] }), bounds)) {
      counts[place.category] = (counts[place.category] ?? 0) + 1;
    }
    return counts;
  }, [places, filters, bounds]);
  const listPlaces = useMemo(
    () => (listOpen ? sortByDistance(placesInArea, mapCenter) : []),
    [listOpen, placesInArea, mapCenter],
  );
  const searchActive = searchOpen && filters.query.trim() !== '';
  const searchResults = useMemo(
    () => (searchActive ? sortByDistance(filteredPlaces, mapCenter) : []),
    [searchActive, filteredPlaces, mapCenter],
  );
  const emptyKind = emptyStateKind({
    loadState,
    boundsKnown: bounds !== null,
    inViewCount: placesInArea.length,
    filters,
  });

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
    syncPlaceParam(null);
    setSelectedPlaceId(null);
    setSheetPlace(null);
    setSheetState('idle');
    setSheetError(undefined);
  }, []);

  const openPlaceSheet = useCallback(async (placeId: string) => {
    syncPlaceParam(placeId);
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

  const placesRef = useRef(places);
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  useEffect(() => {
    placesRef.current = places;
    selectedPlaceIdRef.current = selectedPlaceId;
  }, [places, selectedPlaceId]);

  // A shared link `?place=<id>` opens that card as soon as the list is loaded.
  useEffect(() => {
    if (loadState !== 'ready' || placeLinkHandledRef.current) return;
    placeLinkHandledRef.current = true;
    const placeId = readPlaceParam(window.location.search);
    if (!placeId) return;
    placeLinkCameraRef.current = { placeId, until: Date.now() + PLACE_LINK_CAMERA_MS, tries: 0 };
    // The map may report its area before React commits the selection.
    selectedPlaceIdRef.current = placeId;
    void openPlaceSheet(placeId);
  }, [loadState, openPlaceSheet]);

  // The map frames the whole country when it finishes loading, which can
  // override the flight to a linked place. Once the camera has been still for
  // a moment away from the place, ask for the flight again.
  const cameraTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (cameraTimerRef.current !== null) window.clearTimeout(cameraTimerRef.current);
  }, []);
  const handleBoundsChange = useCallback((next: MapBounds) => {
    setBounds(next);
    if (cameraTimerRef.current !== null) {
      window.clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
    const pending = placeLinkCameraRef.current;
    if (!pending) return;
    const place = placesRef.current.find((item) => item.id === pending.placeId);
    if (
      !place ||
      selectedPlaceIdRef.current !== pending.placeId ||
      Date.now() > pending.until ||
      pending.tries >= PLACE_LINK_CAMERA_TRIES
    ) {
      placeLinkCameraRef.current = null;
      return;
    }
    if (!cameraNeedsPlace(place, next)) return;
    cameraTimerRef.current = window.setTimeout(() => {
      cameraTimerRef.current = null;
      if (placeLinkCameraRef.current !== pending || selectedPlaceIdRef.current !== pending.placeId) return;
      pending.tries += 1;
      setCameraNonce((value) => value + 1);
    }, PLACE_LINK_CAMERA_SETTLE_MS);
  }, []);

  const selectFromList = useCallback(
    (placeId: string) => {
      setListOpen(false);
      setSearchOpen(false);
      void openPlaceSheet(placeId);
    },
    [openPlaceSheet],
  );

  const closeList = useCallback(() => setListOpen(false), []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      if (firstResultRef.current) {
        event.preventDefault();
        firstResultRef.current.focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (searchActive) setSearchOpen(false);
      else setFilters((current) => ({ ...current, query: '' }));
    }
  };

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
    // Уже вошёл — сразу открываем форму: добавить место можно один раз,
    // и человек, зашедший в кабинет, приходит именно за этим.
    if (authEmail) {
      setAddSheetKey((key) => key + 1);
      setAddOpen(true);
      return;
    }
    // Вход ради самого входа никому не нужен: после подтверждения кода
    // ведём к форме, а не оставляем на карте без пути дальше.
    setPendingAddAfterAuth(true);
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
    async (result: SubmitPublicPlaceResult) => {
      setAddOpen(false);
      const immediatePlace = result.place ?? publicPlaceFromSubmission(result.snapshot);

      // Карта должна обновиться сразу: ждать полной перезагрузки списка нельзя.
      // Берём подтверждённые данные подачи (RPC-строка или снимок формы), не заглушки.
      setPlaces((current) => upsertPublicPlace(current, immediatePlace));

      try {
        await reloadPlaces();
      } catch {
        // DG-3: координаты и название — те, что человек только что отправил, не выдумка.
        setCabinetNote(
          'Место отправлено. Синхронизировать список сейчас не удалось — метка на карте по вашим данным.',
        );
      }

      syncPlaceParam(result.placeId);
      setSelectedPlaceId(result.placeId);
      setSheetPlace(immediatePlace);
      setSheetState('loading');
      setSheetError(undefined);
      try {
        const fresh = await fetchPlaceById(result.placeId);
        if (!fresh) {
          setSheetState('partial');
          return;
        }
        setSheetPlace(fresh);
        setPlaces((current) => upsertPublicPlace(current, fresh));
        setSheetState(fresh.facadePhotoError ? 'partial' : 'idle');
      } catch {
        setSheetState('partial');
      }
    },
    [reloadPlaces],
  );

  if (loadState === 'loading') {
    return (
      <div className="dv-splash" role="status">
        <span className="dv-splash-mark">
          <AccessibleIconLogo />
        </span>
        <span className="dv-splash-name">GoApsny</span>
        <span className="dv-splash-bar" aria-hidden="true" />
        <span className="dv-splash-text">Загрузка карты…</span>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="dv-splash dv-splash--error" role="alert">
        <span className="dv-splash-mark">
          <AccessibleIconLogo />
        </span>
        <p className="dv-splash-title">Не удалось загрузить карту</p>
        <p className="dv-splash-detail">{loadError}</p>
        <button
          type="button"
          className="dv-btn dv-btn--primary dv-splash-retry"
          onClick={() => setLoadAttempt((attempt) => attempt + 1)}
        >
          Повторить
        </button>
      </div>
    );
  }

  const otherLayerOpen = Boolean(selectedPlaceId) || addOpen || authOpen || mapperOpen || dayOpen || filtersOpen || menuOpen;
  const showListButton = !otherLayerOpen && !searchActive && placesInArea.length > 0;
  const showEmptyNotice = emptyKind !== 'none' && !otherLayerOpen && !listOpen && !searchActive;

  return (
    <div className="public-map-shell">
      <MapHeader
        onOpenMenu={() => {
          setMenuOpen((open) => !open);
          setFiltersOpen(false);
          setSearchOpen(false);
        }}
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        query={filters.query}
        onQueryChange={(query) => {
          setFilters((current) => ({ ...current, query }));
          setSearchOpen(true);
          setListOpen(false);
        }}
        onSearchFocus={() => {
          setSearchOpen(true);
          setMenuOpen(false);
        }}
        onSearchKeyDown={handleSearchKeyDown}
        searchInputRef={searchInputRef}
        searchResultsId={SEARCH_RESULTS_ID}
        searchResultsOpen={searchActive}
        onOpenFilters={() => {
          setFiltersOpen(true);
          setMenuOpen(false);
          setSearchOpen(false);
        }}
        filterButtonRef={filterButtonRef}
        categoryCount={filters.categories.length}
        onResetCategories={() => {
          setFilters((current) => ({ ...current, categories: [] }));
          filterButtonRef.current?.focus();
        }}
        status={filters.status}
        statusCounts={statusCounts}
        onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
      />

      <main className="public-map-main">
        <MapLibreMap
          places={visiblePlaces}
          selectedPlaceId={selectedPlaceId}
          theme={theme}
          onSelectPlace={(id) => void openPlaceSheet(id)}
          onClearSelection={closeSheet}
          useBrowserGeolocation
          onMarkerButton={handleMarkerButton}
          onCenterApi={(fn) => {
            getCenterRef.current = fn;
          }}
          onBoundsChange={handleBoundsChange}
        />
        {searchActive && (
          <>
            <div className="dv-search-scrim" aria-hidden="true" onClick={() => setSearchOpen(false)} />
            <SearchResults
              id={SEARCH_RESULTS_ID}
              query={filters.query}
              places={searchResults}
              onSelect={selectFromList}
              firstRowRef={firstResultRef}
              onBackToInput={() => searchInputRef.current?.focus()}
              onClose={closeSearch}
              onResetFilters={
                filters.categories.length > 0 || filters.status !== 'all'
                  ? () => setFilters((current) => ({ ...current, categories: [], status: 'all' }))
                  : undefined
              }
            />
          </>
        )}
        {showEmptyNotice && (
          <div className={`dv-empty dv-empty--${emptyKind}`} role="status">
            {emptyKind === 'filtered' ? (
              <>
                <SearchX size={20} aria-hidden />
                <span className="dv-empty-text">Нет мест по фильтру</span>
                <button type="button" className="dv-btn dv-btn--small" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Сбросить
                </button>
              </>
            ) : (
              <>
                <MapPinPlus size={20} aria-hidden />
                <span className="dv-empty-text">Здесь пока нет отметок — будьте первым</span>
                <button type="button" className="dv-btn dv-btn--small dv-btn--primary" onClick={beginAddFlow}>
                  Добавить место
                </button>
              </>
            )}
          </div>
        )}
        {showListButton && (
          <button
            ref={listButtonRef}
            type="button"
            className={`dv-list-pill${mapperEnabled ? ' dv-list-pill--raised' : ''}`}
            aria-haspopup="dialog"
            onClick={() => {
              setListOpen(true);
              setSearchOpen(false);
            }}
          >
            <List size={18} aria-hidden />
            <span>Списком</span>
            <span className="dv-list-pill-count">· {placesInArea.length}</span>
          </button>
        )}
        <PlaceListSheet
          open={listOpen}
          places={listPlaces}
          onSelect={selectFromList}
          onClose={closeList}
          returnFocusRef={listButtonRef}
        />
        {mapperEnabled && !mapperOpen && !dayOpen && (
          <div className="mapper-fab-row">
            <button type="button" className="mapper-day-btn" onClick={() => setDayOpen(true)}>
              Сегодня · {dayEntries.length}
            </button>
            <button type="button" className="mapper-fab" onClick={() => setMapperOpen(true)}>
              + Добавить объект
            </button>
          </div>
        )}
        {mapperEnabled && mapperOpen && (
          <MapperFlow
            key={`flow-${flowKey}`}
            theme={theme}
            getCenter={() => getCenterRef.current?.() ?? null}
            onAnother={() => setFlowKey((k) => k + 1)}
            onClose={() => setMapperOpen(false)}
            onSaved={setDayEntries}
            onOpenDay={() => {
              setMapperOpen(false);
              setDayOpen(true);
            }}
          />
        )}
        {mapperEnabled && dayOpen && <MapperDay entries={dayEntries} onClose={() => setDayOpen(false)} />}
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
          categoryCounts={categoryCounts}
          resultCount={placesInArea.length}
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
          // Префикс обязателен: оба счётчика стартуют с нуля, и без него
          // соседние листы получают одинаковый key=0 — React ругается
          // на дубль, а сброс состояния одного задевает другой.
          key={`auth-${authSheetKey}`}
          open={authOpen}
          onClose={() => {
            setAuthOpen(false);
            setPendingAddAfterAuth(false);
          }}
          onVerified={handleAuthVerified}
        />
        <PublicAddSheet
          key={`add-${addSheetKey}`}
          open={addOpen}
          theme={theme}
          onClose={() => setAddOpen(false)}
          onSubmitted={(result) => void handlePlaceSubmitted(result)}
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
