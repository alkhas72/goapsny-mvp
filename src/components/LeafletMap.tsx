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

function getPinHtml(status: string, rampType: string, isSelected: boolean): string {
  const statusColor = status === "green" ? "#2EA84A" : status === "yellow" ? "#EBA92B" : "#E24B4A";
  const hasPortableRamp = rampType === "portable_available" || rampType === "portable_on_request";
  
  // Center is purple only on green and yellow pins. On red, it's always white.
  const isPurpleCenter = hasPortableRamp && (status === "green" || status === "yellow");
  
  const centerFill = isPurpleCenter ? "#7A5AF8" : "#FFFFFF";
  const centerStroke = isPurpleCenter ? 'stroke="#FFFFFF" stroke-width="2.5"' : '';

  return `
    <div class="leaflet-pin-wrapper ${isSelected ? "is-selected" : ""}">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 36C14 36 27 24 27 14C27 6.8 21.2 1 14 1C6.8 1 1 6.8 1 14C1 24 14 36 14 36Z" fill="${statusColor}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="14" cy="14" r="5.5" fill="${centerFill}" ${centerStroke}/>
      </svg>
    </div>
  `;
}

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
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
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

    // Set up ResizeObserver to invalidate size dynamically and correctly
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (onClearSelection) {
        map.off("click", onClearSelection);
      }
      map.remove();
      mapRef.current = null;
      markersGroupRef.current = null;
      baseLayerRef.current = null;
      labelsLayerRef.current = null;
      userMarkerRef.current = null;
      draggableMarkerRef.current = null;
    };
  }, [onClearSelection]);

  // 2. Dynamic Theme Tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous layers
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    if (theme === "dark") {
      baseLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      labelsLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          className: "dark-labels-layer",
        }
      ).addTo(map);
    } else {
      const config = tileLayers.light;
      baseLayerRef.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: 19,
      }).addTo(map);
    }
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
        html: getPinHtml(place.status, place.rampType || "none", isSelected),
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
          html: getPinHtml("yellow", "none", true),
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
