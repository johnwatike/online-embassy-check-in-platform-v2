"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, TileLayer } from "leaflet";
import type { MapPoint } from "@/lib/staff-data";
import { WELLBEING } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { cx } from "@/components/ui";

const MARKER_FILL: Record<string, string> = {
  safe: "#006600",
  need_assistance: "#bb0000",
  plans_changed: "#c99700",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Free tile providers (all attribution-compliant, loaded over HTTPS). */
const TILE_PROVIDERS = [
  {
    id: "voyager",
    label: "Map",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
  },
];

export function CheckinMap({ points }: { points: MapPoint[] }) {
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [providerId, setProviderId] = useState(TILE_PROVIDERS[0].id);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let alive = true;
    import("leaflet").then((L) => {
      if (!alive) return;
      const el = document.getElementById("checkin-map");
      if (!el) return;
      leafletRef.current = L;
      const map = L.map(el, { scrollWheelZoom: true, worldCopyJump: true });
      map.setView([20, 15], 2);
      mapRef.current = map;
      const bounds: [number, number][] = [];
      for (const p of points) {
        const latLng: [number, number] = [p.lat, p.lng];
        bounds.push(latLng);
        const marker = L.circleMarker(latLng, {
          radius: 8,
          weight: 2,
          color: "#ffffff",
          fillColor: MARKER_FILL[p.wellbeing ?? ""] ?? "#0a1f44",
          fillOpacity: 0.92,
        });
        const statusLabel = p.wellbeing
          ? WELLBEING[p.wellbeing as keyof typeof WELLBEING]?.short ?? p.wellbeing
          : p.status === "active"
            ? "No update"
            : "Upcoming";
        marker.bindTooltip(`${p.citizen}${p.approx ? " (approximate)" : ""} — ${statusLabel}`);
        marker.bindPopup(
          `<div style="min-width:180px;font-size:13px;line-height:1.45"><strong>${esc(p.citizen)}</strong><br/>` +
            `${esc(p.place)}${p.approx ? " · approximate" : ""}<br/>` +
            `<span style="color:#475569">Ref ${esc(p.ref)}</span><br/>` +
            `${esc(fmtDate(p.arrival))} → ${p.departure ? esc(fmtDate(p.departure)) : "open"}` +
            (p.lodging ? `<br/><em>${esc(p.lodging)}</em>` : "") +
            `</div>`,
        );
        marker.addTo(map);
      }
      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 10 });
      }
      setMapReady(true);
    });
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;
    const provider = TILE_PROVIDERS.find((t) => t.id === providerId) ?? TILE_PROVIDERS[0];
    tileRef.current?.remove();
    tileRef.current = L.tileLayer(provider.url, { attribution: provider.attribution, maxZoom: 19 }).addTo(map);
  }, [providerId, mapReady]);

  return (
    <div className="relative z-0 overflow-hidden rounded-2xl border border-navy-200 bg-navy-100">
      <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-lg border border-navy-200 bg-white shadow-md" role="group" aria-label="Map style">
        {TILE_PROVIDERS.map((t) => (
          <button
            key={t.id}
            onClick={() => setProviderId(t.id)}
            className={cx("px-3 py-1.5 text-xs font-semibold transition", providerId === t.id ? "bg-mfa-navy text-white" : "text-navy-700 hover:bg-navy-100")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="checkin-map" aria-label="Map of citizen check-in locations" role="img" className="h-[520px] w-full" />
      <noscript>
        <div className="p-4 text-sm text-navy-700">Enable JavaScript to see the interactive map.</div>
      </noscript>
    </div>
  );
}
