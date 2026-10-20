"use client";

// Home's location control — the whole of Home's header, as one scrolling
// row of chips in Search's chip tokens (Pato, MESITA-2452: "put locations as
// scrollable in bar … the space is not being optimally used"; it was a
// full-width pill opening a sheet, MESITA-2405/2380):
//
//   (📍 Current location) (🔖 Home ×) (🔖 Office) (＋ Add)
//
// One tap switches; the active one is the ink chip. Current location with
// no fix asks for one. The active saved chip carries × to remove it, which
// falls back to Current location. ＋ Add opens AddLocationSheet. The choice
// lives in `lib/active-location.ts`, which Home's catalog reads.

import { useState } from "react";
import { X } from "lucide-react";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { removeSavedLocation, useSavedLocations } from "@/lib/saved-locations";
import { setActiveLocation, useActiveLocation } from "@/lib/active-location";
import { cn } from "@/lib/utils";
import {
  CHIP,
  CHIP_OFF,
  CHIP_ON,
} from "@/components/consumer/search/header-classes";
import { AddLocationSheet } from "./AddLocationSheet";

/** What the device-fix chip says: the state of the fix (or a saved name). */
export function locationLabel(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
): string {
  if (active) return active.name;
  if (hasFix) return "Current location";
  return locating ? "Locating…" : "Use my location";
}

export function LocationPicker() {
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const active = useActiveLocation();
  const savedLocations = useSavedLocations();
  const [adding, setAdding] = useState(false);
  const hereOn = active === null && coords !== null;

  return (
    <>
      <nav
        aria-label="Location"
        className="scrollbar-hide flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2"
        data-places-location
      >
        <button
          type="button"
          onClick={() => {
            setActiveLocation(null);
            if (coords === null) locate();
          }}
          aria-pressed={hereOn}
          className={cn(CHIP, hereOn ? CHIP_ON : CHIP_OFF)}
          data-home-location
        >
          <span aria-hidden>📍</span>
          <span>{locationLabel(null, coords !== null, locating)}</span>
        </button>
        {savedLocations.map((l) => {
          const key = `saved:${l.id}`;
          const pick = () =>
            setActiveLocation({
              key,
              name: l.name,
              lat: l.lat,
              lng: l.lng,
              bounds: l.bounds,
            });
          if (active?.key !== key) {
            return (
              <button
                key={key}
                type="button"
                onClick={pick}
                aria-pressed={false}
                className={cn(CHIP, CHIP_OFF)}
              >
                <span aria-hidden>🔖</span>
                <span>{l.name}</span>
              </button>
            );
          }
          // The active saved chip: its name, then × to remove it. Two
          // buttons side by side, never one inside the other.
          return (
            <div key={key} className={cn(CHIP, CHIP_ON, "pr-1")}>
              <button
                type="button"
                onClick={pick}
                aria-pressed
                className="flex items-center gap-1.5"
              >
                <span aria-hidden>🔖</span>
                <span>{l.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  // Removing the active location falls back to Current location.
                  removeSavedLocation(l.id);
                  setActiveLocation(null);
                }}
                aria-label={`Remove ${l.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-full opacity-80 hover:opacity-100"
                data-places-remove-location
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(CHIP, CHIP_OFF)}
          data-places-add-location
        >
          <span aria-hidden>＋</span>
          <span>Add</span>
        </button>
      </nav>

      <AddLocationSheet
        open={adding}
        onClose={() => setAdding(false)}
        here={coords}
        onSaved={(l) =>
          setActiveLocation({
            key: `saved:${l.id}`,
            name: l.name,
            lat: l.lat,
            lng: l.lng,
            bounds: l.bounds,
          })
        }
      />
    </>
  );
}
