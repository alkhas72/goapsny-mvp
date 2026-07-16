import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { getBrowserLocation } from '../../utils/location';
import { telegram } from '../../utils/telegram';
import { buildPinHtml } from './pinMarkup';
import type { MapViewProps } from './types';
import {
  DEFAULT_MAP_ZOOM,
  getVectorStyleUrl,
  MAP_ATTRIBUTION,
  SUKHUM_CENTER,
} from './vectorStyle';

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
  const markersRef = useRef<Array<{ marker: maplibregl.Marker; release: () => void }>>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const draggableMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [locating, setLocating] = useState(false);

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
    // theme is applied on mount and via the dedicated setStyle effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid recreating the map on theme toggle
  }, [onClearSelection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getVectorStyleUrl(theme));
  }, [theme]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    const selectedPlace = places.find((place) => place.id === selectedPlaceId);
    if (selectedPlace) {
      map.flyTo({
        center: [selectedPlace.lng, selectedPlace.lat],
        zoom: 16,
        essential: true,
      });
    }
  }, [selectedPlaceId, places, dragMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (dragMode) {
      markersRef.current.forEach(({ marker, release }) => {
        release();
        marker.remove();
      });
      markersRef.current = [];

      map.jumpTo({
        center: [dragMode.lng, dragMode.lat],
        zoom: 17,
      });

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
        const marker = new maplibregl.Marker({ element: root, anchor: 'bottom', draggable: true })
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

  const handleLocate = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const map = mapRef.current;
    if (!map) return;

    setLocating(true);
    try {
      const pos = useBrowserGeolocation
        ? await getBrowserLocation()
        : await telegram.getUserLocation();
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 16, essential: true });

      userMarkerRef.current?.remove();
      const pulse = document.createElement('div');
      pulse.className = 'user-marker-pulse';
      userMarkerRef.current = new maplibregl.Marker({ element: pulse, anchor: 'center' })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
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
          className={`gps-locate-btn ${locating ? 'locating' : ''}`}
          onClick={handleLocate}
          style={{ pointerEvents: 'auto' }}
          title="Найти меня"
          aria-label="Найти меня"
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
