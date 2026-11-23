"use client";

// ONE LOCATION CHOOSER, TWO HOMES (MESITA-4542, Pato 2026-11-21: "make
// location selector mandatory … if you don't have a location, add a
// location, not necessarily your current location, but you can add some
// location from the saved locations"). The body of Home's location sheet
// (MESITA-2464, MESITA-2945 "all in one box"): a search field over ONE card
// of rows — Current location, each saved pin, Add a location — and the pin
// picker step. It lives in two places:
//
//   header sheet  (LocationPicker)  search first, the sheet owns `picker` so
//                                   its backdrop and Escape act as Back
//   Places body   (CatalogRails)    choices first, no autofocus, the help
//                                   line muted until a tap here fails; the
//                                   pin step fills the Places scroller
//
// Every row writes the stores itself (`setActiveLocation`, the device ask),
// so whichever home is showing, Home's catalog reads the same choice. Before
// writing, a row notes how the guest chose (`lastChoiceSource`) for the
// gate's `location_gate_chosen` event; no note means the device fix.

import { useEffect, useState, type ReactNode } from "react";
import { Bookmark, Check, Loader2, LogIn, MapPin, Navigation, Pencil, Plus, Search } from "lucide-react";
import { ERROR_BOX_CLASS, INPUT_CLASS } from "@/lib/ui-classes";
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
  LOCATION_HELP,
} from "@/lib/use-user-location";
import { displayName, evictionFor, useSavedLocations, type SavedLocation } from "@/lib/saved-locations";
import { savedLocationKey, setActiveLocation, useActiveLocation, useActiveLocationKey } from "@/lib/active-location";
import { PIN_LIST_FULL, PinPicker, type PinPickerMode } from "@/components/consumer/home/PinPicker";
import { cn, errMsg } from "@/lib/utils";
import { useViewer } from "@/lib/identity-context";
import { signHref } from "@/lib/anonymous";

/** How the guest last chose a point in any chooser (MESITA-4542): read once
 *  by Home's catalog when its point first appears. Module-level, so the
 *  header sheet and the inline chooser share it. */
let lastChoiceSource: "saved" | "pin" | null = null;

/** Note how the guest is choosing; called just before a store write. */
function noteChoice(source: "saved" | "pin" | null): void {
  lastChoiceSource = source;
}

export function takeLastChoiceSource(): "device" | "saved" | "pin" {
  const s = lastChoiceSource;
  lastChoiceSource = null;
  return s ?? "device";
}

const ICON = "h-4 w-4 shrink-0";

/** The one card (MESITA-2945, Pato: "all in one box"). */
const CARD_CLASS = "border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border";
/** Inside the floating modal (MESITA-4628, Pato: no box inside a box): the
 *  rows run to the card's edges, hairlines between them and above and below. */
const FLUSH_CARD_CLASS = "border-border bg-card divide-border divide-y -mx-5 border-y";

/** A saved pin reopened in the picker. */
const SAVED_PIN_ZOOM = 16;

export type PickerTarget = {
  mode: PinPickerMode;
  camera: PickerCamera;
  entry: SavedLocation | null;
};

/** Current location's title: the fix, the ask, or the invitation. */
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

export function LocationChooser({
  onDone,
  picker: pickerProp,
  onPickerChange,
  bodyClassName,
  flush = false,
}: {
  /** A location was chosen or saved. The sheet closes; inline does nothing
   *  (the new point unlocks the feed). */
  onDone: () => void;
  /** Controlled pin step (the header sheet, whose backdrop acts as Back). */
  picker?: PickerTarget | null;
  onPickerChange?: (next: PickerTarget | null) => void;
  /** The list view's wrapper (the sheet's scrolling body). The pin step is
   *  rendered bare so it can fill its home; one instance either way, so
   *  Back returns to the list with the search kept. */
  bodyClassName?: string;
  /** The rows run edge to edge (the floating modal, MESITA-4628); the inline
   *  no-location chooser keeps its own card. */
  flush?: boolean;
}) {
  const cardClass = flush ? FLUSH_CARD_CLASS : CARD_CLASS;
  // SIGNED OUT, NO DEAD ENDS (MESITA-4739): an anonymous visitor never makes
  // the paid Google calls behind search and the pin's address (MESITA-4246),
  // so the field only ever said "No matches yet" and Add a location never
  // found its address. Signed out, the chooser offers what works: Use my
  // location, then Sign in to search any place.
  const anonymous = useViewer() === "anonymous";
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
  const locError = useUserLocationError();
  // The guest tapped "Use my location" with no fix: stay until the answer
  // lands (MESITA-2615); a fix is the choice.
  const [wantFix, setWantFix] = useState(false);
  const active = useActiveLocation();
  const activeKey = useActiveLocationKey();
  const savedLocations = useSavedLocations();
  const supabase = useBrowserSupabase();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownPicker, setOwnPicker] = useState<PickerTarget | null>(null);
  const controlled = onPickerChange !== undefined;
  const picker = controlled ? (pickerProp ?? null) : ownPicker;
  const setPicker = (next: PickerTarget | null) => {
    // Opening the map for a new or unconfirmed pin: if it is confirmed,
    // the guest chose by pin.
    if (next && next.mode !== "edit") noteChoice("pin");
    if (controlled) onPickerChange(next);
    else setOwnPicker(next);
  };
  // Google bills Autocomplete per session: one token until a pick or close.
  const [token, setToken] = useState(newSessionToken);
  // The neighbourhood for the Current location row, once per ~110 m.
  const hereName = useHere(coords, true).name;
  const typing = query.trim().length >= 2;
  const activeId = activeKey?.startsWith("saved:") ? activeKey.slice(6) : null;
  const listFull = evictionFor(savedLocations, activeId) === undefined;

  // Search after a short pause; the newest query wins. With no fix the
  // search leans on Monterrey (MESITA-2501).
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

  /** A choice was made: reset this chooser, then tell the home. */
  const done = () => {
    setPicker(null);
    setQuery("");
    setResults([]);
    setError(null);
    setResolving(null);
    setWantFix(false);
    setToken(newSessionToken());
    onDone();
  };

  // The fix the guest asked for landed: Current location is chosen already.
  useOnUserFix(() => {
    if (wantFix) done();
  });

  const locatingHere = coords === null && locating;
  const help = coords === null && !locating && locError ? LOCATION_HELP[locError] : null;

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

  if (picker) {
    const step = (
      <PinPicker
        key={`${picker.mode}:${picker.entry?.id ?? ""}:${picker.camera.center.lat},${picker.camera.center.lng}`}
        mode={picker.mode}
        camera={picker.camera}
        entry={picker.entry}
        activeKey={activeKey}
        listFull={listFull}
        onBack={back}
        onDone={done}
      />
    );
    return step;
  }

  /** One row of the card: an icon disc, a title, a muted second line, a
   *  check when chosen and an optional trailing control. */
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
    alertLoud?: boolean;
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
          <span className={cn("block truncate text-sm font-semibold", r.muted && "text-muted-foreground")}>
            {r.title}
          </span>
          {r.alert ? (
            <span
              className={cn("mt-0.5 block text-xs", r.alertLoud === false ? "text-muted-foreground" : "text-destructive")}
              role="status"
              data-places-location-help
            >
              {r.alert}
            </span>
          ) : r.sub ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">{r.sub}</span>
          ) : null}
        </span>
        {r.selected ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-label="Chosen" /> : null}
      </button>
      {r.trailing}
    </li>
  );

  const search = (
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
  );

  const matches = (
    <ul role="list" aria-label="Matches" className={cardClass} data-places-location-results>
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
  );

  /** Use my location: with a fix, choose it; without one, ask and stay (a
   *  fix is the choice, a failure says why). */
  const chooseHere = () => {
    noteChoice(null);
    setActiveLocation(null);
    if (coords !== null) {
      done();
      return;
    }
    setWantFix(true);
    locate();
  };

  const card = (
    <ul role="list" aria-label="Location" className={cardClass} data-places-location>
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
        onClick: chooseHere,
      })}
      {savedLocations.map((l) =>
        row({
          key: savedLocationKey(l.id),
          title: displayName(l),
          sub: l.unconfirmed ? "Confirm this spot on the map" : l.formattedAddress,
          icon: <Bookmark className={ICON} strokeWidth={2.25} />,
          selected: activeKey === savedLocationKey(l.id) && !l.unconfirmed,
          muted: l.unconfirmed,
          // An old entry no one confirmed on a map opens the picker first;
          // it never drives a search before that.
          onClick: () => {
            if (l.unconfirmed) {
              openSaved(l, "confirm");
              return;
            }
            noteChoice("saved");
            setActiveLocation(savedLocationKey(l.id));
            done();
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
      {anonymous
        ? row({
            key: "sign",
            title: "Sign in to search any place",
            sub: "Then search a city or save a spot",
            icon: <LogIn className={ICON} strokeWidth={2.25} />,
            onClick: () => window.location.assign(signHref(`${window.location.pathname}${window.location.search}`)),
          })
        : null}
      {/* The visible way to save a spot (MESITA-2945): the picker opens on
          the device fix, else on Monterrey. Members only (MESITA-4739). */}
      {anonymous ? null : row({
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
  );

  const errorBox = error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null;

  return (
    <div className={cn("flex flex-col gap-4", bodyClassName)} data-places-location-chooser="sheet" data-places-location-sheet>
      {anonymous ? null : search}
      {errorBox}
      {typing && !anonymous ? matches : card}
    </div>
  );
}
