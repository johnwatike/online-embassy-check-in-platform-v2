"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapPoint } from "@/lib/staff-data";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Wellbeing → marker colour (Kenya palette). */
const COLOR: Record<string, string> = {
  safe: "#006600",
  need_assistance: "#bb0000",
  plans_changed: "#c99700",
};

/**
 * Interactive Leaflet map of citizen check-ins for the staff portal.
 * Tiles load from openstreetmap.org in the viewer's browser; if they can't load,
 * the markers still render on a plain backdrop and the list below the map
 * always shows every location.
 */
export function CheckinMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { worldCopyJump: true, scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      for (const p of pts) {
        L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: COLOR[p.wellbeing ?? ""] ?? "#0a1f44",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<strong>${esc(p.citizen)}</strong><br/>` +
              `${esc(p.place)}${p.approx ? " <em>(approximate)</em>" : ""}<br/>` +
              `${esc(p.ref)} · ${p.status === "active" ? "checked in" : "upcoming"} · ${esc(p.arrival)}${p.departure ? ` → ${esc(p.departure)}` : ""}` +
              (p.lodging ? `<br/>🏨 ${esc(p.lodging)}` : ""),
          )
          .bindTooltip(`${esc(p.citizen)} – ${esc(p.place)}`)
          .addTo(map);
      }
      if (pts.length) {
        map.fitBounds(
          L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [28, 28], maxZoom: 10 },
        );
      } else {
        map.setView([10, 20], 2);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return (
    <div
      ref={ref}
      className="relative z-0 h-[420px] w-full rounded-2xl border border-navy-200 bg-navy-50 sm:h-[520px]"
      role="img"
      aria-label={`Map of ${points.length} citizen check-in locations`}
    />
  );
}
