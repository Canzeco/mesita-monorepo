// The smoke Enrich (MESITA-2803): one real Render run on one fixture place,
// startable without an admin press so a pipeline check needs no human.
//
// Guards, in order: the fixture must be in the catalog (never created here);
// the fixture must have sat still for SMOKE_COOLDOWN_MS (the claim, the run's
// write and its stop all bump places.updated_at, so a caller in a loop starts
// at most one run per cooldown); then startEnrichment claims it, so a fixture
// already enriching is 409 and Render is not called.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { startEnrichment } from "./enrich-start.ts";

/** Taquería Orinoco. A Google id survives a catalog Reset; a place id does not. */
export const SMOKE_FIXTURE_GOOGLE_PLACE_ID = "ChIJy7PI7Su_YoYR_wlii-N4EVM";

/** The fixture must be untouched this long before another smoke run starts. */
export const SMOKE_COOLDOWN_MS = 60 * 60_000;

export type SmokeStart =
  | { ok: true; placeId: string; task: string }
  | { ok: false; status: number; error: string; placeId?: string };

/** Null when the fixture may start now, else why not. */
export function smokeCooldownRefusal(
  updatedAt: string | null | undefined,
  now: number,
): string | null {
  const last = updatedAt ? Date.parse(updatedAt) : NaN;
  if (Number.isNaN(last)) return null;
  const wait = last + SMOKE_COOLDOWN_MS - now;
  if (wait <= 0) return null;
  return `The fixture changed less than ${SMOKE_COOLDOWN_MS / 60_000} minutes ago; try again in ${Math.ceil(wait / 60_000)} min.`;
}

export async function startSmokeEnrich(
  admin: SupabaseClient,
  opts: {
    now?: number;
    env?: { get(name: string): string | undefined };
    fetchImpl?: typeof fetch;
  } = {},
): Promise<SmokeStart> {
  const { data: profile, error } = await admin
    .from("place_profiles")
    .select("id")
    .eq("google_place_id", SMOKE_FIXTURE_GOOGLE_PLACE_ID)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: `fixture: ${error.message}` };
  const placeId = (profile as { id?: string } | null)?.id;
  if (!placeId) {
    return {
      ok: false,
      status: 404,
      error: `The smoke fixture (${SMOKE_FIXTURE_GOOGLE_PLACE_ID}) is not in the catalog; create it in admin first.`,
    };
  }

  const { data: place, error: placeErr } = await admin
    .from("places")
    .select("updated_at")
    .eq("id", placeId)
    .maybeSingle();
  if (placeErr) return { ok: false, status: 500, error: `fixture: ${placeErr.message}`, placeId };
  const cooling = smokeCooldownRefusal(
    (place as { updated_at?: string | null } | null)?.updated_at,
    opts.now ?? Date.now(),
  );
  if (cooling) return { ok: false, status: 429, error: cooling, placeId };

  const started = await startEnrichment(admin, {
    placeIds: [placeId],
    env: opts.env,
    fetchImpl: opts.fetchImpl,
  });
  if (!started.ok) return { ok: false, status: started.status, error: started.error, placeId };
  return { ok: true, placeId, task: started.task };
}
