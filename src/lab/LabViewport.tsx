import { useEffect, useRef } from 'react';
import * as maplibre from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LabBounds, LabPlace } from './contract';
import { STATUS_META } from '../shared';
maplibre.setWorkerUrl(workerUrl);

// Deliberately no tiles, glyphs, sprites, geolocation, telemetry or live APIs.
// A coordinate canvas exercises actual bounds/moveend without network assets.
export function LabViewport({ places, onBounds, onPhase, onSelect }: {
  places: LabPlace[]; onBounds: (bounds: LabBounds) => void;
  onPhase: (phase: 'loading' | 'ready' | 'error') => void; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibre.Map | null>(null);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibre.Map;
    try {
      map = new maplibre.Map({ container: container.current, center: [41.0237, 43.0033], zoom: 14,
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eee8e0' } }] },
        attributionControl: false });
    } catch { onPhase('error'); return; }
    mapRef.current = map;
    const bounds = () => {
      const b = map.getBounds();
      onBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    map.addControl(new maplibre.NavigationControl({ showCompass: false }));
    map.on('load', () => { bounds(); onPhase('ready'); });
    map.on('moveend', bounds);
    map.on('error', () => onPhase('error'));
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, [onBounds, onPhase]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = places.map(place => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lab-pin';
      button.style.backgroundColor = STATUS_META[place.status].color;
      button.textContent = '●';
      button.setAttribute('aria-label', `${place.name}: ${STATUS_META[place.status].ru}`);
      button.onclick = () => onSelect(place.id);
      return new maplibre.Marker({ element: button }).setLngLat([place.lng, place.lat]).addTo(map);
    });
    return () => markers.forEach(marker => marker.remove());
  }, [places, onSelect]);
  return <div ref={container} className="lab-map" aria-label="Демонстрационная область карты. Для перемещения используйте стрелки, для масштаба плюс и минус" />;
}
