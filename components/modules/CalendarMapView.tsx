"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { Appointment, AppointmentStatus } from "@/types";

const PIN_COLOR: Record<AppointmentStatus, string> = {
  confirmed:   "#00c468",
  showed:      "#3b82f6",
  cancelled:   "#ef4444",
  no_show:     "#f97316",
  unconfirmed: "#9ca3af",
  invalid:     "#9ca3af",
};

// Session-level geocode cache
const geoCache = new Map<string, google.maps.LatLngLiteral>();
let mapsInitialised = false;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildPinEl(apt: Appointment): HTMLDivElement {
  const color = PIN_COLOR[apt.status] ?? PIN_COLOR.unconfirmed;
  const time  = fmtTime(apt.start_time);
  const name  = apt.contact_name ?? apt.title;
  const label = name.length > 16 ? name.slice(0, 15) + "…" : name;

  const el = document.createElement("div");
  el.style.cssText = [
    `background:${color}`,
    "border-radius:24px",
    "padding:5px 12px",
    "color:#fff",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "white-space:nowrap",
    "box-shadow:0 2px 10px rgba(0,0,0,.22)",
    "cursor:pointer",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "gap:1px",
    "user-select:none",
    "-webkit-tap-highlight-color:transparent",
    "position:relative",
  ].join(";");
  el.innerHTML = `
    <span style="font-size:10px;font-weight:500;opacity:.85">${time}</span>
    <span style="font-size:12px;font-weight:700">${label}</span>
    <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
      width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
      border-top:6px solid ${color}"></div>
  `;
  return el;
}

async function ensureMaps() {
  if (mapsInitialised) return;
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    v: "weekly",
  });
  mapsInitialised = true;
}

export function CalendarMapView({
  appointments,
  onSelectAppt,
}: {
  appointments: Appointment[];
  onSelectAppt: (a: Appointment) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markersRef   = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [phase, setPhase] = useState<"loading" | "geocoding" | "ready" | "empty">("loading");

  const aptsWithAddr    = appointments.filter((a) =>  a.address?.trim());
  const aptsWithoutAddr = appointments.filter((a) => !a.address?.trim());

  useEffect(() => {
    if (aptsWithAddr.length === 0) {
      setPhase(appointments.length > 0 ? "ready" : "empty");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await ensureMaps();

        if (cancelled || !containerRef.current) return;

        // Init map once
        if (!mapRef.current) {
          const { Map } = (await importLibrary("maps")) as google.maps.MapsLibrary;
          mapRef.current = new Map(containerRef.current, {
            zoom: 12,
            center: { lat: 33.749, lng: -84.388 },
            mapId: "DEMO_MAP_ID",
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });
        }

        // Clear old markers
        markersRef.current.forEach((m) => { m.map = null; });
        markersRef.current = [];

        setPhase("geocoding");

        const { AdvancedMarkerElement } = (await importLibrary("marker")) as google.maps.MarkerLibrary;
        const geocoder = new google.maps.Geocoder();
        const placed: google.maps.LatLngLiteral[] = [];

        for (const apt of aptsWithAddr) {
          if (cancelled) return;
          const addr = apt.address!.trim();
          let pos = geoCache.get(addr);

          if (!pos) {
            try {
              const { results } = await geocoder.geocode({ address: addr });
              if (results[0]) {
                pos = {
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng(),
                };
                geoCache.set(addr, pos);
              }
            } catch { continue; }
          }

          if (!pos || cancelled) continue;

          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: pos,
            content: buildPinEl(apt),
            title: `${fmtTime(apt.start_time)} · ${apt.contact_name ?? apt.title}`,
            gmpClickable: true,
          });
          marker.addListener("click", () => onSelectAppt(apt));
          markersRef.current.push(marker);
          placed.push(pos);
        }

        if (cancelled) return;

        if (placed.length === 0) { setPhase("empty"); return; }

        if (placed.length === 1) {
          mapRef.current!.setCenter(placed[0]);
          mapRef.current!.setZoom(14);
        } else {
          const bounds = new google.maps.LatLngBounds();
          placed.forEach((p) => bounds.extend(p));
          mapRef.current!.fitBounds(bounds, 64);
        }
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("empty");
      }
    })();

    return () => { cancelled = true; };
  }, [appointments]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
          <p className="text-sm text-text-secondary">Loading map…</p>
        </div>
      )}
      {phase === "geocoding" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-medium text-text-secondary shadow-md">
          Pinning addresses…
        </div>
      )}
      {phase === "empty" && appointments.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
          <span className="text-3xl">📍</span>
          <p className="font-semibold text-text-primary">No job addresses for this day</p>
          <p className="text-sm text-text-secondary">
            Add an address when creating an appointment and it will appear as a pin here.
          </p>
        </div>
      )}

      {/* Appointments without an address — shown as a tappable strip */}
      {aptsWithoutAddr.length > 0 && phase !== "loading" && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-line bg-white/95 backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {aptsWithoutAddr.map((apt) => (
              <button
                key={apt.id}
                type="button"
                onClick={() => onSelectAppt(apt)}
                className="flex min-w-[130px] flex-shrink-0 flex-col rounded-xl border border-line bg-bg px-3 py-2 text-left transition active:scale-[0.97]"
              >
                <span className="text-[10px] text-text-secondary">{fmtTime(apt.start_time)}</span>
                <span className="max-w-[118px] truncate text-xs font-semibold text-text-primary">
                  {apt.contact_name ?? apt.title}
                </span>
                <span className="mt-0.5 text-[10px] text-text-secondary">No address</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
