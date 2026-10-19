import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Place } from '../../types';
import { getBrowserLocation } from '../../utils/location';
import { telegram } from '../../utils/telegram';
import { framePadding, initialPlacesBounds } from './initialView';
import { MapAttribution } from './MapAttribution';
import { createPinElement } from './pinMarkup';
import { coveredBottom, findBottomCard, selectedPinOffset } from './selectionCamera';
import type { MapViewProps } from './types';
import { MapViewControls } from './MapViewControls';
import './mapChrome.css';
import {
  BASEMAP_PALETTES,
  defaultLightPreset,
  LIGHT_PRESETS,
  type BasemapPalette,
  type LightPreset,
} from './goapsnyBasemap';
import {
  CITY_ZOOM,
  DEFAULT_MAP_ZOOM,
  DRAFT_ZOOM,
  getVectorStyle,
  PLACES_MAX_ZOOM,
  SELECTED_ZOOM,
  SUKHUM_CENTER,
} from './vectorStyle';

// maplibre-gl 6 is ESM-only; Vite cannot resolve the worker unless we set it.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Register PMTiles protocol for offline-first vector tile archives.
import * as pmtiles from 'pmtiles';

let pmtilesProtocolRegistered = false;
function ensurePmtilesProtocol(): void {
  if (pmtilesProtocolRegistered) return;
  try {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    pmtilesProtocolRegistered = true;
  } catch (err) {
    console.warn('Could not register pmtiles protocol', err);
  }
}
ensurePmtilesProtocol();

// The viewer's map look is a per-device convenience; storage may be absent.
const LOOK_KEY = 'goapsny.mapLook';

interface MapLook {
  palette: BasemapPalette;
  preset: LightPreset | null;
  threeD: boolean;
}

function readLook(): MapLook {
  const fallback: MapLook = { palette: 'gray', preset: null, threeD: false };
  try {
    const raw = window.localStorage.getItem(LOOK_KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as Partial<MapLook>;
    return {
      palette: BASEMAP_PALETTES.includes(v.palette as BasemapPalette) ? (v.palette as BasemapPalette) : 'gray',
      preset: LIGHT_PRESETS.includes(v.preset as LightPreset) ? (v.preset as LightPreset) : null,
      threeD: v.threeD === true,
    };
  } catch {
    return fallback;
  }
}

function writeLook(look: MapLook): void {
  try {
    window.localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

const PITCH_3D = 60;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface MarkerHandle {
  marker: maplibregl.Marker;
  release: () => void;
}

function wireMarkerButton(
  root: HTMLDivElement,
  placeId: string,
  onSelectPlace: MapViewProps['onSelectPlace'],
  onMarkerButton: MapViewProps['onMarkerButton'],
): () => void {
  const button = root.querySelector('button.map-pin-button') as HTMLButtonElement | null;
  if (!button) return () => undefined;

  onMarkerButton?.(placeId, button);

  const activate = (event: Event) => {
    event.stopPropagation();
    onSelectPlace?.(placeId);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(event);
    }
  };

  button.addEventListener('click', activate);
  button.addEventListener('keydown', onKeyDown);

  return () => {
    button.removeEventListener('click', activate);
    button.removeEventListener('keydown', onKeyDown);
    onMarkerButton?.(placeId, null);
  };
}

/**
 * MapLibre adapter. Drop-in behind the same props/events as `LeafletMap`.
 *
 * Boundary guarantees:
 *  - initial public load frames the places (the densest town), or Sukhum at
 *    town scale when there are none, and NEVER requests geolocation (no
 *    automatic permission prompt);
 *  - the first non-empty places reframe the map only while the person has
 *    not moved it and nothing is selected;
 *  - location tracking is opt-in via an explicit user control, and a precise
 *    fix overrides the default bounds via `flyTo`;
 *  - theme toggles restyle the map in place (`setStyle`) without recreating it.
 *
 * This module is intentionally NOT wired into the application shell until the
 * Leaflet parity gate is green.
 */
export function MapLibreMap({
  places,
  selectedPlaceId,
  theme,
  onSelectPlace,
  onClearSelection,
  dragMode,
  useBrowserGeolocation = false,
  onMarkerButton,
  onCenterApi,
  onBoundsChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const draggableMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);
  // Initial framing: done once, and never after the person moved the map.
  const placesRef = useRef(places);
  const loadedRef = useRef(false);
  const framedRef = useRef(false);
  const userMovedRef = useRef(false);
  const selectedIdRef = useRef(selectedPlaceId);
  useEffect(() => {
    placesRef.current = places;
    selectedIdRef.current = selectedPlaceId;
  }, [places, selectedPlaceId]);

  const [locating, setLocating] = useState(false);
  const [userLocationActive, setUserLocationActive] = useState(false);
  const [look, setLook] = useState<MapLook>(readLook);
  const styleOptions = {
    palette: look.palette,
    preset: look.preset ?? undefined,
    threeD: look.threeD,
  };
  const updateLook = (patch: Partial<MapLook>) => {
    setLook((prev) => {
      const next = { ...prev, ...patch };
      writeLook(next);
      return next;
    });
  };

  // Frame the places once. Without places, show Sukhum at town scale and
  // leave framing open for when places arrive.
  const frameInitialView = (map: maplibregl.Map, animate: boolean) => {
    const bounds = initialPlacesBounds(placesRef.current);
    if (!bounds) {
      map.jumpTo({ center: [SUKHUM_CENTER.lng, SUKHUM_CENTER.lat], zoom: CITY_ZOOM });
      return;
    }
    const container = map.getContainer();
    map.fitBounds(bounds, {
      padding: framePadding(container.clientWidth, container.clientHeight),
      maxZoom: PLACES_MAX_ZOOM,
      animate: animate && !prefersReducedMotion(),
      duration: 450,
    });
    framedRef.current = true;
  };

  // 1. Initialize map + initial view. No geolocation here.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getVectorStyle(theme, styleOptions),
      pitch: look.threeD ? PITCH_3D : 0,
      maxPitch: 70,
      center: [SUKHUM_CENTER.lng, SUKHUM_CENTER.lat],
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: false,
    });

    // Zoom buttons for mouse users; hidden on phones by CSS (pinch instead).
    // Credits are rendered by <MapAttribution /> below.
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // A gesture by the person (drag, pinch, wheel, keyboard) ends automatic
    // framing; camera moves made by code carry no originalEvent.
    map.on('movestart', (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) userMovedRef.current = true;
    });

    if (onClearSelection) {
      map.on('click', onClearSelection);
    }

    mapRef.current = map;
    onCenterApi?.(() => {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    });
    // Dev-only handle for visual checks from the browser console.
    if (import.meta.env.DEV) (window as unknown as { __goapsnyMap?: maplibregl.Map }).__goapsnyMap = map;

    const reportBounds = () => {
      const b = map.getBounds();
      onBoundsChangeRef.current?.({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    map.on('moveend', reportBounds);

    // Frame the places once the style is ready. Precise live geolocation is
    // never requested here — see the locate control below.
    map.once('load', () => {
      loadedRef.current = true;
      // A draft pin opens close to the entrance, not on the whole country.
      if (dragMode) {
        map.jumpTo({ center: [dragMode.lng, dragMode.lat], zoom: DRAFT_ZOOM });
        return;
      }
      // Opened with a place already chosen (a shared ?place= link): the
      // camera stays on that place; framing the whole set would undo it.
      const selected = placesRef.current.find((place) => place.id === selectedIdRef.current);
      if (selected) {
        framedRef.current = true;
        const c = map.getContainer();
        map.easeTo({
          center: [selected.lng, selected.lat],
          zoom: Math.max(map.getZoom(), SELECTED_ZOOM),
          offset: selectedPinOffset(c.clientWidth, c.clientHeight, coveredBottom(c)),
          duration: 0,
        });
      } else if (!userMovedRef.current) {
        frameInitialView(map, false);
      }
      reportBounds();
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.resize();
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (onClearSelection) {
        map.off('click', onClearSelection);
      }
      markersRef.current.forEach(({ marker, release }) => {
        release();
        marker.remove();
      });
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      draggableMarkerRef.current?.remove();
      draggableMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- theme/onClear applied via dedicated effects; never recreate the map on prop change
  }, []);

  // 2. Dynamic theme and map look — restyle in place, do not recreate the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getVectorStyle(theme, styleOptions));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- styleOptions is derived from look
  }, [theme, look.palette, look.preset, look.threeD]);

  // 3D view tilts the camera; 2D returns it flat. The initial pitch is set
  // at construction, so only react to the user's toggle.
  const pitchReadyRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pitchReadyRef.current) {
      pitchReadyRef.current = true;
      return;
    }
    map.easeTo({ pitch: look.threeD ? PITCH_3D : 0, duration: 600 });
  }, [look.threeD]);

  // 3. Render POI markers (skipped while a draft pin is being placed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    markersRef.current.forEach(({ marker, release }) => {
      release();
      marker.remove();
    });
    markersRef.current = [];

    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const root = createPinElement({
        placeName: place.name,
        status: place.status,
        rampType: place.rampType || 'none',
        isSelected,
        placeId: place.id,
      });
      const marker = new maplibregl.Marker({ element: root, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      const release = wireMarkerButton(root, place.id, onSelectPlace, onMarkerButton);
      markersRef.current.push({ marker, release });
    });
  }, [places, selectedPlaceId, onSelectPlace, dragMode, onMarkerButton]);

  // 3b. Places that arrive after the map loaded (or the first non-empty
  // set) frame the map once — unless the person already moved it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode || !loadedRef.current) return;
    if (framedRef.current || userMovedRef.current || selectedPlaceId) return;
    if (places.length === 0) return;
    frameInitialView(map, true);
  }, [places, dragMode, selectedPlaceId]);

  // 4. Re-center on selection (skipped while placing a draft pin). The pin
  // stays clear of the place card; while the card settles (content loads,
  // height changes) the camera follows it for a short while.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    const selectedPlace = places.find((place) => place.id === selectedPlaceId);
    if (!selectedPlace) return;
    framedRef.current = true;

    const container = map.getContainer();
    const center: [number, number] = [selectedPlace.lng, selectedPlace.lat];
    // Never zoom out a map the person already zoomed in.
    const zoom = Math.max(map.getZoom(), SELECTED_ZOOM);
    const offsetNow = () =>
      selectedPinOffset(container.clientWidth, container.clientHeight, coveredBottom(container));

    let lastOffset = offsetNow();
    map.flyTo({ center, zoom, offset: lastOffset, essential: true });

    const card = findBottomCard(container);
    if (!card || typeof ResizeObserver === 'undefined') return;
    const follow = () => {
      const next = offsetNow();
      if (Math.abs(next[1] - lastOffset[1]) < 16 && Math.abs(next[0] - lastOffset[0]) < 16) return;
      lastOffset = next;
      map.easeTo({ center, zoom, offset: next, duration: prefersReducedMotion() ? 0 : 250, essential: true });
    };
    const observer = new ResizeObserver(follow);
    observer.observe(card);
    card.addEventListener('transitionend', follow);
    card.addEventListener('animationend', follow);
    const stop = window.setTimeout(() => observer.disconnect(), 2500);
    return () => {
      window.clearTimeout(stop);
      observer.disconnect();
      card.removeEventListener('transitionend', follow);
      card.removeEventListener('animationend', follow);
    };
  }, [selectedPlaceId, places, dragMode]);

  // 5. Draft pin during place creation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (dragMode) {
      // Hide POI markers to avoid overlap confusion while placing a draft.
      markersRef.current.forEach(({ marker, release }) => {
        release();
        marker.remove();
      });
      markersRef.current = [];

      map.jumpTo({ center: [dragMode.lng, dragMode.lat], zoom: DRAFT_ZOOM });

      if (draggableMarkerRef.current) {
        draggableMarkerRef.current.setLngLat([dragMode.lng, dragMode.lat]);
      } else {
        const root = createPinElement({
          placeName: 'Новое место',
          status: 'yellow',
          rampType: 'none',
          isSelected: true,
          placeId: 'draft',
        });
        const marker = new maplibregl.Marker({
          element: root,
          anchor: 'bottom',
          draggable: true,
        })
          .setLngLat([dragMode.lng, dragMode.lat])
          .addTo(map);
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          dragMode.onChange(lngLat.lat, lngLat.lng);
        });
        draggableMarkerRef.current = marker;
      }
      return;
    }

    if (draggableMarkerRef.current) {
      draggableMarkerRef.current.remove();
      draggableMarkerRef.current = null;
    }
  }, [dragMode]);

  // 6. Explicit location control — opt-in only.
  const handleLocate = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const map = mapRef.current;
    if (!map) return;

    // Deactivate path: remove the user marker and stop tracking. No re-fetch.
    if (userLocationActive && userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
      setUserLocationActive(false);
      return;
    }

    setLocating(true);
    try {
      const pos = useBrowserGeolocation
        ? await getBrowserLocation()
        : await telegram.getUserLocation();

      // A precise live fix overrides the initial view.
      framedRef.current = true;
      map.flyTo({ center: [pos.lng, pos.lat], zoom: SELECTED_ZOOM, essential: true });

      userMarkerRef.current?.remove();
      const pulse = document.createElement('div');
      pulse.className = 'user-marker-pulse';
      userMarkerRef.current = new maplibregl.Marker({ element: pulse, anchor: 'center' })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
      setUserLocationActive(true);
    } catch (error) {
      console.warn('Could not retrieve geolocation on manual trigger', error);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="map-wrapper map-wrapper--maplibre" ref={containerRef}>
      {/* The place card covers this corner; the map look waits until it closes. */}
      {!dragMode && !selectedPlaceId && (
        <MapViewControls
          palette={look.palette}
          preset={look.preset ?? defaultLightPreset(theme)}
          threeD={look.threeD}
          onPalette={(palette) => updateLook({ palette })}
          onPreset={(preset) => updateLook({ preset })}
          onThreeD={(threeD) => updateLook({ threeD })}
        />
      )}
      {!dragMode && (
        <button
          type="button"
          className={`gps-locate-btn ${locating ? 'locating' : ''} ${userLocationActive ? 'is-active' : ''}`}
          onClick={handleLocate}
          style={{ pointerEvents: 'auto' }}
          data-touch-target="44"
          title={userLocationActive ? 'Скрыть моё местоположение' : 'Показать моё местоположение'}
          aria-label={userLocationActive ? 'Скрыть моё местоположение' : 'Показать моё местоположение'}
          aria-pressed={userLocationActive}
        >
          <LocateFixed size={22} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      <MapAttribution />
    </div>
  );
}

// Re-export shared surface so the shell can swap Leaflet→MapLibre by import.
export type { MapViewProps } from './types';
export type { Place };
