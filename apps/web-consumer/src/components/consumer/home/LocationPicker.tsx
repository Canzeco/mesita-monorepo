"use client";

// Home's location control — the whole of Home's header, in Search's row
// shape (Pato, MESITA-2452 "put locations as scrollable in bar", then
// MESITA-2453 "the add and the current location must be kinda fixed"):
//
//   ( ⌖ ) [ (🔖 Home ×) (🔖 Office) …  scrolls ] ( ＋ )
//
// Pinned left, the Current location disc: ink while it is the active one,
// the held-fix dot otherwise; with no fix a tap asks for one. Between, the
// saved locations scroll (the active one is the ink chip with × to remove
// it, back to Current location); with none saved, a muted line names the
// active location. Pinned right, ＋ opens AddLocationSheet. The choice lives
// in `lib/active-location.ts`, which Home's catalog reads.

import { useState } from "react";
import { Navigation, Plus, X } from "lucide-react";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { removeSavedLocation, useSavedLocations } from "@/lib/saved-locations";
import { setActiveLocation, useActiveLocation } from "@/lib/active-location";
import { cn } from "@/lib/utils";
import { ActiveDot } from "@/components/consumer/search/ActiveDot";
import {
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  HEADER_DISC,
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
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setActiveLocation(null);
            if (coords === null) locate();
          }}
          aria-pressed={hereOn}
          aria-label={locationLabel(null, coords !== null, locating)}
          title={locationLabel(null, coords !== null, locating)}
          className={cn(
            "relative",
            HEADER_DISC,
            hereOn &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary",
          )}
          data-home-location
        >
          <Navigation
            className={cn("h-4 w-4 shrink-0", locating && "animate-pulse")}
            strokeWidth={2}
            aria-hidden
          />
          {!hereOn && coords !== null ? <ActiveDot /> : null}
        </button>
        <nav
          aria-label="Saved locations"
          className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain"
          data-places-location
        >
          {savedLocations.length === 0 ? (
            <span className="text-muted-foreground truncate px-1 text-sm font-semibold">
              {locationLabel(active, coords !== null, locating)}
            </span>
          ) : null}
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
        </nav>
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add location"
          title="Add location"
          className={HEADER_DISC}
          data-places-add-location
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </div>

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
