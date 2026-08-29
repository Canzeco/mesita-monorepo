// Place Status facts for Global Monitor — same nine the Status box and
// the Single Place catalog use, derived from the same helpers. Never
// listing_type. Never "claimed" as a fact (that's an owner row, not
// Verified).
//
//   created    google_place_id present (operator label Created; wire `seeded`)
//   active     Google business_status === OPERATIONAL
//   listed     projects.status ∈ (active, lead)
//   requested  request_count > 0 and content_status is not ready
//   enriched   PULSE high-water complete. Independent of enriching.
//   enriching  content_status generating/queued (live run)
//   verified   an approved project_verifications row
//   partner    plan ≠ free (operator label Partnered)
//   promoting  live discount (isPlacePromoting)
//   functions  completed Intake Create/Enrich subfunctions (pulse, details, …)

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isPaidPlan } from "../_shared/membership-enforcement-helpers.ts";
import { isPlacePromoting } from "../_shared/place-promoting.ts";
import {
  isPlaceEnriching,
  isPlaceListed,
  isPlaceRequested,
  isPlaceSeeded,
} from "../_shared/place-status.ts";
import { PULSE_TOTAL } from "../_shared/pulse-pieces.ts";
import type { EnrichmentMap, FunctionStateMap } from "../_shared/schema-catalog.ts";
import type { NotificationItem } from "./notification-mappers.ts";

export type PlaceStatusFacts = {
  seeded: boolean;
  active: boolean;
  listed: boolean;
  requested: boolean;
  enriching: boolean;
  enriched: boolean;
  enrichPulse: number;
  enrichPulseTotal: number;
  verified: boolean;
  partner: boolean;
  promoting: boolean;
  functions: Record<string, boolean>;
};

const PROFILE_COLS =
  "id, google_place_id, status, business_status, content_status, request_count, plan, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, promo_paused_until, plan_forfeited_at, strike_count, last_strike_at";

const EMPTY_ENRICHMENT: EnrichmentMap = {
  functions: {},
  highWater: 0,
  blockedAt: null,
};

export function completedFunctions(
  map: FunctionStateMap | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!map) return out;
  for (const [key, rec] of Object.entries(map)) {
    if (!rec) continue;
    if (rec.status === "completed") out[key] = true;
  }
  return out;
}

export function placeStatusFacts(input: {
  googlePlaceId: unknown;
  status: unknown;
  businessStatus: unknown;
  contentStatus?: unknown;
  requestCount?: unknown;
  plan: unknown;
  highWater: number;
  verified: boolean;
  promotingRow: Parameters<typeof isPlacePromoting>[0];
  functions?: FunctionStateMap;
}): PlaceStatusFacts {
  const highWater = Number.isFinite(input.highWater) ? input.highWater : 0;
  return {
    seeded: isPlaceSeeded(input.googlePlaceId),
    active: input.businessStatus === "OPERATIONAL",
    listed: isPlaceListed(input.status),
    requested: isPlaceRequested({
      requestCount: input.requestCount,
      contentStatus: input.contentStatus,
    }),
    enriching: isPlaceEnriching(input.contentStatus),
    enriched: highWater === PULSE_TOTAL,
    enrichPulse: highWater,
    enrichPulseTotal: PULSE_TOTAL,
    verified: input.verified,
    partner: isPaidPlan(typeof input.plan === "string" ? input.plan : null),
    promoting: isPlacePromoting(input.promotingRow),
    functions: completedFunctions(input.functions),
  };
}

/** Stamp `meta.statusFacts` on every item that has a place id. Best-effort. */
export async function attachPlaceStatusFacts(
  admin: SupabaseClient,
  items: NotificationItem[],
): Promise<void> {
  const ids = [
    ...new Set(
      items
        .map((item) => item.place?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (ids.length === 0) return;

  const [profileRes, verificationRes, enrichmentRes] = await Promise.all([
    admin.from("profiles").select(PROFILE_COLS).in("id", ids),
    admin
      .from("project_verifications")
      .select("place_id")
      .eq("status", "approved")
      .in("place_id", ids),
    admin.from("places").select("id, enrichment").in("id", ids),
  ]);

  if (profileRes.error) {
    console.error("[list-notifications] profiles:", profileRes.error.message);
    return;
  }
  if (verificationRes.error) {
    console.error(
      "[list-notifications] project_verifications:",
      verificationRes.error.message,
    );
  }
  if (enrichmentRes.error) {
    console.error("[list-notifications] places.enrichment:", enrichmentRes.error.message);
  }

  const verified = new Set<string>();
  for (const row of (verificationRes.data ?? []) as Array<{ place_id: string }>) {
    verified.add(row.place_id);
  }
  const enrichment = new Map<string, EnrichmentMap>();
  for (const row of (enrichmentRes.data ?? []) as Array<{
    id: string;
    enrichment: EnrichmentMap | null;
  }>) {
    if (row.enrichment) enrichment.set(row.id, row.enrichment);
  }

  const factsById = new Map<string, PlaceStatusFacts>();
  for (const row of (profileRes.data ?? []) as Array<Record<string, unknown>>) {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    factsById.set(
      id,
      placeStatusFacts({
        googlePlaceId: row.google_place_id,
        status: row.status,
        businessStatus: row.business_status,
        contentStatus: row.content_status,
        requestCount: row.request_count,
        plan: row.plan,
        highWater: (enrichment.get(id) ?? EMPTY_ENRICHMENT).highWater,
        verified: verified.has(id),
        promotingRow: row,
        functions: (enrichment.get(id) ?? EMPTY_ENRICHMENT).functions,
      }),
    );
  }

  for (const item of items) {
    const id = item.place?.id;
    if (!id) continue;
    const facts = factsById.get(id);
    if (!facts) continue;
    item.meta = { ...item.meta, statusFacts: facts };
  }
}
