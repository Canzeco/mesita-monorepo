// The pin picker's rules (MESITA-2501), pure so they are tested without a
// map: where the pin is, what Google last said about it, and what the name
// field shows.
//
// Pato (2026-10-20): a saved location is named from the FINAL pin, never the
// typed query; the suggestion keeps following the pin until the guest edits
// the name, and the street line always follows the pin.
//
//   camera idle ──► lookupNeeded? ──► lookup_start (seq++, calls++) ──► EF
//        ▲                                                          │
//        └──── camera_move ◄── guest drags ─────── lookup_done(seq) ◄┘
//                                         (an answer for an older seq is dropped)
//
// The name field: its value is the live suggestion until the guest types.
// While it has focus nothing is written into it (a late answer must never
// land between two keystrokes). Typing marks the name edited; clearing it
// and leaving the field hands the name back to the pin.

import { EFError } from "@/lib/api/_invoke";

export type LatLng = { lat: number; lng: number };

/** Calls one picker session may spend on reverse geocoding. */
export const PIN_LOOKUP_BUDGET = 20;
/** Map idle → lookup wait, so a fling settles before Google is asked. */
export const PIN_LOOKUP_DEBOUNCE_MS = 400;

/** Two points are the same pin at the server's pin snap (~11 m). */
export function samePinSpot(a: LatLng | null, b: LatLng | null): boolean {
  if (!a || !b) return false;
  return a.lat.toFixed(4) === b.lat.toFixed(4) && a.lng.toFixed(4) === b.lng.toFixed(4);
}

// ── What a failed reverse geocode means ─────────────────────────────────
// transient: try once more later (this page load). operator: the key or the
//   session is wrong; keep the entry's needsName so it is named once fixed.
// terminal: Google has nothing to say about this point; stop asking.

export type LookupFailure = "transient" | "operator" | "terminal";

const TRANSIENT = new Set(["google_unreachable", "google_over_query_limit", "google_unknown_error"]);
const OPERATOR = new Set(["google_request_denied", "google_over_daily_limit", "sign_in_required"]);

export function classifyLookupFailure(code: string | null, status: number | null = null): LookupFailure {
  if (code && TRANSIENT.has(code)) return "transient";
  if (code && OPERATOR.has(code)) return "operator";
  if (code) return "terminal";
  // No code: a 5xx is the EF itself (e.g. a missing key), anything else is
  // the network.
  return status !== null && status >= 500 ? "operator" : "transient";
}

/** The failure class of whatever `apiReverseGeocodePin` threw. */
export function classifyThrown(err: unknown): LookupFailure {
  return err instanceof EFError ? classifyLookupFailure(err.code, err.status) : "transient";
}

// ── The picker's state ──────────────────────────────────────────────────

export type PinAnswer = { suggestedName: string | null; formattedAddress: string | null };

export type PinPickerState = {
  /** The map's centre: the pin. Null until the map reports one. */
  center: LatLng | null;
  /** The camera is moving (the pin lifts). */
  moving: boolean;
  /** The guest has moved the map at least once (the hint goes). */
  moved: boolean;
  suggestedName: string | null;
  formattedAddress: string | null;
  /** The pin the last answer (or terminal failure) described. */
  answeredAt: LatLng | null;
  /** The newest request; an answer for any other is dropped. */
  seq: number;
  /** Requests spent this session. */
  calls: number;
  inFlight: boolean;
  /** The last lookup failed (no street line, the name falls back). */
  failed: boolean;
  nameValue: string;
  nameEdited: boolean;
  nameFocused: boolean;
  // The radius chips (MESITA-2703) left in MESITA-2914: the Catalog has no
  // radius, so a pin is only a point.
};

export function initialPinPickerState(seed: {
  center: LatLng | null;
  suggestedName?: string | null;
  formattedAddress?: string | null;
  customName?: string | null;
  nameEdited?: boolean;
}): PinPickerState {
  const named = seed.suggestedName != null || seed.formattedAddress != null;
  const edited = Boolean(seed.nameEdited && seed.customName);
  return {
    center: seed.center,
    moving: false,
    moved: false,
    suggestedName: seed.suggestedName ?? null,
    formattedAddress: seed.formattedAddress ?? null,
    // An edited entry opens already named at its own pin.
    answeredAt: named ? seed.center : null,
    seq: 0,
    calls: 0,
    inFlight: false,
    failed: false,
    nameValue: edited ? (seed.customName ?? "") : (seed.suggestedName ?? ""),
    nameEdited: edited,
    nameFocused: false,
  };
}

export type PinPickerAction =
  | { type: "camera_move" }
  | { type: "camera_idle"; center: LatLng }
  | { type: "lookup_start" }
  | { type: "lookup_done"; seq: number; at: LatLng; answer: PinAnswer }
  | { type: "lookup_failed"; seq: number; at: LatLng; failure: LookupFailure }
  | { type: "name_focus" }
  | { type: "name_blur" }
  | { type: "name_input"; value: string };

export function pinPickerReducer(s: PinPickerState, a: PinPickerAction): PinPickerState {
  switch (a.type) {
    case "camera_move":
      return { ...s, moving: true, moved: true };
    case "camera_idle":
      return { ...s, moving: false, center: a.center };
    case "lookup_start":
      return { ...s, seq: s.seq + 1, calls: s.calls + 1, inFlight: true };
    case "lookup_done": {
      if (a.seq !== s.seq) return s;
      const suggestedName = s.nameEdited ? s.suggestedName : a.answer.suggestedName;
      return {
        ...s,
        inFlight: false,
        failed: false,
        answeredAt: a.at,
        formattedAddress: a.answer.formattedAddress,
        suggestedName,
        nameValue: s.nameEdited || s.nameFocused ? s.nameValue : (suggestedName ?? ""),
      };
    }
    case "lookup_failed": {
      if (a.seq !== s.seq) return s;
      // Only a terminal failure settles this spot; anything else leaves it
      // for the saved entry's backfill.
      const settled = a.failure === "terminal";
      return {
        ...s,
        inFlight: false,
        failed: true,
        answeredAt: settled ? a.at : s.answeredAt,
        formattedAddress: null,
        suggestedName: s.nameEdited ? s.suggestedName : null,
        nameValue: s.nameEdited || s.nameFocused ? s.nameValue : "",
      };
    }
    case "name_focus":
      return { ...s, nameFocused: true };
    case "name_blur":
      return {
        ...s,
        nameFocused: false,
        nameValue: s.nameEdited ? s.nameValue : (s.suggestedName ?? ""),
      };
    case "name_input":
      return { ...s, nameValue: a.value, nameEdited: a.value.trim() !== "" };
  }
}

/** True when the pin sits somewhere no answer has described and the session
 *  can still pay for one. */
export function lookupNeeded(s: PinPickerState): boolean {
  return s.center !== null && !s.inFlight && s.calls < PIN_LOOKUP_BUDGET &&
    !samePinSpot(s.center, s.answeredAt);
}

/** The muted line under the map. */
export function streetLine(s: PinPickerState): { text: string; dim: boolean } | null {
  if (s.inFlight) {
    if (s.formattedAddress) return { text: `Near ${s.formattedAddress}`, dim: true };
    return { text: "Finding this spot…", dim: true };
  }
  if (s.calls >= PIN_LOOKUP_BUDGET && !samePinSpot(s.center, s.answeredAt)) {
    return { text: "Named after saving", dim: false };
  }
  if (s.failed || !s.formattedAddress) return null;
  return { text: `Near ${s.formattedAddress}`, dim: false };
}

/** What Save stores, from the picker's state. */
export type PinDraft = {
  lat: number;
  lng: number;
  suggestedName: string | null;
  customName: string | null;
  formattedAddress: string | null;
  nameEdited: boolean;
  /** The names do not describe this exact pin yet: the backfill names it. */
  needsName: boolean;
};

export function pinDraft(s: PinPickerState): PinDraft | null {
  if (!s.center) return null;
  const typed = s.nameValue.trim();
  const customName = s.nameEdited && typed ? typed.slice(0, 40) : null;
  const named = samePinSpot(s.center, s.answeredAt);
  return {
    lat: s.center.lat,
    lng: s.center.lng,
    suggestedName: named ? s.suggestedName : null,
    customName,
    formattedAddress: named ? s.formattedAddress : null,
    nameEdited: customName !== null,
    needsName: s.inFlight || !named,
  };
}
