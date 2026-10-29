// The wrong-number refetch — the on_reservation_failed trigger (MESITA-1189,
// MESITA-2420).
//
// A wrong_number verdict is the one terminal sign that the number a1 dialed is
// not this place's, and the trigger matrix buys only step 1 (`google`) for it:
// link discovery never finds a phone, so nothing else could fix it. This runs
// that step here, inline, where it used to seed the paused stage path:
//
//   1. the matrix row is on, the place has a Google Place ID, and no Enrich is
//      in flight (that run reads Google itself, and a write now would void it);
//   2. open_place_enrichment_run opens an on_reservation_failed run under the
//      row's cooldown (24h by default), atomically, so a second wrong number
//      inside the window does nothing;
//   3. one Place Details call (fetchGoogleBasics, no photos);
//   4. Google's phone replaces the stored one unless a person pinned it, and a
//      phone endpoint that held the old number follows it; business_state
//      records what Google says;
//   5. `details` is stamped from that effect and the run is closed.
//
// It never marks the place enriching and never stamps enriched_at: a refetch
// is not an Enrich.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportCrenupSteps, stepDone, stepFailed, type StepOutcome } from "./crenup-report.ts";
import { activeFieldPins, readFieldPins, stripPinnedColumns, type FieldPins } from "./enrich-corrections.ts";
import { fetchGoogleBasics } from "./enrich-google-basics.ts";
import { googlePlacesKeyOrNull } from "./google-places.ts";
import { closeEnrichmentRun, openEnrichmentRun } from "./enrich-runs.ts";
import type { SubprocessKey } from "./enrich-triggers.ts";
import { phoneDigits } from "./phone.ts";
import { writePlace } from "./place-doc.ts";

const BUSINESS_STATES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

/** The live row the refetch compares Google against. */
export type RefetchRow = {
  phone: string | null;
  reservation_channel: string | null;
  reservation_target: string | null;
  enrichment_sources: unknown;
};

function digits(value: unknown): string {
  return typeof value === "string" ? phoneDigits(value) : "";
}

/**
 * What the refetch writes. Google's phone when it is a different number; a
 * phone endpoint that held the old number moves with it; business_state when
 * Google states one. A pinned field is withheld and named in `pinned`.
 */
export function refetchPatch(input: {
  row: RefetchRow;
  googlePhone: string | null;
  businessStatus: string | null;
  now: string;
  pins: FieldPins;
}): { patch: Record<string, unknown>; phoneChanged: boolean; pinned: string[] } {
  const patch: Record<string, unknown> = {};
  const status = (input.businessStatus ?? "").trim().toUpperCase();
  if (BUSINESS_STATES.has(status)) {
    patch.business_state = status;
    patch.business_state_at = input.now;
  }
  const fresh = (input.googlePhone ?? "").trim();
  const old = digits(input.row.phone);
  if (fresh && digits(fresh) !== old) {
    patch.phone = fresh;
    const target = digits(input.row.reservation_target);
    if (input.row.reservation_channel === "phone" && target && target === old) {
      patch.reservation_target = fresh;
    }
  }
  const { update, skipped } = stripPinnedColumns(patch, input.pins, new Date(input.now));
  return { patch: update, phoneChanged: "phone" in update, pinned: skipped };
}

/** Step 1's outcome, from what the refetch observed. */
export function refetchOutcome(input: {
  businessStatus: string | null;
  phoneChanged: boolean;
  pinned: readonly string[];
  googleHasPhone: boolean;
}): StepOutcome {
  const meta = { via: "refetch" };
  if ((input.businessStatus ?? "").toUpperCase() === "CLOSED_PERMANENTLY") {
    return stepFailed("Google reports this place permanently closed.", meta);
  }
  if (input.pinned.includes("phone")) {
    return stepDone("Google refetched after a wrong number; the phone is pinned, so it was kept.", meta);
  }
  if (input.phoneChanged) {
    return stepDone("Google refetched after a wrong number; the phone was replaced with Google's.", meta);
  }
  return stepDone(
    input.googleHasPhone
      ? "Google refetched after a wrong number; Google lists the same phone."
      : "Google refetched after a wrong number; Google lists no phone.",
    meta,
  );
}

export type RefetchResult =
  | { ran: false; reason: "no_google_id" | "enriching" | "cooldown" | "already_open" | "no_key" | "error"; error?: string }
  | { ran: true; phoneChanged: boolean };

/**
 * Run the refetch for one place. Best-effort by contract: the caller is
 * reporting a call outcome, and nothing here may fail that report.
 */
export async function refetchGoogleAfterWrongNumber(
  admin: SupabaseClient,
  placeId: string,
  opts: {
    seededBy: string;
    subprocesses: SubprocessKey[];
    cooldownHours: number;
    env?: { get(name: string): string | undefined };
  },
): Promise<RefetchResult> {
  const { data: place, error: placeErr } = await admin
    .from("place_profiles")
    .select("google_place_id, phone, reservation_channel, reservation_target, enrichment_sources")
    .eq("id", placeId)
    .maybeSingle();
  if (placeErr) return { ran: false, reason: "error", error: placeErr.message };
  const googlePlaceId = typeof place?.google_place_id === "string" ? place.google_place_id.trim() : "";
  if (!place || !googlePlaceId) return { ran: false, reason: "no_google_id" };

  const { data: state, error: stateErr } = await admin
    .from("places")
    .select("content_state")
    .eq("id", placeId)
    .maybeSingle();
  if (stateErr) return { ran: false, reason: "error", error: stateErr.message };
  if (state?.content_state === "generating") return { ran: false, reason: "enriching" };

  const key = googlePlacesKeyOrNull(opts.env ?? Deno.env);
  if (!key) return { ran: false, reason: "no_key" };

  const opened = await openEnrichmentRun(admin, placeId, {
    trigger: "on_reservation_failed",
    seededBy: opts.seededBy,
    subprocesses: opts.subprocesses,
    entryStage: "first",
    cooldownHours: opts.cooldownHours,
  });
  if (!opened.ok) return { ran: false, reason: "error", error: opened.error };
  if (opened.blocked) return { ran: false, reason: opened.blocked };

  const google = await fetchGoogleBasics(googlePlaceId, key, { maxPhotos: 0 });
  if (!google.ok) {
    await reportCrenupSteps(admin, placeId, {
      details: stepFailed(`Google refetch after a wrong number failed: ${google.error}`, { via: "refetch" }),
    });
    await closeEnrichmentRun(admin, opened.runId, "failed", { reason: google.error, stage: "first" });
    return { ran: false, reason: "error", error: google.error };
  }

  const pins = activeFieldPins(readFieldPins(place.enrichment_sources));
  const planned = refetchPatch({
    row: place as RefetchRow,
    googlePhone: google.basics.phone,
    businessStatus: google.businessStatus,
    now: new Date().toISOString(),
    pins,
  });
  if (Object.keys(planned.patch).length > 0) {
    const written = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: planned.patch,
    });
    if (!written.ok) {
      await reportCrenupSteps(admin, placeId, {
        details: stepFailed(`The refetched phone was not saved: ${written.error}`, { via: "refetch" }),
      });
      await closeEnrichmentRun(admin, opened.runId, "failed", { reason: written.error, stage: "first" });
      return { ran: false, reason: "error", error: written.error };
    }
  }
  await reportCrenupSteps(admin, placeId, {
    details: refetchOutcome({
      businessStatus: google.businessStatus,
      phoneChanged: planned.phoneChanged,
      pinned: planned.pinned,
      googleHasPhone: !!google.basics.phone,
    }),
  });
  await closeEnrichmentRun(admin, opened.runId, "succeeded", {
    reason: planned.phoneChanged ? "the phone was replaced with Google's" : "the phone did not change",
    stage: "done",
  });
  return { ran: true, phoneChanged: planned.phoneChanged };
}
