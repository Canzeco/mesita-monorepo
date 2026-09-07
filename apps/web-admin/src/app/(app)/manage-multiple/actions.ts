"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { createPlaceFromGooglePlaceId as createPlaceFromGooglePlaceIdImpl } from "@/lib/create-place-from-google-place";
import type { PlanKey } from "@/lib/business/plans";

// ════════════════════════════════════════════════════════════════════════
// Places — a super-admin drives MANY places at once through the admin-* edge
// functions. The operator's JWT email is in super_admins, so _shared/auth.ts
// grants access regardless of project_members.
//
// These lived in the retired per-place admin console (`manage-single`) until
// it was deleted; this page was their only surviving caller, so they moved
// here rather than into a shared lib nothing else imports. The per-place
// editor itself lives on in the business console (`web-business`).
// ════════════════════════════════════════════════════════════════════════

// `code` is the EF's machine-readable failure (efInvoke already keeps it off
// `body.code`). Optional because most call sites only ever show a sentence.
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string | null };

// ── Place search ─────────────────────────────────────────────────────────

/**
 * Why the enrichment queue stopped, straight off `pulseBlockedAt` in
 * `_shared/pulse-pieces.ts`. `failed` = the function ran and could not do its
 * job; `missing` = it has no event yet. The EF ships it beside the number,
 * because the number alone cannot tell those two apart at 0.
 */
export type PulseBlock = {
  key: string;
  index: number;
  state: "failed" | "missing";
};

export type PlaceHit = {
  id: string;
  slug: string | null;
  /** Generated display label: coalesce(mesita_name, google_name). */
  name: string;
  /** Google's own label. The catalog table shows THIS, not `name`. */
  google_name: string | null;
  category: string | null;
  category_label: string | null;
  /** Super Categories: Intaker-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  state: string | null;
  address: string | null;
  photo: string | null;
  zone: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  content_state: string | null;
  listing_type: string | null;
  // ── The state facts (labels: Created · Active · Listed · Requested ·
  //    Enriching · Enriched · Verified · Partnered · Visit Rewards ·
  //    Mesita Pay · Mesita Credits) plus the quick-view commercial block
  //    (promotion · pickup · delivery). Bools except Requested (0…n),
  //    Visit Rewards (0|1|2) and promotion (0–7). All derived (or
  //    projected) in admin-web-search-places, except Enriching which is
  //    content_state generating/queued (MESITA-453 whole-pipeline). The
  //    acceptance bits are stored operator toggles on places.
  /** Google Place ID spine — used to match a Mesita Search paste. */
  google_place_id: string | null;
  /** google_place_id present — the identity spine every run starts from. */
  seeded: boolean;
  /** A guest can reach it: projects.state, per the consumer RLS policy. */
  listed: boolean;
  /** Derived has-demand for filters. Catalog State shows request_count. */
  requested: boolean;
  /** Guest request count — the Requested State fact, 0…n. */
  request_count: number;
  /** Intaker pipeline mid-flight (content_state generating/queued). */
  enriching: boolean;
  /** Operating (MESITA-1239): Google's businessStatus, verbatim. NULL = Google
   *  is silent, which is a third state and not OPERATIONAL. A FLAG, never a
   *  visibility gate — Listed above is the gate. */
  business_state: string | null;
  /** When Operating was last observed. Without it a stale claim reads current. */
  business_state_at: string | null;
  /** PULSE: how far the ten-piece queue got, 0-10. 0 means it never started
   *  — or the place predates piece reporting and has no events. */
  enrich_pulse: number;
  /** The ladder's length, so nothing hardcodes 9. */
  enrich_pulse_total: number;
  /** The rung names in queue order, from the server. Never hand-copy this
   *  list — a reorder would put the wrong name beside every row. */
  enrich_pulse_labels: string[];
  /** Why the queue stopped where it did — null once it has finished. */
  enrich_pulse_blocked: PulseBlock | null;
  /** An APPROVED project_verifications row — ownership proof, not a badge. */
  verified: boolean;
  /** plan !== "free" — the place pays Mesita. */
  partner: boolean;
  /** Live: paid ∧ strategy above Zero ∧ promo lane open. */
  promoting: boolean;
  /** How hard. Engine 0-3; operator display is 0|1|2 (Dominant → 2). */
  promoting_level: 0 | 1 | 2 | 3;
  /** places.mesita_pay_enabled — the operator's "accepts Mesita Pay" toggle.
   *  The gateway engine still gates the rail itself. */
  mesita_pay: boolean;
  /** places.credits_enabled — the operator's "accepts Credits" toggle. */
  credits: boolean;
  /** places.pickup_orders_enabled — offers pickup orders (intent bit). */
  pickup: boolean;
  /** places.delivery_orders_enabled — offers delivery orders (intent bit). */
  delivery: boolean;
  /** The Promotion score, 0–7 — offering completeness, shaped server-side
   *  (promotion-score.ts twins) so the catalog and the Promos bar agree. */
  promotion: number;
};

// The search EF only guarantees id/name — every other field may be absent,
// hence the defensive `?? null` normalization below.
type RawPlaceHit = Pick<PlaceHit, "id" | "name"> & Partial<Omit<PlaceHit, "id" | "name">>;

function normalizePlaceHit(raw: RawPlaceHit): PlaceHit {
  const contentState = raw.content_state ?? null;
  const listingType = raw.listing_type ?? null;
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: raw.name,
    google_name: raw.google_name ?? null,
    category: raw.category ?? null,
    category_label: raw.category_label ?? null,
    state: raw.state ?? null,
    address: raw.address ?? null,
    photo: raw.photo ?? null,
    zone: raw.zone ?? null,
    google_stars_overall:
      typeof raw.google_stars_overall === "number" ? raw.google_stars_overall : null,
    google_review_count:
      typeof raw.google_review_count === "number" ? raw.google_review_count : null,
    content_state: contentState,
    listing_type: listingType,
    enriching: contentState === "generating" || contentState === "queued",
    // No listing_type fallbacks here any more: it fuses paying and promoting
    // into one stale enum, so guessing from it would put a wrong flag on
    // screen rather than an honest "not yet" (MESITA-1152 / MESITA-1166).
    google_place_id: raw.google_place_id ?? null,
    seeded: raw.seeded ?? false,
    listed: raw.listed ?? false,
    request_count:
      typeof raw.request_count === "number" && Number.isFinite(raw.request_count)
        ? raw.request_count
        : 0,
    requested:
      typeof raw.requested === "boolean"
        ? raw.requested
        : contentState !== "ready" &&
          typeof raw.request_count === "number" &&
          raw.request_count > 0,
    business_state:
      typeof raw.business_state === "string" ? raw.business_state : null,
    business_state_at:
      typeof raw.business_state_at === "string" ? raw.business_state_at : null,
    enrich_pulse: raw.enrich_pulse ?? 0,
    // No `?? 9` here any more: the total and the labels come from the same
    // server list, so a client fallback could only ever disagree with it. The
    // label fallback subtracts one — the labels are indexed by function number
    // with the Created floor label at 0, so eleven of them describe a 0-10 scale.
    enrich_pulse_total: raw.enrich_pulse_total ??
      (raw.enrich_pulse_labels ? raw.enrich_pulse_labels.length - 1 : 0),
    enrich_pulse_labels: raw.enrich_pulse_labels ?? [],
    // No invented fallback: absent means the payload predates the field, and
    // defaulting to "missing" would claim a fact we did not read.
    enrich_pulse_blocked: raw.enrich_pulse_blocked ?? null,
    verified: raw.verified ?? false,
    partner: raw.partner ?? false,
    promoting: raw.promoting ?? false,
    promoting_level: raw.promoting_level ?? 0,
    mesita_pay: raw.mesita_pay ?? false,
    credits: raw.credits ?? false,
    pickup: raw.pickup ?? false,
    delivery: raw.delivery ?? false,
    promotion:
      typeof raw.promotion === "number" && Number.isFinite(raw.promotion)
        ? raw.promotion
        : 0,
  };
}

/** Mesita catalog lookup by Google Place IDs — read-only, no create/enrich. */
export async function searchPlacesByGoogleIds(
  googlePlaceIds: string[],
): Promise<Result<PlaceHit[]>> {
  const ids = googlePlaceIds.map((id) => id.trim()).filter((id) => id.length >= 18);
  if (ids.length === 0) return { ok: true, data: [] };
  const r = await efInvoke<{ places: RawPlaceHit[] }>("admin-web-search-places", {
    googlePlaceIds: ids.slice(0, 250),
    limit: Math.min(ids.length, 250),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: (r.data.places ?? []).map(normalizePlaceHit) };
}

/**
 * Every place on Mesita — no paste, no query. Mesita Search's All places
 * button. The EF walks the whole catalog server-side and ships `total`
 * beside the rows, so a run that hits its ceiling can say so instead of
 * reading as a short catalog.
 */
export async function listAllPlaces(): Promise<
  Result<{ places: PlaceHit[]; total: number }>
> {
  const r = await efInvoke<{ places: RawPlaceHit[]; total?: number | null }>(
    "admin-web-search-places",
    { all: true },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const places = (r.data.places ?? []).map(normalizePlaceHit);
  return {
    ok: true,
    data: {
      places,
      total: typeof r.data.total === "number" ? r.data.total : places.length,
    },
  };
}

// ── State writes ─────────────────────────────────────────────────────────
// Every setter is fire-and-check: the batch rows report ok/error and re-read
// the catalog afterwards, so none of them needs the place row back.

/** Listed is the guest-visibility gate: projects.state, which is what the
 *  consumer RLS policy projects_select_public_visible gates every guest read
 *  on. Unlisting removes the place from browse, search, the swipe deck and
 *  any shared link at once. business-web-update-place does not accept
 *  `state`, so this is its own admin door (admin-web-set-place-listed). */
export async function setPlaceListed(
  placeId: string,
  listed: boolean,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-set-place-listed", {
    placeId,
    listed,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

/** Operator Active (State box). Writes business_state. Active off also
 *  unlists — guests disappear in the same apply. Active on does not list. */
export async function setPlaceActive(
  placeId: string,
  active: boolean,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-set-place-active", {
    placeId,
    active,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

/** Admin attestation of ownership proof. Verified is one-time; yes only. */
export async function setPlaceVerified(
  placeId: string,
): Promise<Result<{ verified: true; alreadyVerified: boolean }>> {
  const r = await efInvoke<{ verified?: boolean; alreadyVerified?: boolean }>(
    "admin-web-set-place-verified",
    { placeId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      verified: true,
      alreadyVerified: r.data.alreadyVerified === true,
    },
  };
}

// business-web-update-place refuses a body carrying a `plan` key — it is
// the paid door's field, and the paid door is Stripe. The admin grants it
// through its own door instead: no Stripe, no money (admin-web-set-plan).
//
// `rates` rides along on purpose (MESITA-818/912). The partnership and the
// strategy that justifies it are one decision, and sending them together
// makes it ONE atomic write. Join may land on Zero (paid plan + null rates) —
// the old 409 `no_strategy` guard is retired; a 0% Mesita Partner is
// prevented by the shared listing_type derivation in the EF instead.
export async function setPlacePlan(
  placeId: string,
  plan: PlanKey,
  rates?: Record<string, number | null>,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-set-plan", {
    placeId,
    plan,
    ...(rates ?? {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

/** Rates-only strategy switch — no plan write (MESITA-912).
 *  Plan-less body on admin-web-set-plan (one-caller ACL; never business-web). */
export async function setPlaceStrategy(
  placeId: string,
  rates: Record<string, number | null>,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-set-plan", { placeId, ...rates });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// ── Intake ───────────────────────────────────────────────────────────────

// Re-enrichment depth:
//   full     → research + analysis + contents (fresh gather; refreshes phone)
//   analysis → analysis + contents, reusing stored gathered (no re-gather)
//   contents → contents only, reusing stored gathered + analysis (cheapest)
// The lighter modes need a prior full run; the EF rejects (422) otherwise.
export type ReenrichMode = "full" | "analysis" | "contents";

// Manually re-run the Intaker pipeline for one place. Re-seeds place_research
// to the stage implied by `mode`; the cron poller takes it from there. Runs
// ASYNC — the batch row reports the trigger, not the finish.
export async function enrichPlace(
  projectId: string,
  mode: ReenrichMode = "full",
): Promise<Result<true>> {
  const r = await efInvoke<{ enrichmentTriggered: boolean }>(
    "admin-web-enrich-place",
    { projectId, mode },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// The create-place pipeline is shared with the bulk creator — see the single
// canonical implementation in @/lib/create-place-from-google-place.
export async function createPlaceFromGooglePlaceId(placeId: string) {
  return createPlaceFromGooglePlaceIdImpl(placeId);
}
