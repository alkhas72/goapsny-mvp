import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapLibreMap } from './map/MapLibreMap';
import { MapHeader } from './MapHeader';
import { MapFooter } from './MapFooter';
import { MapFilters } from './MapFilters';
import { MenuOverlay } from './MenuOverlay';
import { PlaceSheet, type PlaceSheetState } from './PlaceSheet';
import { EmailOtpSheet } from './EmailOtpSheet';
import { PublicAddSheet } from './PublicAddSheet';
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
  maskEmailDomain,
  signOutPublicUser,
  subscribePublicSession,
} from '../services/publicAuth';
import {
  canModerate,
  fetchMapperAccount,
  fetchModerationQueue,
  type MapperAccount,
} from '../services/moderation';
import { getMapperOutbox } from '../services/mapper-outbox';
import { isSupabaseConfigured } from '../services/supabase';
import type { Place } from '../types';
import { MOOD_EVENT, currentMood, currentSkin } from '../utils/skin';
import { readMapLayer, writeMapLayer, type MapLayer } from '../utils/mapLayer';
import { stopgapMeasurePointUrl } from '../utils/stopgapLink';
import { canUseLive } from '../services/assistantApi';
import { BrandMark } from './BrandMark';
import { ModuleBoundary } from '../modules/ModuleBoundary';
import { useModuleFlags } from '../modules/useModuleFlags';
import type { MapperScreen } from '../modules/mapper/MapperModule';

// Модули грузятся отдельными кусками кода: основа открывается и без них.
const MapperModule = lazy(() => import('../modules/mapper/MapperModule'));
const RampsModule = lazy(() => import('../modules/ramps/RampsModule'));

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
  // В оболочке «живой интерфейс» светлое по умолчанию, тёмное — только настроение «Ночь».
  const livingSkin = currentSkin() === 'living';
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (livingSkin) return currentMood() === 'night' ? 'dark' : 'light';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    if (!livingSkin) return;
    const onMood = () => setTheme(currentMood() === 'night' ? 'dark' : 'light');
    window.addEventListener(MOOD_EVENT, onMood);
    return () => window.removeEventListener(MOOD_EVENT, onMood);
  }, [livingSkin]);
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
  // Карта одна, слоёв два: карта доступности и замеры (приставные пандусы).
  const [storedLayer, setLayer] = useState<MapLayer>(() => readMapLayer());
  // Модули включаются и выключаются флагом (src/modules/registry.ts); выключенный модуль основа не рисует.
  const moduleFlags = useModuleFlags();
  const rampsOn = moduleFlags.ramps;
  const layer: MapLayer = rampsOn ? storedLayer : 'access';
  // Путь картографа (AISP-328) пока открывается адресом ?mapper=1 и только при включённом модуле.
  const mapperEnabled =
    moduleFlags.mapper && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mapper');
  // Какой экран модуля «картограф» открыт: путь, кабинет или очередь проверки.
  const [mapperScreen, setMapperScreen] = useState<MapperScreen | null>(null);
  const mapperOpen = mapperScreen === 'flow';
  const dayOpen = mapperScreen === 'day';
  const queueOpen = mapperScreen === 'queue';
  const [dayEntries, setDayEntries] = useState<DayEntry[]>(() => (mapperEnabled ? readDay() : []));
  const [flowKey, setFlowKey] = useState(0);
  // Предварительный замер из разговора координатора с помощником.
  const getCenterRef = useRef<(() => { lat: number; lng: number } | null) | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  // Идентификатор вошедшего: к нему привязаны объекты, ждущие отправки на устройстве.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [outboxNote, setOutboxNote] = useState<string | null>(null);
  const [pendingAddAfterAuth, setPendingAddAfterAuth] = useState(false);
  // Путь картографа: куда вести после входа и кто вошёл.
  const [pendingMapperAfterAuth, setPendingMapperAfterAuth] = useState<'flow' | 'cabinet' | null>(null);
  const [account, setAccount] = useState<MapperAccount | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
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
        setAuthUserId(session?.user.id ?? null);
      }
    });
    const unsubscribe = subscribePublicSession((session) => {
      setAuthEmail(session?.user.email ?? null);
      setAuthUserId(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Профиль нужен только пути картографа: роль решает, показывать ли очередь проверки.
  useEffect(() => {
    if (!mapperEnabled || !authEmail) return;
    let cancelled = false;
    void fetchMapperAccount()
      .then(async (next) => {
        if (cancelled) return;
        setAccount(next);
        if (!canModerate(next?.role)) {
          setQueueCount(null);
          return;
        }
        const queue = await fetchModerationQueue();
        if (!cancelled) setQueueCount(queue.length);
      })
      .catch(() => {
        // Кабинет покажет вход без кармы; путь добавления от этого не зависит.
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mapperEnabled, authEmail]);

  // Отложенные объекты уходят сами: при открытии карты и при возврате связи.
  useEffect(() => {
    if (!mapperEnabled || !authUserId) return;
    let cancelled = false;
    const flush = () => {
      void getMapperOutbox()
        .flush(authUserId, { auto: true })
        .then((result) => {
          if (cancelled) return;
          setWaitingCount(result.left.length);
          if (result.sent > 0) setOutboxNote(`Ушло на проверку: ${result.sent}`);
        })
        .catch(() => undefined);
    };
    flush();
    window.addEventListener('online', flush);
    return () => {
      cancelled = true;
      window.removeEventListener('online', flush);
    };
  }, [mapperEnabled, authUserId]);

  // Счётчик на кнопке кабинета обновляется, когда человек вернулся на карту.
  useEffect(() => {
    if (!mapperEnabled || !authUserId || mapperOpen || dayOpen) return;
    let cancelled = false;
    void getMapperOutbox()
      .list(authUserId)
      .then((list) => {
        if (!cancelled) setWaitingCount(list.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mapperEnabled, authUserId, mapperOpen, dayOpen]);

  const shownWaiting = authUserId ? waitingCount : 0;

  // После выхода прежний профиль не показывается, даже пока состояние не сброшено.
  const shownAccount = authEmail ? account : null;
  const shownQueueCount = authEmail ? queueCount : null;

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

  const requestMapperSignIn = useCallback((target: 'flow' | 'cabinet') => {
    setPendingMapperAfterAuth(target);
    setAuthSheetKey((key) => key + 1);
    setAuthOpen(true);
  }, []);

  const beginMapperFlow = useCallback(() => {
    // Объект уходит на сервер от имени человека, поэтому вход нужен до первого шага:
    // иначе картограф заполнит карточку и упрётся в отказ на последнем.
    if (authEmail) {
      setMapperScreen('flow');
      return;
    }
    requestMapperSignIn('flow');
  }, [authEmail, requestMapperSignIn]);

  const switchLayer = useCallback((next: MapLayer) => {
    setLayer(next);
    writeMapLayer(next);
  }, []);

  /** «Добавить локацию» из меню: слой карты доступности и сразу добавление. */
  const handleMenuAddLocation = useCallback(() => {
    setMenuOpen(false);
    switchLayer('access');
    if (mapperEnabled) beginMapperFlow();
    else beginAddFlow();
  }, [beginAddFlow, beginMapperFlow, mapperEnabled, switchLayer]);

  /** «Заказать пандус» из меню: та же карта, слой замеров. */
  const handleMenuOrderRamp = useCallback(() => {
    setMenuOpen(false);
    setMapperScreen(null);
    switchLayer('ramps');
  }, [switchLayer]);

  /** Замер в точке под прицелом: мастер Stopgap с координатами и адресом возврата. */
  const handleMeasureHere = useCallback(() => {
    const center = getCenterRef.current?.() ?? null;
    window.location.assign(stopgapMeasurePointUrl(center, window.location.href));
  }, []);

  const handleCabinet = useCallback(() => {
    if (mapperEnabled) {
      setMapperScreen('day');
      return;
    }
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
  }, [authEmail, mapperEnabled]);

  const handleAuthVerified = useCallback(() => {
    setAuthOpen(false);
    if (pendingMapperAfterAuth) {
      const target = pendingMapperAfterAuth;
      setPendingMapperAfterAuth(null);
      if (target === 'flow') setMapperScreen('flow');
      else setMapperScreen('day');
      return;
    }
    if (pendingAddAfterAuth) {
      setPendingAddAfterAuth(false);
      setAddSheetKey((key) => key + 1);
      setAddOpen(true);
    }
  }, [pendingAddAfterAuth, pendingMapperAfterAuth]);

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
        filterActive={filters.query.trim() !== '' || filters.categories.length > 0 || filters.status !== 'all'}
        menuOpen={menuOpen}
        menuButtonRef={menuButtonRef}
        filterButtonRef={filterButtonRef}
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
        />
        {layer === 'ramps' && (
          <ModuleBoundary id="ramps" title="Заказать пандус" onDismiss={() => switchLayer('access')}>
            <RampsModule
              showCross={!selectedPlaceId}
              onMeasureHere={handleMeasureHere}
              onLeave={() => switchLayer('access')}
            />
          </ModuleBoundary>
        )}
        {/* В живой оболочке объект добавляет центральная кнопка, а число ждущих видно у входа в кабинет. */}
        {!livingSkin && layer === 'access' && mapperEnabled && !mapperOpen && !dayOpen && !queueOpen && (
          <div className="mapper-fab-row">
            <button type="button" className="mapper-day-btn" onClick={() => setMapperScreen('day')}>
              Сегодня · {dayEntries.length}
              {shownWaiting > 0 && <span className="mapper-day-wait"> · ждут {shownWaiting}</span>}
            </button>
            <button type="button" className="mapper-fab" onClick={beginMapperFlow}>
              + Добавить объект
            </button>
          </div>
        )}
        {mapperEnabled && mapperScreen && (
          <ModuleBoundary id="mapper" title="Добавить локацию" onDismiss={() => setMapperScreen(null)}>
            <MapperModule
              screen={mapperScreen}
              theme={theme}
              flowKey={flowKey}
              ownerId={authUserId}
              canLive={canUseLive(shownAccount?.role)}
              account={shownAccount}
              accountLabel={authEmail ? maskEmailDomain(authEmail) : null}
              queueCount={shownQueueCount}
              getCenter={() => getCenterRef.current?.() ?? null}
              onScreen={setMapperScreen}
              onAnother={() => setFlowKey((k) => k + 1)}
              onSaved={setDayEntries}
              onSignIn={() => {
                setMapperScreen(null);
                requestMapperSignIn('cabinet');
              }}
              onSignOut={() => {
                setMapperScreen(null);
                void signOutPublicUser();
              }}
              onQueueChanged={(left, published) => {
                setQueueCount(left);
                // Опубликованное сразу должно появиться на карте под очередью.
                if (published) void reloadPlaces().catch(() => undefined);
              }}
            />
          </ModuleBoundary>
        )}
        <MenuOverlay
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAddLocation={handleMenuAddLocation}
          onOrderRamp={handleMenuOrderRamp}
          layer={layer}
          rampsAvailable={rampsOn}
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
          showMeasure={rampsOn && (mapperEnabled || layer === 'ramps')}
          measureFirst={layer === 'ramps'}
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
            setPendingMapperAfterAuth(null);
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

      {/* Одна кнопка на карте: она начинает тот же путь, что «Добавить локацию» в меню.
          В слое замеров её нет: там одно действие, «Замерить вход здесь». */}
      {livingSkin && layer === 'access' && (
        <button type="button" className="lv-dome" aria-label="Добавить объект" onClick={handleMenuAddLocation}>
          <BrandMark size={34} />
        </button>
      )}

      <MapFooter onCabinet={handleCabinet} waiting={livingSkin && mapperEnabled ? shownWaiting : 0} />

      {outboxNote && (
        <div className="public-toast" role="status">
          {outboxNote}
          <button type="button" className="public-toast-close" onClick={() => setOutboxNote(null)}>
            Закрыть
          </button>
        </div>
      )}

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
