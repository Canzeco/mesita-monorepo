"use client";

// NO LOCATION, NO MESITA (Pato, 2026-11-21, MESITA-4589: "YOU CANNOT USE
// MESITA IF YOU DON'T SELECT A LOCATION … IT DOESN'T MATTER WHICH ONE. JUST
// ASK FOR LOCATION AND WHEN CLICK, THEN DISPLAY LOCATIONS MODAL TO ADD
// LOCATION"). Once the browser has answered its first ask, a guest with no
// point (no device fix, no chosen saved location) sees one full-screen ask
// over Home and Search (their screen, under the tab bar): one dark
// "Choose location" button. Pay, Me and the rest never ask. The button opens the locations sheet,
// the header sheet's own body (LocationChooser: Current location, saved
// locations, Add a location, search). Any choice makes a point and the
// ask goes. It replaces Home's inline chooser (MESITA-4542, MESITA-4585).
//
//   no first answer yet → nothing (the screen under it loads as before)
//   no point            → the ask, and the sheet on its button
//   a point             → nothing

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MapPin } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  LocationChooser,
  takeLastChoiceSource,
  type PickerTarget,
} from "@/components/consumer/home/LocationChooser";
import { useActiveLocation } from "@/lib/active-location";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation, useUserLocationSettled } from "@/lib/use-user-location";
import { PRIMARY_BUTTON_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { Z_LOCATION_GATE } from "@/lib/z-index";
import { cn } from "@/lib/utils";

/** Where a location is needed: Home and Search only (Pato, 2026-11-21:
 *  "location only needed for home and for search, not for all the app"). */
export function needsLocation(path: string): boolean {
  return path === "/home" || path.startsWith("/home/") || path === "/search" || path.startsWith("/search/");
}

/** The gate's page-load facts (MESITA-4542 eng review F1): the browser has
 *  answered its first ask, and each event fired once. `settled` goes false
 *  again during any later ask, so the ask must not flicker on a tap. */
const gate = { answered: false, shown: false, chosen: false };

function markAnswered(): void {
  gate.answered = true;
}

function markShown(): boolean {
  if (gate.shown) return false;
  gate.shown = true;
  return true;
}

function markChosen(): boolean {
  if (gate.chosen) return false;
  gate.chosen = true;
  return true;
}

export function LocationGate() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const settled = useUserLocationSettled();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // The latch: once the browser has answered, the ask stays on through a
  // later ask (which makes `settled` false again).
  const answered = settled || gate.answered;
  const hasPoint = (origin ?? coords) !== null;
  const here = needsLocation(usePathname() ?? "");
  const asking = here && answered && !hasPoint;
  const wasAsking = useRef(false);
  useEffect(() => {
    if (settled) markAnswered();
  }, [settled]);

  // Measured (MESITA-4542, V3): shown once per page load; chosen once, when
  // a point appears after the ask showed, by whatever route (the sheet, a
  // late device fix: no note = `device`).
  useEffect(() => {
    if (asking) {
      wasAsking.current = true;
      if (markShown()) trackEvent(supabase, "location_gate_shown", {});
      return;
    }
    if (hasPoint && wasAsking.current && markChosen()) {
      trackEvent(supabase, "location_gate_chosen", { source: takeLastChoiceSource() });
    }
  }, [asking, hasPoint, supabase]);

  if (!asking) return null;

  const close = () => {
    setOpen(false);
    setPicker(null);
  };

  return (
    <div
      className={cn("bg-background absolute inset-0 flex flex-col items-center justify-center p-6", Z_LOCATION_GATE)}
      role="dialog"
      aria-modal="true"
      aria-label="Choose location"
      data-location-gate
    >
      {/* ONE BUTTON, NOTHING ELSE (Pato, 2026-11-21: "it must say choose
          location button, and then you click the button and you open a modal
          for the locations. Not all in one run"). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(PRIMARY_BUTTON_CLASS, "max-w-xs")}
        aria-label="Choose location"
        data-location-gate-open
      >
        <MapPin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        Choose location
      </button>

      {/* The locations sheet: the header's own body. While its pin step is
          open, the backdrop and Escape act as Back. */}
      <LocalSheet open={open} onClose={picker ? () => setPicker(null) : close} ariaLabel="Location">
        <LocationChooser
          onDone={close}
          picker={picker}
          onPickerChange={setPicker}
          bodyClassName={SHEET_BODY_CLASS}
        />
      </LocalSheet>
    </div>
  );
}
