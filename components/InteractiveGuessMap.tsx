"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export type MapPoint = { latitude: number; longitude: number };

export default function InteractiveGuessMap({
  guess,
  onGuess,
  correct,
  disabled = false,
  label = "World map. Tap to place your pin."
}: {
  guess: MapPoint | null;
  onGuess?: (point: MapPoint) => void;
  correct?: MapPoint | null;
  disabled?: boolean;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const onGuessRef = useRef(onGuess);
  const disabledRef = useRef(disabled);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    onGuessRef.current = onGuess;
    disabledRef.current = disabled;
  }, [disabled, onGuess]);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;
        const map = L.map(containerRef.current, {
          center: [18, 5],
          zoom: 1.5,
          minZoom: 1,
          maxZoom: 18,
          zoomControl: true,
          attributionControl: true,
          worldCopyJump: true,
          scrollWheelZoom: true,
          touchZoom: true,
          dragging: true,
          doubleClickZoom: true
        });
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            subdomains: "abcd",
            maxZoom: 20,
            detectRetina: true,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          }
        ).addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);
        map.on("click", (event: Leaflet.LeafletMouseEvent) => {
          if (disabledRef.current || !onGuessRef.current) return;
          onGuessRef.current({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng
          });
        });
        mapRef.current = map;
        requestAnimationFrame(() => map.invalidateSize());
        setReady(true);
      } catch (error) {
        console.error("[InteractiveGuessMap] Leaflet failed to initialize.", error);
        setLoadError(true);
      }
    }
    setup();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!L || !map || !layer || !ready) return;
    layer.clearLayers();
    const points: Leaflet.LatLngExpression[] = [];

    if (guess) {
      const icon = L.divIcon({
        className: "minefield-map-marker",
        html: '<span class="minefield-map-pin minefield-map-pin--guess"></span>',
        iconSize: [28, 36],
        iconAnchor: [14, 34]
      });
      L.marker([guess.latitude, guess.longitude], { icon, keyboard: false })
        .bindTooltip("Your pin", { direction: "top", offset: [0, -28] })
        .addTo(layer);
      points.push([guess.latitude, guess.longitude]);
    }

    if (correct) {
      const icon = L.divIcon({
        className: "minefield-map-marker",
        html: '<span class="minefield-map-pin minefield-map-pin--correct">✓</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([correct.latitude, correct.longitude], { icon, keyboard: false })
        .bindTooltip("Correct location", { direction: "top", offset: [0, -14] })
        .addTo(layer);
      points.push([correct.latitude, correct.longitude]);
    }

    if (guess && correct) {
      L.polyline(
        [[guess.latitude, guess.longitude], [correct.latitude, correct.longitude]],
        { color: "#6558d3", weight: 2, dashArray: "6 7", opacity: 0.8 }
      ).addTo(layer);
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 7, animate: false });
    }
  }, [correct, guess, ready]);

  return (
    <div
      role="application"
      aria-label={label}
      className={`relative aspect-[2/1] min-h-44 w-full overflow-hidden rounded-2xl border border-slate-300 bg-[#dceefa] shadow-inner dark:border-[#454c5a] dark:bg-[#172534] ${
        disabled ? "" : "cursor-crosshair"
      }`}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {!ready && !loadError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100 text-xs font-bold text-slate-500 dark:bg-[#20242c]">
          Loading high-definition map…
        </div>
      )}
      {loadError && (
        <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-slate-100 px-5 text-center text-sm font-bold text-slate-600 dark:bg-[#20242c] dark:text-slate-300">
          The map could not load. Check your connection and try again.
        </div>
      )}
      {!guess && !disabled && ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] text-center">
          <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-md dark:bg-[#20242c]/95 dark:text-white">
            Tap to place · pinch or scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}
