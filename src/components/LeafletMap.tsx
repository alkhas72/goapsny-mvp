import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { telegram } from "../utils/telegram";

const SUKHUM_CENTER: L.LatLngExpression = [43.0033, 41.0237];

const tileLayers = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const accessibilitySvg = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="4" r="2" />
    <path d="M9.5 9h3l1.5 4.5h3" />
    <path d="M11 9l-1 5 3.5 3.5" />
    <path d="M7.8 14.5a5.5 5.5 0 1 0 7.8 0" />
  </svg>
`;

interface LeafletMapProps {
  places: Place[];
  selectedPlaceId: string | null;
  theme: "dark" | "light";
  onSelectPlace?: (id: string) => void;
  onClearSelection?: () => void;
  dragMode?: {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
  };
}

export function LeafletMap({
  places,
  selectedPlaceId,
  theme,
  onSelectPlace,
  onClearSelection,
  dragMode,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const draggableMarkerRef = useRef<L.Marker | null>(null);

  const [hasLocated, setHasLocated] = useState(false);

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: SUKHUM_CENTER,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);

    if (onClearSelection) {
      map.on("click", onClearSelection);
    }

    // Leaflet redraw fix
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (onClearSelection) {
        map.off("click", onClearSelection);
      }
      map.remove();
      mapRef.current = null;
      markersGroupRef.current = null;
      layerRef.current = null;
      userMarkerRef.current = null;
      draggableMarkerRef.current = null;
    };
  }, [onClearSelection]);

  // 2. Dynamic Theme Tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const config = tileLayers[theme];
    layerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 19,
    }).addTo(map);
  }, [theme]);

  // 3. User Geolocation centering upon opening
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasLocated || dragMode) return;

    const centerOnUser = async () => {
      try {
        const pos = await telegram.getUserLocation();
        map.setView([pos.lat, pos.lng], 16, { animate: true });

        // Add user location blue marker
        if (userMarkerRef.current) {
          map.removeLayer(userMarkerRef.current);
        }

        const icon = L.divIcon({
          className: "user-location-marker",
          html: '<div class="user-marker-pulse"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        userMarkerRef.current = L.marker([pos.lat, pos.lng], { icon, interactive: false }).addTo(map);
        setHasLocated(true);
      } catch (e) {
        console.warn("Could not get user position on startup, centering default", e);
        // Fallback to center
        map.setView(SUKHUM_CENTER, 15);
        setHasLocated(true);
      }
    };

    centerOnUser();
  }, [hasLocated, dragMode]);

  // 4. Render POI Markers
  useEffect(() => {
    const group = markersGroupRef.current;
    const map = mapRef.current;
    if (!group || !map || dragMode) return;

    group.clearLayers();

    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const icon = L.divIcon({
        className: "goapsny-leaflet-marker",
        html: `
          <div class="leaflet-pin-wrapper">
            <div class="leaflet-pin-body ${place.status} ${isSelected ? "is-selected" : ""}">
              <div class="leaflet-pin-icon-wrap">${accessibilitySvg}</div>
            </div>
            ${place.rampType && place.rampType !== "none" ? '<div class="leaflet-pin-sticker"></div>' : ""}
          </div>
        `,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const marker = L.marker([place.lat, place.lng], { icon }).addTo(group);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectPlace) {
          onSelectPlace(place.id);
        }
      });
    });
  }, [places, selectedPlaceId, onSelectPlace, dragMode]);

  // 5. Select Center Panning
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    const selectedPlace = places.find((p) => p.id === selectedPlaceId);
    if (selectedPlace) {
      map.setView([selectedPlace.lat, selectedPlace.lng], 16, { animate: true });
    }
  }, [selectedPlaceId, places, dragMode]);

  // 6. Handle Draggable Pin Step 4
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove POI markers group when in drag mode to avoid overlap confusion
    const group = markersGroupRef.current;
    if (dragMode) {
      if (group) map.removeLayer(group);
      
      const pinPosition: L.LatLngExpression = [dragMode.lat, dragMode.lng];
      map.setView(pinPosition, 17, { animate: false });

      if (draggableMarkerRef.current) {
        draggableMarkerRef.current.setLatLng(pinPosition);
      } else {
        const icon = L.divIcon({
          className: "goapsny-leaflet-marker",
          html: `
            <div class="leaflet-pin-wrapper">
              <div class="leaflet-pin-body yellow is-selected">
                <div class="leaflet-pin-icon-wrap">${accessibilitySvg}</div>
              </div>
            </div>
          `,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });

        const marker = L.marker(pinPosition, { icon, draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const newPos = marker.getLatLng();
          dragMode.onChange(newPos.lat, newPos.lng);
        });

        draggableMarkerRef.current = marker;
      }
    } else {
      // Restore group
      if (group) group.addTo(map);
      // Clean up draggable marker
      if (draggableMarkerRef.current) {
        map.removeLayer(draggableMarkerRef.current);
        draggableMarkerRef.current = null;
      }
    }
  }, [dragMode]);

  const [locating, setLocating] = useState(false);

  const handleLocate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const map = mapRef.current;
    if (!map) return;
    setLocating(true);
    try {
      const pos = await telegram.getUserLocation();
      map.setView([pos.lat, pos.lng], 16, { animate: true });

      // Update/add user marker
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
      }
      const icon = L.divIcon({
        className: "user-location-marker",
        html: '<div class="user-marker-pulse"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      userMarkerRef.current = L.marker([pos.lat, pos.lng], { icon, interactive: false }).addTo(map);
    } catch (err) {
      console.warn("Could not retrieve geolocation on manual trigger", err);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="map-wrapper" ref={containerRef}>
      {!dragMode && (
        <button
          type="button"
          className={`gps-locate-btn ${locating ? "locating" : ""}`}
          onClick={handleLocate}
          style={{ pointerEvents: "auto" }}
          title="Найти меня"
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
