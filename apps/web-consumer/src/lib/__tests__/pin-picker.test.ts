// MVP test rule (MESITA-2600): only the data guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EFError } from "@/lib/api/_invoke";
import {
  classifyLookupFailure,
  classifyThrown,
  initialPinPickerState,
  lookupNeeded,
  PIN_LOOKUP_BUDGET,
  pinDraft,
  pinPickerReducer,
  streetLine,
  type PinPickerAction,
  type PinPickerState,
} from "@/lib/pin-picker-state";
import type { SavedLocation } from "@/lib/saved-locations";

// MESITA-2501: the pin picker's rules. Pato (2026-10-20): the name comes from
// the FINAL pin, never the typed query; the suggestion follows the pin until
// the guest edits the name; the street always follows the pin.

const run = (s: PinPickerState, ...actions: PinPickerAction[]) => actions.reduce(pinPickerReducer, s);
const TEC = { lat: 25.6514, lng: -100.2895 };
const ROMA = { lat: 25.6611, lng: -100.2801 };
const start = () => initialPinPickerState({ center: null });

/** A lookup for `at` that Google answered. */
function answered(s: PinPickerState, at: typeof TEC, suggestedName: string, street: string) {
  const asked = run(s, { type: "camera_idle", center: at }, { type: "lookup_start" });
  return run(asked, {
    type: "lookup_done",
    seq: asked.seq,
    at,
    answer: { suggestedName, formattedAddress: street },
  });
}

describe("the name follows the final pin", () => {
  it("a typed query never names the pin: only Google's answer for the pin does", () => {
    // The guest typed "San Pedro", the map opened there, the pin was dragged
    // into Monterrey: the suggestion is the Monterrey colonia.
    const s = answered(start(), TEC, "Tecnológico", "Avenida Eugenio Garza Sada 2501");
    expect(s.nameValue).toBe("Tecnológico");
    expect(pinDraft(s)).toMatchObject({ suggestedName: "Tecnológico", customName: null, needsName: false });
    expect(JSON.stringify(pinDraft(s))).not.toContain("San Pedro");
  });

  it("an older answer never overwrites a newer pin (both orders)", () => {
    let s = run(start(), { type: "camera_idle", center: TEC }, { type: "lookup_start" });
    const first = s.seq;
    s = run(s, { type: "camera_idle", center: ROMA }, { type: "lookup_start" });
    const second = s.seq;
    // The older answer lands last: dropped.
    let late = run(s, { type: "lookup_done", seq: second, at: ROMA, answer: { suggestedName: "Roma", formattedAddress: "Río Orinoco 123" } });
    late = run(late, { type: "lookup_done", seq: first, at: TEC, answer: { suggestedName: "Tecnológico", formattedAddress: "x" } });
    expect(late.suggestedName).toBe("Roma");
    // The older answer lands first: still dropped, the newer one applies.
    let early = run(s, { type: "lookup_done", seq: first, at: TEC, answer: { suggestedName: "Tecnológico", formattedAddress: "x" } });
    expect(early.suggestedName).toBeNull();
    early = run(early, { type: "lookup_done", seq: second, at: ROMA, answer: { suggestedName: "Roma", formattedAddress: "Río Orinoco 123" } });
    expect(early.suggestedName).toBe("Roma");
    expect(streetLine(early)).toEqual({ text: "Near Río Orinoco 123", dim: false });
  });

  it("typing freezes the suggestion; the street still follows the pin", () => {
    let s = answered(start(), TEC, "Tecnológico", "Avenida Eugenio Garza Sada 2501");
    s = run(s, { type: "name_focus" }, { type: "name_input", value: "Casa" }, { type: "name_blur" });
    s = answered(s, ROMA, "Roma", "Río Orinoco 123");
    expect(s.nameValue).toBe("Casa");
    expect(s.suggestedName).toBe("Tecnológico");
    expect(s.formattedAddress).toBe("Río Orinoco 123");
    expect(pinDraft(s)).toMatchObject({ customName: "Casa", nameEdited: true, lat: ROMA.lat });
  });

  it("clearing the name hands it back to the pin, but never while the field has focus", () => {
    let s = answered(start(), TEC, "Tecnológico", "a");
    s = run(s, { type: "name_focus" }, { type: "name_input", value: "" });
    expect(s.nameEdited).toBe(false);
    // An answer lands between two keystrokes: the field is left alone.
    s = answered(s, ROMA, "Roma", "b");
    expect(s.nameValue).toBe("");
    s = run(s, { type: "name_input", value: "O" });
    expect(s.nameValue).toBe("O");
    s = run(s, { type: "name_input", value: "" }, { type: "name_blur" });
    expect(s.nameValue).toBe("Roma");
  });

  it("a pin saved before Google answered is named later (needsName)", () => {
    let s = run(start(), { type: "camera_idle", center: TEC }, { type: "lookup_start" });
    expect(pinDraft(s)).toMatchObject({ needsName: true, suggestedName: null });
    s = answered(start(), TEC, "Tecnológico", "a");
    s = run(s, { type: "camera_idle", center: ROMA });
    expect(pinDraft(s)).toMatchObject({ needsName: true, suggestedName: null, formattedAddress: null });
  });

  it("asks at most PIN_LOOKUP_BUDGET times, then says the pin is named after saving", () => {
    let s = start();
    for (let i = 0; i < PIN_LOOKUP_BUDGET; i++) {
      s = answered(s, { lat: 25 + i / 100, lng: -100 }, "x", "y");
    }
    s = run(s, { type: "camera_idle", center: TEC });
    expect(lookupNeeded(s)).toBe(false);
    expect(streetLine(s)).toEqual({ text: "Named after saving", dim: false });
    expect(pinDraft(s)?.needsName).toBe(true);
  });

  it("a failed lookup hides the street and falls back to Saved location", () => {
    let s = run(start(), { type: "camera_idle", center: TEC }, { type: "lookup_start" });
    expect(streetLine(s)).toEqual({ text: "Finding this spot…", dim: true });
    s = run(s, { type: "lookup_failed", seq: s.seq, at: TEC, failure: "terminal" });
    expect(streetLine(s)).toBeNull();
    expect(s.nameValue).toBe("");
    expect(pinDraft(s)).toMatchObject({ needsName: false, suggestedName: null });
    // A transient failure leaves the pin for the backfill.
    let t = run(start(), { type: "camera_idle", center: TEC }, { type: "lookup_start" });
    t = run(t, { type: "lookup_failed", seq: t.seq, at: TEC, failure: "transient" });
    expect(pinDraft(t)?.needsName).toBe(true);
  });

  it("an edited entry reopens with its own name and nothing to ask", () => {
    const s = initialPinPickerState({ center: TEC, suggestedName: "Tecnológico", formattedAddress: "a", customName: "Casa", nameEdited: true });
    expect(s.nameValue).toBe("Casa");
    expect(lookupNeeded(s)).toBe(false);
  });
});

describe("what a failed reverse geocode means", () => {
  it("transient tries again, operator keeps the entry waiting, terminal stops asking", () => {
    expect(classifyLookupFailure("google_unreachable")).toBe("transient");
    expect(classifyLookupFailure("google_over_query_limit")).toBe("transient");
    expect(classifyLookupFailure("google_request_denied")).toBe("operator");
    expect(classifyLookupFailure("google_over_daily_limit")).toBe("operator");
    expect(classifyLookupFailure("sign_in_required")).toBe("operator");
    expect(classifyLookupFailure("no_area_name")).toBe("terminal");
    expect(classifyLookupFailure("bad_point")).toBe("terminal");
    // No code: a 5xx is the function (e.g. a missing key), else the network.
    expect(classifyLookupFailure(null, 500)).toBe("operator");
    expect(classifyLookupFailure(null, null)).toBe("transient");
    expect(classifyThrown(new EFError("x", { fn: "f", code: "no_area_name" }))).toBe("terminal");
    expect(classifyThrown(new TypeError("Failed to fetch"))).toBe("transient");
  });
});

describe("the picker's map and sheet (source)", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
  const sheet = read("components/consumer/home/LocationPicker.tsx");

  it("nothing is saved by a pick: every way in opens the picker", () => {
    expect(sheet).not.toContain("addSavedLocation");
    expect(sheet).toContain('setPicker({ mode: "new", camera: await pickCamera(supabase, r), entry: null });');
    expect(sheet).toContain('setPicker({ mode: "new", camera: aroundYouCamera(a), entry: null })');
    expect(sheet).toContain('openSaved(l, "confirm");');
    expect(sheet).toContain('openSaved(l, "edit")');
  });

  it("with no fix the search leans on Monterrey", () => {
    expect(sheet).toContain("apiSuggestPlaces(supabase, q, token, coords ?? MONTERREY_CENTER)");
  });
});

// ── The backfill ────────────────────────────────────────────────────────

const reverse = vi.fn();
vi.mock("@/lib/api/place-search", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/place-search")>()),
  apiReverseGeocodePin: (...args: unknown[]) => reverse(...args),
}));

describe("the backfill names saved pins", async () => {
  const { backfillSavedLocation, needsBackfill, BACKFILL_RETRY_MS } = await import("@/lib/use-saved-location-backfill");
  const store = await import("@/lib/saved-locations");

  const seed = (over: Partial<SavedLocation> = {}) => {
    const saved = store.addSavedLocation({
      lat: 25.65,
      lng: -101.12,
      suggestedName: "San Pedro",
      customName: null,
      formattedAddress: null,
      nameEdited: false,
      needsName: true,
    })!.location;
    if (Object.keys(over).length) store.patchSavedLocationInPlace(saved.id, over);
    return store.getSavedLocations().find((l) => l.id === saved.id)!;
  };

  beforeEach(() => {
    store.clearSavedLocationsLocal();
    reverse.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("asks for pins without names and for Google names older than 30 days", () => {
    const now = Date.now();
    const base = seed();
    expect(needsBackfill(base, now)).toBe(true);
    const fresh = { ...base, needsName: false, namedAt: now - 1000 };
    expect(needsBackfill(fresh, now)).toBe(false);
    expect(needsBackfill({ ...fresh, namedAt: now - 31 * 24 * 3600 * 1000 }, now)).toBe(true);
    expect(needsBackfill({ ...fresh, namedAt: null }, now)).toBe(true);
  });

  it("replaces a legacy name with the pin's own, and never touches a typed name", async () => {
    const legacy = seed();
    reverse.mockResolvedValueOnce({ suggestedName: "Saltillo Centro", formattedAddress: "Calle Victoria 1" });
    await backfillSavedLocation({} as never, legacy);
    expect(store.getSavedLocations()[0]).toMatchObject({ suggestedName: "Saltillo Centro", needsName: false, name: "Saltillo Centro" });
    const typed = seed({ customName: "Casa", nameEdited: true });
    reverse.mockResolvedValueOnce({ suggestedName: "Otro", formattedAddress: "Calle 2" });
    await backfillSavedLocation({} as never, typed);
    expect(store.getSavedLocations().find((l) => l.id === typed.id)).toMatchObject({ name: "Casa", suggestedName: "San Pedro", formattedAddress: "Calle 2" });
  });

  it("terminal stops asking, operator leaves it waiting, transient retries once", async () => {
    const a = seed();
    reverse.mockRejectedValueOnce(new EFError("x", { fn: "f", code: "no_area_name" }));
    await backfillSavedLocation({} as never, a);
    expect(store.getSavedLocations()[0].needsName).toBe(false);

    const b = seed();
    reverse.mockRejectedValueOnce(new EFError("x", { fn: "f", code: "google_request_denied" }));
    await backfillSavedLocation({} as never, b);
    expect(store.getSavedLocations().find((l) => l.id === b.id)?.needsName).toBe(true);

    vi.useFakeTimers();
    const c = seed();
    reverse
      .mockRejectedValueOnce(new EFError("x", { fn: "f", code: "google_unreachable" }))
      .mockResolvedValueOnce({ suggestedName: "Roma", formattedAddress: null });
    const done = backfillSavedLocation({} as never, c);
    await vi.advanceTimersByTimeAsync(BACKFILL_RETRY_MS);
    await done;
    expect(reverse).toHaveBeenCalledTimes(4);
    expect(store.getSavedLocations().find((l) => l.id === c.id)?.suggestedName).toBe("Roma");
  });
});
