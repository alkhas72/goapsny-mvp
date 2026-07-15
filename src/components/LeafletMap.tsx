import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { telegram } from "../utils/telegram";
import { getBrowserLocation } from "../utils/location";
import { statusColor, statusLabel } from "../utils/status";
import type { AccessibilityStatus } from "../shared/index";

const SUKHUM_CENTER: L.LatLngExpression = [43.0033, 41.0237];
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function getPinHtml(
  placeName: string,
  status: string,
  rampType: string,
  isSelected: boolean,
  placeId: string,
): string {
  const statusColorValue =
    status === "green" || status === "yellow" || status === "red" || status === "gray"
      ? statusColor(status as AccessibilityStatus)
      : "#A0A8B0";
  const hasPortableRamp = rampType === "portable_available" || rampType === "portable_on_request";
  const isPurpleCenter = hasPortableRamp && (status === "green" || status === "yellow");
  const centerFill = isPurpleCenter ? "#7A5AF8" : "#FFFFFF";
  const centerStroke = isPurpleCenter ? 'stroke="#FFFFFF" stroke-width="2.5"' : "";
  const label = escapeAttr(`${placeName}, ${statusLabel(status as AccessibilityStatus)}`);

  return `
    <button type="button" class="map-pin-button ${isSelected ? "is-selected" : ""}" data-place-id="${placeId}" aria-label="${label}">
      <span class="leaflet-pin-wrapper ${isSelected ? "is-selected" : ""}" aria-hidden="true">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 36C14 36 27 24 27 14C27 6.8 21.2 1 14 1C6.8 1 1 6.8 1 14C1 24 14 36 14 36Z" fill="${statusColorValue}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
          <circle cx="14" cy="14" r="5.5" fill="${centerFill}" ${centerStroke}/>
        </svg>
      </span>
    </button>
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
  useBrowserGeolocation?: boolean;
  onMarkerButton?: (placeId: string, button: HTMLButtonElement | null) => void;
}

export function LeafletMap({
  places,
  selectedPlaceId,
  theme,
  onSelectPlace,
  onClearSelection,
  dragMode,
  useBrowserGeolocation = false,
  onMarkerButton,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const draggableMarkerRef = useRef<L.Marker | null>(null);

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
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
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
          attribution: ATTRIBUTION,
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
      baseLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: ATTRIBUTION,
          maxZoom: 19,
        }
      ).addTo(map);
    }
  }, [theme]);

  // 3. Render POI Markers
  useEffect(() => {
    const group = markersGroupRef.current;
    const map = mapRef.current;
    if (!group || !map || dragMode) return;

    group.clearLayers();

    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const icon = L.divIcon({
        className: "goapsny-leaflet-marker",
        html: getPinHtml(place.name, place.status, place.rampType || "none", isSelected, place.id),
        iconSize: [44, 44],
        iconAnchor: [22, 44],
      });

      const marker = L.marker([place.lat, place.lng], { icon });
      let releaseButtonHandlers: (() => void) | null = null;

      const wireMarkerButton = () => {
        releaseButtonHandlers?.();
        releaseButtonHandlers = null;
        const button = marker.getElement()?.querySelector("button.map-pin-button") as HTMLButtonElement | null;
        if (!button) return;
        onMarkerButton?.(place.id, button);
        const activate = (event: Event) => {
          L.DomEvent.stopPropagation(event);
          onSelectPlace?.(place.id);
        };
        const onKeyDown = (event: Event) => {
          const keyEvent = event as KeyboardEvent;
          if (keyEvent.key === "Enter" || keyEvent.key === " ") {
            keyEvent.preventDefault();
            activate(event);
          }
        };
        L.DomEvent.on(button, "click", activate);
        L.DomEvent.on(button, "keydown", onKeyDown);
        releaseButtonHandlers = () => {
          L.DomEvent.off(button, "click", activate);
          L.DomEvent.off(button, "keydown", onKeyDown);
        };
      };

      marker.on("add", wireMarkerButton);
      marker.on("remove", () => {
        releaseButtonHandlers?.();
        releaseButtonHandlers = null;
        onMarkerButton?.(place.id, null);
      });
      marker.addTo(group);
    });
  }, [places, selectedPlaceId, onSelectPlace, dragMode, onMarkerButton]);

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
          html: getPinHtml("Новое место", "yellow", "none", true, "draft"),
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
      const pos = useBrowserGeolocation
        ? await getBrowserLocation()
        : await telegram.getUserLocation();
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
