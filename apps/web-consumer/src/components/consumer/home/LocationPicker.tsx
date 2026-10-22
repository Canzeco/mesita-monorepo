"use client";

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
// A tap opens the location sheet (MESITA-2464): a search field on top, then
// Current location, "Around you" (MESITA-2471: the areas the guest stands
// in) and the guest's saved locations. EVERY SAVED LOCATION IS A CONFIRMED
// PIN (Pato, 2026-10-20, MESITA-2501): a match, an "Around you" row, a
// saved row's pencil and an old unconfirmed entry all open the pin picker
// (`PinPicker.tsx`) in the same sheet; nothing is saved until the guest
// confirms the pin. Saved areas (MESITA-2383) are gone. The choice lives in
// `lib/active-location.ts`, which Home's catalog reads.

import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  ChevronDown,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  Pencil,
  Search,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useHere } from "@/lib/use-here-name";
import type { NearbyArea } from "@/lib/api/place-search";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { aroundYouCamera, pickCamera, type PickerCamera } from "@/lib/location-pick";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import {
  useLocateUser,
  useUserLocation,
  useUserLocationLocating,
  useUserLocationSettled,
} from "@/lib/use-user-location";
import {
  displayName,
  evictionFor,
  useSavedLocations,
  type SavedLocation,
} from "@/lib/saved-locations";
import {
  savedLocationKey,
  setActiveLocation,
  useActiveLocation,
  useActiveLocationKey,
} from "@/lib/active-location";
import { PinPicker, type PinPickerMode } from "@/components/consumer/home/PinPicker";
import { cn, errMsg } from "@/lib/utils";

/** Home's location control (MESITA-2480): a 36px rounded box on the white
 *  header (MESITA-2531) — the side rail's grey, no outline, ink text. */
export const HOME_LOCATION_CLASS =
  "border-transparent bg-muted text-foreground hover:bg-border focus-visible:ring-ring ml-auto flex h-9 max-w-[65%] min-w-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 active:scale-[0.98]";

/** The box's word when Current location is chosen and the device has none. */
export const NO_LOCATION_LABEL = "No location";

/** The box's colour in that state (MESITA-2610): the app's one status red,
 *  the Toaster's and ReservationSheet's pairing. Only the colour changes;
 *  the geometry stays `HOME_LOCATION_CLASS`. */
export const HOME_LOCATION_OFF_CLASS =
  "bg-destructive/10 text-destructive hover:bg-destructive/15";

/** What the pill says: the saved name, or the state of the device fix. The
 *  sheet's row adds the neighbourhood once known (MESITA-2466): "Current
 *  location · Distrito Tec"; the header oval never passes one. */
export function locationLabel(
  active: { name: string } | null,
  hasFix: boolean,
  locating: boolean,
  hereName: string | null = null,
): string {
  if (active) return active.name;
  if (hasFix) return hereName ? `Current location · ${hereName}` : "Current location";
  return locating ? "Locating…" : "Use my location";
}

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

const ICON = "h-4 w-4 shrink-0";

/** The grey word at the end of an "Around you" row (MESITA-2471). */
const AREA_LEVEL_WORD: Record<NearbyArea["level"], string> = {
  neighborhood: "Neighborhood",
  district: "District",
  city: "City",
};

/** "Around you" (MESITA-2471, Instagram's Add location): the areas around
 *  the guest, minus any already saved under the same display name. */
export function aroundYouRows(
  areas: readonly NearbyArea[],
  saved: readonly Pick<SavedLocation, "customName" | "suggestedName">[],
): NearbyArea[] {
  const savedNames = new Set(saved.map((l) => displayName(l).trim().toLowerCase()));
  return areas.filter((a) => !savedNames.has(a.name.trim().toLowerCase()));
}

/** A saved pin reopened in the picker. */
const SAVED_PIN_ZOOM = 16;

type PickerTarget = {
  mode: PinPickerMode;
  camera: PickerCamera;
  entry: SavedLocation | null;
};

export function LocationPicker() {
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const settled = useUserLocationSettled();
  const active = useActiveLocation();
  const activeKey = useActiveLocationKey();
  const savedLocations = useSavedLocations();
  const supabase = useBrowserSupabase();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Google bills Autocomplete per session: one token until a pick or close.
  const [token, setToken] = useState(newSessionToken);
  const { label, off } = headerLocation(active, coords !== null, locating, settled);
  // Asked only while the sheet is open, once per ~110 m (MESITA-2466): the
  // neighbourhood for the Current location row and the "Around you" areas
  // (MESITA-2471). An area already saved shows once, as the saved row.
  const here = useHere(coords, picking);
  const hereName = here.name;
  const aroundYou = aroundYouRows(here.areas, savedLocations);
  const typing = query.trim().length >= 2;
  const activeId = activeKey?.startsWith("saved:") ? activeKey.slice(6) : null;
  const listFull = evictionFor(savedLocations, activeId) === undefined;

  // Search after a short pause; the newest query wins. With no fix the
  // search leans on Monterrey (MESITA-2501): an unbiased "San Pedro" once
  // came back as San Pedro, Coahuila.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await apiSuggestPlaces(supabase, q, token, coords ?? MONTERREY_CENTER);
        if (!cancelled) {
          setResults(rows.slice(0, 8));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, "Couldn't search right now."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // `coords` only biases the ranking; a new fix should not re-run a search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, query]);

  const close = () => {
    setPicking(false);
    setPicker(null);
    setQuery("");
    setResults([]);
    setError(null);
    setResolving(null);
    setToken(newSessionToken());
  };

  /** Back from the picker: to the results (query kept) or the list. */
  const back = () => setPicker(null);

  const pick = async (r: PlacePrediction) => {
    setError(null);
    setResolving(r.placeId);
    try {
      setPicker({ mode: "new", camera: await pickCamera(supabase, r), entry: null });
    } catch (err) {
      console.warn("[pin-picker] anchor_failed", {
        code: err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : null,
      });
      setError("Couldn't open that place");
    } finally {
      setResolving(null);
      // Google bills a session per pick; the next search starts a new one.
      setToken(newSessionToken());
    }
  };

  const openSaved = (l: SavedLocation, mode: PinPickerMode) =>
    setPicker({ mode, camera: { center: { lat: l.lat, lng: l.lng }, zoom: SAVED_PIN_ZOOM }, entry: l });

  const row = (r: {
    key: string;
    label: string;
    detail?: string | null;
    icon: ReactNode;
    selected: boolean;
    onClick: () => void;
    muted?: boolean;
    trailing?: ReactNode;
  }) => (
    <li key={r.key} className="relative">
      <button
        type="button"
        onClick={r.onClick}
        aria-pressed={r.selected}
        className={cn(
          "flex w-full items-center gap-3 py-3.5 pr-12 text-left text-sm transition",
          r.selected ? "font-semibold" : "hover:bg-muted",
          r.muted && !r.selected && "text-muted-foreground",
        )}
      >
        {r.icon}
        <span className="min-w-0">
          <span className="block truncate">{r.label}</span>
          {r.detail ? (
            <span className="text-muted-foreground block truncate text-xs font-normal">{r.detail}</span>
          ) : null}
        </span>
      </button>
      {r.trailing}
    </li>
  );

  return (
    <>
      {/* The header's right side, beside the logo (MESITA-2473, "A · Quiet"):
          plain text — pin, name, a muted chevron — with no fill and no
          outline. The tap target stays 44px tall; the name truncates. */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        aria-label={`Location: ${label}. Change location`}
        className={cn(HOME_LOCATION_CLASS, off && HOME_LOCATION_OFF_CLASS)}
        data-home-location
      >
        {off ? (
          <MapPinOff className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        ) : (
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        )}
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0", off ? "text-destructive" : "text-muted-foreground")}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>

      {/* While the pin picker is open, the backdrop and Escape act as Back:
          they never close the sheet and drop the pin. */}
      <LocalSheet open={picking} onClose={picker ? back : close} ariaLabel="Location">
        {picker ? (
          <PinPicker
            key={`${picker.mode}:${picker.entry?.id ?? ""}:${picker.camera.center.lat},${picker.camera.center.lng}`}
            mode={picker.mode}
            camera={picker.camera}
            entry={picker.entry}
            activeKey={activeKey}
            listFull={listFull}
            onBack={back}
            onDone={close}
          />
        ) : (
        <div className={SHEET_BODY_CLASS} data-places-location-sheet>
          <h2 className={SHEET_TITLE_CLASS}>Location</h2>
          <label className="relative mt-3 block">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              placeholder="Search a city, neighborhood or address"
              aria-label="Search a location"
              enterKeyHint="search"
              autoComplete="off"
              className={cn(INPUT_CLASS, "pl-9")}
              data-places-location-search
            />
          </label>
          {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

          {typing ? (
            <ul
              role="list"
              aria-label="Matches"
              className="divide-border mt-2 divide-y"
              data-places-location-results
            >
              {results.map((r) => (
                <li key={r.placeId}>
                  <button
                    type="button"
                    disabled={resolving !== null}
                    onClick={() => void pick(r)}
                    className="hover:bg-muted flex w-full items-center gap-3 py-3 text-left transition"
                  >
                    {resolving === r.placeId ? (
                      <Loader2 className={cn(ICON, "animate-spin")} aria-hidden />
                    ) : (
                      <MapPin className={ICON} strokeWidth={2.25} aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {r.mainText}
                      </span>
                      {r.secondaryText ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {r.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? (
                <li className="text-muted-foreground py-3 text-xs">
                  {searching ? "Searching…" : "No matches yet"}
                </li>
              ) : null}
            </ul>
          ) : (
          <ul
            role="list"
            aria-label="Location"
            className="divide-border mt-2 divide-y"
            data-places-location
          >
            {row({
              key: "here",
              label: locationLabel(null, coords !== null, locating, hereName),
              icon: (
                <Navigation className={ICON} strokeWidth={2.25} aria-hidden />
              ),
              selected: active === null && coords !== null,
              muted: coords === null,
              onClick: () => {
                setActiveLocation(null);
                if (coords === null) locate();
                close();
              },
            })}
            {aroundYou.length > 0 ? (
              <li
                className="text-muted-foreground pt-4 pb-1 text-xs font-semibold"
                data-places-around-you
              >
                Around you
              </li>
            ) : null}
            {aroundYou.map((a) => (
              <li key={`around:${a.name}`}>
                <button
                  type="button"
                  onClick={() => setPicker({ mode: "new", camera: aroundYouCamera(a), entry: null })}
                  className="hover:bg-muted flex w-full items-center gap-3 py-3 text-left transition"
                  data-places-around-area
                >
                  <MapPin className={ICON} strokeWidth={2.25} aria-hidden />
                  <span className="min-w-0 truncate text-sm">{a.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    {AREA_LEVEL_WORD[a.level]}
                  </span>
                </button>
              </li>
            ))}
            {savedLocations.map((l) =>
              row({
                key: savedLocationKey(l.id),
                label: displayName(l),
                detail: l.formattedAddress,
                icon: (
                  <Bookmark className={ICON} strokeWidth={2.25} aria-hidden />
                ),
                selected: activeKey === savedLocationKey(l.id) && !l.unconfirmed,
                muted: l.unconfirmed,
                // An old entry no one confirmed on a map opens the picker
                // first; it never drives a search before that.
                onClick: () => {
                  if (l.unconfirmed) {
                    openSaved(l, "confirm");
                    return;
                  }
                  setActiveLocation(savedLocationKey(l.id));
                  close();
                },
                trailing: l.unconfirmed ? (
                  <span
                    className="bg-muted text-foreground pointer-events-none absolute inset-y-0 right-0 my-auto flex h-7 items-center rounded-full px-3 text-xs font-semibold"
                    data-places-confirm-location
                  >
                    Confirm
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSaved(l, "edit")}
                    aria-label={`Edit ${displayName(l)}`}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
                    data-places-edit-location
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </button>
                ),
              }),
            )}
          </ul>
          )}
        </div>
        )}
      </LocalSheet>
    </>
  );
}
