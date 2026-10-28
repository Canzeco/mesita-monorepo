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

import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  SHEET_BODY_CLASS,
} from "@/lib/ui-classes";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useHere } from "@/lib/use-here-name";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { pickCamera, type PickerCamera } from "@/lib/location-pick";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import {
  useLocateUser,
  useOnUserFix,
  useUserLocation,
  useUserLocationError,
  useUserLocationLocating,
  useUserLocationSettled,
  LOCATION_HELP,
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
import {
  PIN_LIST_FULL,
  PinPicker,
  type PinPickerMode,
} from "@/components/consumer/home/PinPicker";
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

/** The sheet's one card (MESITA-2945, Pato: "all in one box"): every way to
 *  choose a location is a row in it, divided by hairlines. */
const CARD_CLASS =
  "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border";

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
  const locError = useUserLocationError();
  // The guest tapped "Use my location" with no fix: the sheet stays open
  // until the answer lands (MESITA-2615), then closes on a fix.
  const [wantFix, setWantFix] = useState(false);
  const active = useActiveLocation();
  // No row names a radius since MESITA-2914: the Catalog has none.
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
  // neighbourhood for the Current location row.
  const here = useHere(coords, picking);
  const hereName = here.name;
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
    setWantFix(false);
    setToken(newSessionToken());
  };

  // The fix the guest asked for landed: Current location is chosen already.
  useOnUserFix(() => {
    if (wantFix) close();
  });

  const locatingHere = coords === null && locating;
  const help = coords === null && !locating && locError ? LOCATION_HELP[locError] : null;

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

  /** One row of the sheet's card (MESITA-2945): an icon disc, a title, a
   *  muted second line, a check when chosen and an optional trailing control. */
  const row = (r: {
    key: string;
    title: string;
    sub?: string | null;
    icon: ReactNode;
    selected?: boolean;
    onClick: () => void;
    disabled?: boolean;
    muted?: boolean;
    trailing?: ReactNode;
    alert?: string | null;
  }) => (
    <li key={r.key} className="flex items-center">
      <button
        type="button"
        onClick={r.onClick}
        disabled={r.disabled}
        aria-pressed={r.selected}
        className="hover:bg-muted/60 flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
            r.selected ? "bg-foreground text-paper" : "bg-muted text-foreground",
          )}
          aria-hidden
        >
          {r.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-semibold",
              r.muted && "text-muted-foreground",
            )}
          >
            {r.title}
          </span>
          {r.alert ? (
            <span
              className="text-destructive mt-0.5 block text-xs"
              role="status"
              data-places-location-help
            >
              {r.alert}
            </span>
          ) : r.sub ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">{r.sub}</span>
          ) : null}
        </span>
        {r.selected ? (
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-label="Chosen" />
        ) : null}
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
          <label className="relative block">
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
              className={cn(CARD_CLASS, "mt-4")}
              data-places-location-results
            >
              {results.map((r) =>
                row({
                  key: r.placeId,
                  title: r.mainText,
                  sub: r.secondaryText,
                  icon:
                    resolving === r.placeId ? (
                      <Loader2 className={cn(ICON, "animate-spin")} />
                    ) : (
                      <MapPin className={ICON} strokeWidth={2.25} />
                    ),
                  disabled: resolving !== null,
                  onClick: () => void pick(r),
                }),
              )}
              {results.length === 0 ? (
                <li className="text-muted-foreground px-4 py-5 text-center text-sm">
                  {searching ? "Searching…" : "No matches yet"}
                </li>
              ) : null}
            </ul>
          ) : (
          <ul
            role="list"
            aria-label="Location"
            className={cn(CARD_CLASS, "mt-4")}
            data-places-location
          >
            {row({
              key: "here",
              title: locationLabel(null, coords !== null, locating),
              sub: coords !== null ? hereName : "Tap to share where you are",
              icon: locatingHere ? (
                <Loader2 className={cn(ICON, "animate-spin")} />
              ) : (
                <Navigation className={ICON} strokeWidth={2.25} />
              ),
              selected: active === null && coords !== null,
              muted: coords === null && !help,
              alert: help,
              // With a fix: choose it and close. Without one: ask and keep
              // the sheet open; a fix closes it, a failure says why above.
              onClick: () => {
                setActiveLocation(null);
                if (coords !== null) {
                  close();
                  return;
                }
                setWantFix(true);
                locate();
              },
            })}
            {savedLocations.map((l) =>
              row({
                key: savedLocationKey(l.id),
                title: displayName(l),
                sub: l.unconfirmed ? "Confirm this spot on the map" : l.formattedAddress,
                icon: <Bookmark className={ICON} strokeWidth={2.25} />,
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
                    className="bg-muted text-foreground pointer-events-none mr-4 flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold"
                    data-places-confirm-location
                  >
                    Confirm
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSaved(l, "edit")}
                    aria-label={`Edit ${displayName(l)}`}
                    className="text-muted-foreground hover:text-foreground mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition"
                    data-places-edit-location
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </button>
                ),
              }),
            )}
            {/* The visible way to save a spot (MESITA-2945): the picker
                opens on the device fix, else on Monterrey. */}
            {row({
              key: "add",
              title: "Add a location",
              sub: listFull ? PIN_LIST_FULL : "Home, work — any spot on the map",
              icon: <Plus className={ICON} strokeWidth={2.25} />,
              disabled: listFull,
              onClick: () =>
                setPicker({
                  mode: "new",
                  camera: { center: coords ?? MONTERREY_CENTER, zoom: SAVED_PIN_ZOOM },
                  entry: null,
                }),
            })}
          </ul>
          )}
        </div>
        )}
      </LocalSheet>
    </>
  );
}
