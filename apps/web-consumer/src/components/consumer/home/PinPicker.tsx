"use client";

// The pin picker (MESITA-2501): every saved location is a pin the guest sees
// and confirms on a map before Home searches from it. Pato (2026-10-20): a
// typed "San Pedro" once resolved to Coahuila, and Home, which has no map,
// searched there silently.
//
//   ┌ ‹  Set the spot ─────────────┐
//   │        [ map, greedy ]       │  ≥45vh, outside any scroll body
//   │             📍 fixed     (◎) │  the map moves under the pin
//   ├──────────────────────────────┤
//   │ Near Av. Garza Sada 2501     │  follows the pin, always
//   │ Name [ Tecnológico        ]  │  the live suggestion until typed
//   │ [           Save           ] │
//   └──────────────────────────────┘
//
// The rules (what the name shows, when Google is asked, what Save stores)
// live in `lib/pin-picker-state.ts`; this file is the map and the controls.
// The picker sits inside Home's location sheet (`LocationPicker.tsx`), whose
// Back, backdrop and Escape return to where the guest came from.

import { useEffect, useReducer, useRef, useState } from "react";
import { ChevronLeft, Loader2, MapPin, Navigation } from "lucide-react";
import {
  APIProvider,
  APILoadingStatus,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { apiReverseGeocodePin } from "@/lib/api/place-search";
import { setActiveLocation, savedLocationKey } from "@/lib/active-location";
import {
  MAP_MINIMAL_STYLES,
  MAP_USER_LOCATION_PIN_COLOR,
  MAP_USER_LOCATION_STROKE_COLOR,
  mapPinIcon,
} from "@/lib/map-defaults";
import type { PickerCamera } from "@/lib/location-pick";
import {
  classifyThrown,
  initialPinPickerState,
  lookupNeeded,
  PIN_LOOKUP_DEBOUNCE_MS,
  pinDraft,
  pinPickerReducer,
  streetLine,
  type PinPickerAction,
} from "@/lib/pin-picker-state";
import {
  addSavedLocation,
  confirmedPatch,
  displayName,
  removeSavedLocation,
  updateSavedLocation,
  type SavedLocation,
} from "@/lib/saved-locations";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  useLocateUser,
  useOnUserFix,
  useUserLocation,
  useUserLocationError,
  useUserLocationLocating,
} from "@/lib/use-user-location";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export type PinPickerMode = "new" | "edit" | "confirm";

/** The picker's title and button for each way in. */
export function pinPickerLabels(mode: PinPickerMode, entry?: SavedLocation | null): {
  title: string;
  action: string;
} {
  if (mode === "confirm") return { title: "Confirm this spot", action: "Confirm" };
  if (mode === "edit" && entry) return { title: `Edit ${displayName(entry)}`, action: "Save" };
  return { title: "Set the spot", action: "Save" };
}

export const PIN_SAVE_FAILED = "Couldn't keep this spot on this device";
export const PIN_LIST_FULL = "8 saved · remove one first";

/** A map that failed this many times reloads the page instead. */
const MAP_RETRIES = 1;

export function PinPicker({
  mode,
  camera,
  entry = null,
  activeKey,
  listFull,
  onBack,
  onDone,
}: {
  mode: PinPickerMode;
  camera: PickerCamera;
  /** The entry being edited or confirmed. */
  entry?: SavedLocation | null;
  activeKey: string | null;
  /** A new pin has no room: eight named pins and none to drop. */
  listFull: boolean;
  onBack: () => void;
  /** The pin is saved and active: close the sheet. */
  onDone: () => void;
}) {
  const supabase = useBrowserSupabase();
  const apiKey = process.env.NEXT_PUBLIC_GMP_KEY ?? "";
  const [state, dispatch] = useReducer(
    pinPickerReducer,
    initialPinPickerState({
      center: null,
      suggestedName: entry?.unconfirmed ? null : entry?.suggestedName,
      formattedAddress: entry?.unconfirmed ? null : entry?.formattedAddress,
      customName: entry?.customName,
      nameEdited: entry?.nameEdited,
    }),
  );
  const [mapAttempt, setMapAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // One entry per picker session: after a first save the id is kept, so a
  // second tap (after a storage failure) updates instead of adding again.
  const savedId = useRef<string | null>(entry?.id ?? null);
  const [savedOnce, setSavedOnce] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const labels = pinPickerLabels(mode, entry);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Ask Google about the pin once the map has settled there.
  useEffect(() => {
    if (!lookupNeeded(state) || !state.center) return;
    const at = state.center;
    const seq = state.seq + 1;
    const t = setTimeout(() => {
      dispatch({ type: "lookup_start" });
      apiReverseGeocodePin(supabase, at)
        .then((answer) => dispatch({ type: "lookup_done", seq, at, answer }))
        .catch((err: unknown) => {
          const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : null;
          console.warn("[pin-picker] reverse_geocode_failed", { code });
          dispatch({ type: "lookup_failed", seq, at, failure: classifyThrown(err) });
        });
    }, PIN_LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `state` is read through these fields; the reducer owns the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, state.center, state.inFlight, state.answeredAt, state.calls]);

  const save = () => {
    const draft = pinDraft(state);
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    const id = savedId.current;
    const result = id
      ? updateSavedLocation(id, confirmedPatch(draft))
      : addSavedLocation(draft, activeKey?.startsWith("saved:") ? activeKey.slice(6) : null);
    if (!result) {
      setSaving(false);
      setSaveError(PIN_LIST_FULL);
      return;
    }
    savedId.current = result.location.id;
    setSavedOnce(true);
    if (!result.kept) {
      setSaving(false);
      setSaveError(PIN_SAVE_FAILED);
      return;
    }
    // Editing a pin keeps whatever Home searches from now; a new or a
    // confirmed pin becomes it.
    if (mode === "edit") {
      onBack();
      return;
    }
    setActiveLocation(savedLocationKey(result.location.id));
    onDone();
  };

  const remove = () => {
    if (!entry) return;
    removeSavedLocation(entry.id);
    if (activeKey === savedLocationKey(entry.id)) setActiveLocation(null);
    onBack();
  };

  const street = streetLine(state);
  const blocked = mode === "new" && listFull && !savedOnce;
  const nameMuted = !state.nameEdited && !state.suggestedName;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pin-picker data-pin-picker-mode={mode}>
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
          data-pin-picker-back
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <h2 ref={titleRef} tabIndex={-1} className={cn(SHEET_TITLE_CLASS, "min-w-0 truncate outline-none")}>
          {labels.title}
        </h2>
      </div>

      {/* The map takes the room, outside any scrolling body: a one-finger
          drag must move the map, never the sheet. */}
      <div
        role="application"
        aria-label="Map. Move it to place the pin"
        className="relative min-h-[45vh] flex-1 overflow-hidden"
        data-pin-picker-map
      >
        {apiKey ? (
          <APIProvider key={mapAttempt} apiKey={apiKey} libraries={["places"]}>
            <PinMapLayer
              camera={camera}
              moving={state.moving}
              moved={state.moved}
              dispatch={dispatch}
              attempt={mapAttempt}
              onRetry={() => setMapAttempt((n) => n + 1)}
            />
          </APIProvider>
        ) : (
          <MapUnavailable canRetry={false} onRetry={() => {}} />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div aria-live="polite" className="flex flex-col gap-3">
          <p
            className={cn(
              "text-muted-foreground min-h-5 truncate text-sm transition-opacity",
              street?.dim && "opacity-60",
            )}
            data-pin-picker-street
          >
            {street?.text ?? ""}
          </p>
          {mode === "confirm" && entry?.legacyName ? (
            <p className="text-muted-foreground -mt-2 truncate text-xs" data-pin-picker-was>
              Was: {entry.legacyName}
            </p>
          ) : null}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Name</span>
          <input
            value={state.nameValue}
            onFocus={(e) => {
              dispatch({ type: "name_focus" });
              e.currentTarget.select();
            }}
            onBlur={() => dispatch({ type: "name_blur" })}
            onChange={(e) => dispatch({ type: "name_input", value: e.target.value })}
            placeholder="Saved location"
            maxLength={40}
            autoComplete="off"
            enterKeyHint="done"
            className={cn(INPUT_CLASS, nameMuted && "text-muted-foreground")}
            data-pin-picker-name
          />
        </label>
        {saveError ? (
          <p className="text-muted-foreground text-xs" role="status" data-pin-picker-error>
            {saveError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={!state.center || saving || blocked}
          className={PRIMARY_BUTTON_CLASS}
          data-pin-picker-save
        >
          {blocked ? PIN_LIST_FULL : labels.action}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={remove}
            className="text-muted-foreground hover:text-foreground h-11 text-sm font-semibold transition"
            data-pin-picker-remove
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The map, the fixed pin over its centre, the hint and "Use my location". */
function PinMapLayer({
  camera,
  moving,
  moved,
  dispatch,
  attempt,
  onRetry,
}: {
  camera: PickerCamera;
  moving: boolean;
  moved: boolean;
  dispatch: (a: PinPickerAction) => void;
  attempt: number;
  onRetry: () => void;
}) {
  const status = useApiLoadingStatus();
  const failed = status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE;
  const logged = useRef(false);

  useEffect(() => {
    if (!failed || logged.current) return;
    logged.current = true;
    console.error("[pin-picker] maps_load_failed", {
      reason: status,
      host: typeof window === "undefined" ? null : window.location.host,
      attempt,
    });
  }, [failed, status, attempt]);

  if (failed) return <MapUnavailable canRetry={attempt < MAP_RETRIES} onRetry={onRetry} />;

  return (
    <>
      <Map
        defaultCenter={camera.center}
        defaultZoom={camera.zoom}
        gestureHandling="greedy"
        disableDefaultUI
        keyboardShortcuts={false}
        clickableIcons={false}
        colorScheme="LIGHT"
        styles={MAP_MINIMAL_STYLES as unknown as Parameters<typeof Map>[0]["styles"]}
        className="absolute inset-0 h-full w-full"
      >
        <PinCamera camera={camera} dispatch={dispatch} />
        <UserDot />
      </Map>
      <CenterPin lifted={moving} />
      {!moved ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center" data-pin-picker-hint>
          <span className="bg-card/95 shadow-elev rounded-full px-3 py-1.5 text-xs font-semibold">
            Move the map to place the pin
          </span>
        </div>
      ) : null}
      <UseMyLocation />
    </>
  );
}

/** Fits the first camera and reports every settle as the pin's new spot. */
function PinCamera({ camera, dispatch }: { camera: PickerCamera; dispatch: (a: PinPickerAction) => void }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (camera.fit && !fitted.current) {
      fitted.current = true;
      map.fitBounds({
        south: camera.fit.low.lat,
        west: camera.fit.low.lng,
        north: camera.fit.high.lat,
        east: camera.fit.high.lng,
      });
    }
    const start = map.addListener("dragstart", () => dispatch({ type: "camera_move" }));
    const zoom = map.addListener("zoom_changed", () => dispatch({ type: "camera_move" }));
    const idle = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) dispatch({ type: "camera_idle", center: { lat: c.lat(), lng: c.lng() } });
    });
    return () => {
      start.remove();
      zoom.remove();
      idle.remove();
    };
  }, [map, camera, dispatch]);

  return null;
}

/** The guest's blue dot, when there is a fix. */
function UserDot() {
  const coords = useUserLocation();
  if (!coords) return null;
  const icon = mapPinIcon(MAP_USER_LOCATION_PIN_COLOR, MAP_USER_LOCATION_STROKE_COLOR);
  return <Marker position={coords} clickable={false} icon={icon.url} title="You're here" />;
}

/** "Use my location": pans to the fix; asks for one only if the browser has
 *  not refused (a refusal is final until the guest changes the setting). */
function UseMyLocation() {
  const map = useMap();
  const coords = useUserLocation();
  const locating = useUserLocationLocating();
  const error = useUserLocationError();
  const locate = useLocateUser();
  const [wanted, setWanted] = useState(false);
  const [off, setOff] = useState(false);

  useOnUserFix((fix) => {
    if (!wanted || !map) return;
    map.panTo(fix);
    setWanted(false);
  });

  const onClick = () => {
    setOff(false);
    if (coords && map) {
      map.panTo(coords);
      return;
    }
    if (error === "denied" || error === "unsupported") {
      setOff(true);
      return;
    }
    setWanted(true);
    locate();
  };

  const showOff = off || (wanted && !locating && error !== null);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Use my location"
        className="bg-card shadow-elev absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full"
        data-pin-picker-locate
      >
        {wanted && locating ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Navigation className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        )}
      </button>
      {showOff ? (
        <p
          className="bg-card/95 text-muted-foreground absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-xs"
          role="status"
          data-pin-picker-location-off
        >
          Location is off
        </p>
      ) : null}
    </>
  );
}

/** The fixed pin: its tip sits on the map's centre. It lifts while the map
 *  moves and drops when it settles (no lift under reduced motion). */
function CenterPin({ lifted }: { lifted: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2" data-pin-picker-pin>
      <div
        className={cn(
          "bg-foreground/25 absolute top-0 left-0 h-1.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[1px] transition-transform duration-150",
          lifted ? "scale-125" : "scale-100",
        )}
      />
      <MapPin
        className={cn(
          "fill-foreground text-card absolute bottom-0 left-0 h-9 w-9 -translate-x-1/2 transition-transform duration-150 motion-reduce:transition-none",
          lifted ? "-translate-y-2 motion-reduce:translate-y-0" : "translate-y-0",
        )}
        strokeWidth={1.5}
      />
    </div>
  );
}

function MapUnavailable({ canRetry, onRetry }: { canRetry: boolean; onRetry: () => void }) {
  return (
    <div className="bg-muted absolute inset-0 flex flex-col items-center justify-center gap-3" data-pin-picker-map-failed>
      <p className="text-muted-foreground text-sm">Map didn&apos;t load</p>
      <button
        type="button"
        onClick={() => (canRetry ? onRetry() : window.location.reload())}
        className="bg-card border-border h-11 rounded-full border px-5 text-sm font-semibold"
      >
        {canRetry ? "Retry" : "Reload"}
      </button>
    </div>
  );
}
