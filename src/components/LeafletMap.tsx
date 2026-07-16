import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { buildPinHtml } from "./map/pinMarkup";
import type { MapViewProps } from "./map/types";
import { DEFAULT_MAP_ZOOM, SUKHUM_CENTER } from "./map/vectorStyle";
import { getBrowserLocation } from "../utils/location";
import { telegram } from "../utils/telegram";

const SUKHUM_CENTER_LEAFLET: L.LatLngExpression = [SUKHUM_CENTER.lat, SUKHUM_CENTER.lng];
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

type LeafletMapProps = MapViewProps;

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: SUKHUM_CENTER_LEAFLET,
      zoom: DEFAULT_MAP_ZOOM,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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

  useEffect(() => {
    const group = markersGroupRef.current;
    const map = mapRef.current;
    if (!group || !map || dragMode) return;

    group.clearLayers();

    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const icon = L.divIcon({
        className: "goapsny-leaflet-marker",
        html: buildPinHtml({
          placeName: place.name,
          status: place.status,
          rampType: place.rampType || "none",
          isSelected,
          placeId: place.id,
        }),
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || dragMode) return;

    const selectedPlace = places.find((p) => p.id === selectedPlaceId);
    if (selectedPlace) {
      map.setView([selectedPlace.lat, selectedPlace.lng], 16, { animate: true });
    }
  }, [selectedPlaceId, places, dragMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
          html: buildPinHtml({
            placeName: "Новое место",
            status: "yellow",
            rampType: "none",
            isSelected: true,
            placeId: "draft",
          }),
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
      if (group) group.addTo(map);
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
