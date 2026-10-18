"use client";

// Home's location control — the whole of Home's header (Pato, MESITA-2405:
// "The top bar is just to select the location. thats it."): a full-width
// bordered pill with a pin, the active location's name and a quiet chevron.
// A tap opens the location sheet: Current location, the guest's saved
// locations (each removable) and Add location (MESITA-2380). The choice
// lives in `lib/active-location.ts`, which Home's catalog reads.

import { useState, type ReactNode } from "react";
import { Bookmark, ChevronDown, MapPin, Navigation, Plus, X } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { removeSavedLocation, useSavedLocations } from "@/lib/saved-locations";
import { setActiveLocation, useActiveLocation } from "@/lib/active-location";
import { cn } from "@/lib/utils";
import { AddLocationSheet } from "./AddLocationSheet";

/** What the pill says: the saved name, or the state of the device fix. */
export function locationLabel(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
): string {
  if (active) return active.name;
  if (hasFix) return "Current location";
  return locating ? "Locating…" : "Use my location";
}

const ICON = "h-4 w-4 shrink-0";

export function LocationPicker() {
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const active = useActiveLocation();
  const savedLocations = useSavedLocations();
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const label = locationLabel(active, coords !== null, locating);

  const row = (r: {
    key: string;
    label: string;
    icon: ReactNode;
    selected: boolean;
    onClick: () => void;
    muted?: boolean;
    onRemove?: () => void;
  }) => (
    <li key={r.key} className="relative">
      <button
        type="button"
        onClick={r.onClick}
        aria-pressed={r.selected}
        className={cn(
          "flex w-full items-center gap-3 py-3.5 pr-10 text-left text-sm transition",
          r.selected ? "font-semibold" : "hover:bg-muted",
          r.muted && !r.selected && "text-muted-foreground",
        )}
      >
        {r.icon}
        <span className="min-w-0 truncate">{r.label}</span>
      </button>
      {r.onRemove ? (
        <button
          type="button"
          onClick={r.onRemove}
          aria-label={`Remove ${r.label}`}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
          data-places-remove-location
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </li>
  );

  return (
    <>
      {/* Home's whole header: the location, full width (MESITA-2405). */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        aria-label={`Location: ${label}. Change location`}
        className="border-border bg-card text-foreground hover:bg-muted flex h-10 w-full min-w-0 items-center gap-1.5 rounded-full border px-3 text-left text-xs font-semibold transition active:scale-[0.98]"
        data-home-location
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className="text-muted-foreground h-3.5 w-3.5 shrink-0"
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <LocalSheet open={picking} onClose={() => setPicking(false)} ariaLabel="Location">
        <div className={SHEET_BODY_CLASS} data-places-location-sheet>
          <h2 className={SHEET_TITLE_CLASS}>Location</h2>
          <ul role="list" aria-label="Location" className="divide-border mt-2 divide-y" data-places-location>
            {row({
              key: "here",
              label: locationLabel(null, coords !== null, locating),
              icon: <Navigation className={ICON} strokeWidth={2.25} aria-hidden />,
              selected: active === null && coords !== null,
              muted: coords === null,
              onClick: () => {
                setActiveLocation(null);
                if (coords === null) locate();
                setPicking(false);
              },
            })}
            {savedLocations.map((l) =>
              row({
                key: `saved:${l.id}`,
                label: l.name,
                icon: <Bookmark className={ICON} strokeWidth={2.25} aria-hidden />,
                selected: active?.key === `saved:${l.id}`,
                onClick: () => {
                  setActiveLocation({ key: `saved:${l.id}`, name: l.name, lat: l.lat, lng: l.lng, bounds: l.bounds });
                  setPicking(false);
                },
                // Removing the active location falls back to Current location.
                onRemove: () => {
                  removeSavedLocation(l.id);
                  if (active?.key === `saved:${l.id}`) setActiveLocation(null);
                },
              }),
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  setPicking(false);
                  setAdding(true);
                }}
                className="hover:bg-muted flex w-full items-center gap-3 py-3.5 text-left text-sm transition"
                data-places-add-location
              >
                <Plus className={ICON} strokeWidth={2.25} aria-hidden />
                <span>Add location</span>
              </button>
            </li>
          </ul>
        </div>
      </LocalSheet>

      <AddLocationSheet
        open={adding}
        onClose={() => setAdding(false)}
        here={coords}
        onSaved={(l) =>
          setActiveLocation({ key: `saved:${l.id}`, name: l.name, lat: l.lat, lng: l.lng, bounds: l.bounds })
        }
      />
    </>
  );
}
