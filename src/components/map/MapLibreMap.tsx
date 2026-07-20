import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Place } from '../../types';
import { getBrowserLocation } from '../../utils/location';
import { telegram } from '../../utils/telegram';
import { buildPinHtml } from './pinMarkup';
import type { MapViewProps } from './types';
import {
  ABKHAZIA_BOUNDS,
  DEFAULT_MAP_ZOOM,
  DRAFT_ZOOM,
  getVectorStyleUrl,
  MAP_ATTRIBUTION,
  SELECTED_ZOOM,
  SUKHUM_CENTER,
} from './vectorStyle';

interface MarkerHandle {
  marker: maplibregl.Marker;
  release: () => void;
}

function createMarkerRoot(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'goapsny-maplibre-marker';
  root.innerHTML = html.trim();
  return root;
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
 *  - initial public load fits Abkhazia bounds and NEVER requests geolocation
 *    (no automatic permission prompt);
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
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const draggableMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [locating, setLocating] = useState(false);
  const [userLocationActive, setUserLocationActive] = useState(false);

  // 1. Initialize map + Abkhazia default bounds. No geolocation here.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getVectorStyleUrl(theme),
      center: [SUKHUM_CENTER.lng, SUKHUM_CENTER.lat],
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
      'bottom-left',
    );

    if (onClearSelection) {
      map.on('click', onClearSelection);
    }

    mapRef.current = map;

    // Fit the default Abkhazia frame once the style is ready. Precise live
    // geolocation is never requested here — see the locate control below.
    map.once('load', () => {
      map.fitBounds(ABKHAZIA_BOUNDS as maplibregl.LngLatBoundsLike, { animate: false });
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

  // 2. Dynamic theme — restyle in place, do not recreate the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getVectorStyleUrl(theme));
  }, [theme]);

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
      const root = createMarkerRoot(
        buildPinHtml({
          placeName: place.name,
          status: place.status,
          rampType: place.rampType || 'none',
          isSelected,
          placeId: place.id,
        }),
      );
      const marker = new maplibregl.Marker({ element: root, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      const release = wireMarkerButton(root, place.id, onSelectPlace, onMarkerButton);
      markersRef.current.push({ marker, release });
    });
  }, [places, selectedPlaceId, onSelectPlace, dragMode, onMarkerButton]);

  // 4. Re-center on selection (skipped while placing a draft pin).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    const selectedPlace = places.find((place) => place.id === selectedPlaceId);
    if (selectedPlace) {
      map.flyTo({
        center: [selectedPlace.lng, selectedPlace.lat],
        zoom: SELECTED_ZOOM,
        essential: true,
      });
    }
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
        const root = createMarkerRoot(
          buildPinHtml({
            placeName: 'Новое место',
            status: 'yellow',
            rampType: 'none',
            isSelected: true,
            placeId: 'draft',
          }),
        );
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

      // A precise live fix overrides the default Abkhazia bounds.
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Re-export shared surface so the shell can swap Leaflet→MapLibre by import.
export type { MapViewProps } from './types';
export type { Place };
