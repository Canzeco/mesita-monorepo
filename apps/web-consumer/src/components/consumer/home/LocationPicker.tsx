"use client";

import { LocationModal } from "@/components/consumer/home/LocationModal";
// Home's location control — the whole of Home's header (Pato, MESITA-2405:
// "The top bar is just to select the location. thats it."): since
// MESITA-2476 (Pato: "location must be inside a box or something") a
// rounded box on the header's right; MESITA-2480 made it quiet on the white
// header again: a grey fill, ink text — a pin, the active location's name
// and a muted chevron. MESITA-2483 (Pato: "a bit darker … to contrast")
// took the fill one step past the page grey, to the border grey; MESITA-2485
// (Pato: "lighter, just as the lateral bar") set it to the side rail's grey.
// History: plain text (MESITA-2473), a full-width bordered bar (MESITA-2405), a chip row with discs
// (MESITA-2452..2454), a borderless line (MESITA-2456), an oval
// (MESITA-2459), beside the logo (MESITA-2470).
//
// A tap opens the location sheet (MESITA-2464): a search field over ONE card
// of rows (MESITA-2945, Pato: "all in one box") — Current location with its
// neighbourhood, each saved pin with its address, and "Add a location", the
// visible way to save one. MESITA-2919's bare lines read as nothing. "Around you"
// (MESITA-2471) is gone: it repeated Current location's own neighbourhood.
// EVERY SAVED LOCATION IS A CONFIRMED PIN (Pato, 2026-10-20, MESITA-2501): a
// match, a saved row's pencil and an old unconfirmed entry all open the pin picker
// (`PinPicker.tsx`) in the same sheet; nothing is saved until the guest
// confirms the pin. Saved areas (MESITA-2383) are gone. The choice lives in
// `lib/active-location.ts`, which Home's catalog reads.

import { useState } from "react";
import { ChevronDown, MapPin, MapPinOff } from "lucide-react";
import {
  useUserLocation,
  useUserLocationLocating,
  useUserLocationSettled,
} from "@/lib/use-user-location";
import { useActiveLocation } from "@/lib/active-location";
import {
  locationLabel,
  type PickerTarget,
} from "@/components/consumer/home/LocationChooser";
import { cn } from "@/lib/utils";

/** Home's location control (MESITA-2480): a 36px rounded box on the white
 *  header (MESITA-2531) — grey, no outline, ink text. GREY AGAIN (Pato,
 *  MESITA-4441: "put it in a gray box without borders, as prev versions"):
 *  MESITA-4434's white bordered box lasted a day. THE TABS' TYPE (Pato,
 *  2026-11-23, MESITA-4749: "location top right font must be same size as
 *  places and social"): 16px text and 18px icons like Places | Social, 40px
 *  tall (36px with 14px text before). */
export const HOME_LOCATION_CLASS =
  "border-transparent bg-muted text-foreground hover:bg-border focus-visible:ring-ring ml-auto flex h-10 max-w-[65%] min-w-0 items-center gap-1.5 rounded-xl border px-3 text-base font-semibold outline-none transition focus-visible:ring-2 active:scale-[0.98]";

/** The box's word when Current location is chosen and the device has none. */
export const NO_LOCATION_LABEL = "No location";

/** The box's colour in that state (MESITA-2610): the app's one status red,
 *  the Toaster's and ReservationSheet's pairing. Only the colour changes;
 *  the geometry stays `HOME_LOCATION_CLASS`. */
export const HOME_LOCATION_OFF_CLASS =
  "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/15";

/** What the pill says: the saved name, or the state of the device fix
 *  (LocationChooser's `locationLabel`, MESITA-2466). */
export { locationLabel };

/** The header box. Once the browser has answered with no fix and nothing is
 *  saved, the box says "No location" in red behind a crossed-out pin
 *  (MESITA-2610, Pato: "if location cannot be shown … mention like no
 *  location"; it read "Monterrey" under MESITA-2587). Home still ranks
 *  around the Monterrey centre. A saved location never shows the failure,
 *  and neither does an ask still in flight or an older fix still held. */
export function headerLocation(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
  settled: boolean,
): { label: string; off: boolean } {
  if (!active && !hasFix && !locating && settled)
    return { label: NO_LOCATION_LABEL, off: true };
  return { label: locationLabel(active, hasFix, locating), off: false };
}

/** `list`: Pay's Current location bar, its own black bar. The header box
 *  everywhere else. Pay's lists do not show it (MESITA-4969): Home's location
 *  is the one they use. */
export function LocationPicker({ list = false }: { list?: boolean } = {}) {
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const settled = useUserLocationSettled();
  const active = useActiveLocation();
  const [picking, setPicking] = useState(false);
  // The pin step, owned here so the backdrop and Escape act as Back
  // (they never close the sheet and drop the pin).
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const { label, off } = headerLocation(active, coords !== null, locating, settled);

  const close = () => {
    setPicking(false);
    setPicker(null);
  };

  return (
    <>
      {/* The header's right side, beside the logo (MESITA-2473, "A · Quiet"):
          pin, name, a muted chevron. The tap target stays 44px tall; the
          name truncates. */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        aria-label={`Location: ${label}. Change location`}
        className={
          list
            ? "bg-foreground text-background focus-visible:ring-background flex h-12 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-2xl px-3 text-base font-semibold outline-none transition hover:opacity-80 focus-visible:ring-2"
            : cn(HOME_LOCATION_CLASS, off && HOME_LOCATION_OFF_CLASS)
        }
        data-home-location
      >
        {off ? (
          <MapPinOff className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        ) : (
          // INK, NEVER BLUE (Pato, 2026-11-15, MESITA-4039).
          <MapPin className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
        )}
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0", list ? "opacity-70" : off ? "text-destructive" : "text-muted-foreground")}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>

      {/* The floating location modal (MESITA-4628); its body is
          LocationChooser (MESITA-4542), the one Places shows inline. */}
      <LocationModal open={picking} onClose={close} picker={picker} onPickerChange={setPicker} />
    </>
  );
}
