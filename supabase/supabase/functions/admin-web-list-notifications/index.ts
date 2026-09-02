// Supabase Edge Function — admin-web-list-notifications (admin caller)
//
// Powers admin.mesita.ai/global-performance → Notifications view. The
// console is intentionally NOT realtime: the operator pulls a fresh feed
// (manual Refresh + light client polling), and this EF recomputes the feed
// from source tables on every call.
//
// One category so far — **atlas** — with four event types. Three are
// *derived* (we read the timestamps the product already writes); the fourth
// reads the dedicated per-step events table the Intaker pipeline appends to:
//
//   atlas.place_created      a new row in public.places
//   atlas.place_enriched     a place whose Intaker pass completed
//                            (enriched_at stamped) — carries the textual
//                            summary the enricher synthesised
//   atlas.enrichment_step    one Intaker pipeline step finished (or failed) —
//                            read from public.place_enrichment_events, written
//                            by the enrich-place stage EFs as the run progresses
//   atlas.ownership_claimed  someone submitted an ownership proof
//                            (public.project_verifications) for a place
//
// The envelope is category-agnostic so future categories slot in without a
// client rewrite: each item is { id, category, type, occurredAt, place,
// actor, detail, meta } and the client renders title/icon from `type`.
//
// Consumer-activity categories (MESITA-834 — powers the per-place
// Performance tab, scoped via `placeId`; the Global Monitor shows them too):
//
//   consumer.place_saved                a consumer saved the place
//   rewards.ticket_created              a reward ticket was opened in-app
//   rewards.ticket_visit                its QR met the venue (first scan)
//   rewards.ticket_closed               staff marked the visit done (v3b;
//                                       status=revealed — not a payment event)
//   rewards.review_submitted            the post-visit review landed
//   rewards.ticket_reported             the GUEST filed a complaint about the
//                                       visit (v3c, MESITA-851) — the one
//                                       event in this feed that asks the
//                                       operator to act, since a report is
//                                       evidence and never an auto-strike
//   reservations.reservation_created    a reservation request was placed
//
// All derived from tables the product already writes — no new event tables.
//
// Filters: `category` narrows to a category; `types` narrows to specific
// event types server-side (skips whole source reads — step events flood the
// feed, so the client can ask for just what it shows); `projectId` narrows
// every source to one place; `q` is a case-insensitive place-name substring
// filter applied after the merge (the per-source window is already capped).
//
// "Who called it" for a creation: places don't persist the caller at insert
// time (business-web-create-project deliberately leaves the place unowned until an
// ownership claim is approved), so the closest honest signal is the place's
// current owner — resolved here via project_members(role=owner) → managers.
// Unclaimed places report actor = null and meta.claimed = false. The exact
// claimant, when it exists, is its own ownership_claimed event.
//
// Place embedding — each source resolves the place profile through the FK it
// actually has (PostgREST embeds follow declared FKs only):
//   • place_enrichment_events.place_id → places(id)      → embed places directly
//   • project_verifications.project_id  → projects(id)     → hop projects → places
// projects (the owned entity) shares its PK 1:1 with places and carries the
// `slug`; the place profile columns (name/address/…) live on places. So the
// claims source embeds `projects(id, slug, places(…))` and flattens the two
// halves back into one PlaceRef. Do NOT embed `places` straight off
// project_verifications — there is no such FK and PostgREST 500s with
// "Could not find a relationship between 'project_verifications' and 'places'".
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-list-notifications

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { CLOSED_TICKET_STATUS } from "../_shared/ticket-status.ts";
import {
  one,
  placeRef,
  type PlaceShape,
  projectPlaceRef,
  type ProjectPlaceShape,
  truncate,
} from "./notification-shapes.ts";
import {
  consumerActor,
  mapPlaceCreatedNotification,
  type Category,
  type ConsumerShape,
  type CreatedNotificationRow,
  type NotificationItem,
  type NotificationType,
} from "./notification-mappers.ts";
import { attachPlaceStatusFacts } from "./notification-status.ts";

const ALL_TYPES: NotificationType[] = [
  "atlas.place_created",
  "atlas.place_enriched",
  "atlas.enrichment_step",
  "atlas.ownership_claimed",
  "consumer.place_saved",
  "rewards.ticket_created",
  "rewards.ticket_visit",
  "rewards.ticket_closed",
  "rewards.review_submitted",
  "rewards.ticket_reported",
  "reservations.reservation_created",
];

const ALL_CATEGORIES: Category[] = ["atlas", "consumer", "rewards", "reservations"];

// Consumer-activity sources all FK the projects entity (shared PK with
// places) — same hop-through-projects embed the claims source uses, plus the
// consumer for the actor line.
const PROJECT_EMBED =
  "project:projects(id, slug, place:places(name, address, category_label, google_place_id))";
const CONSUMER_EMBED =
  "consumer:consumers(full_name, first_name, last_name, instagram_handle)";

type Body = {
  // "all" (or omitted) returns every category. A specific category narrows
  // the feed server-side.
  category?: Category | "all" | null;
  // Narrow to specific event types server-side (empty/omitted = all types).
  types?: string[] | null;
  // Narrow every source to a single place (the places/projects shared PK).
  // `placeId` is the canonical key (MESITA-26); `projectId` is the legacy alias.
  placeId?: string | null;
  projectId?: string | null;
  // Case-insensitive place-name substring filter (applied post-merge).
  q?: string | null;
  limit?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const body = await readJsonOr<Body>(req, {});
  const limit = clampIntRange(body.limit ?? 60, 1, 200);
  const category = body.category ?? "all";
  const typesFilter = (Array.isArray(body.types) ? body.types : [])
    .filter((t): t is NotificationType => ALL_TYPES.includes(t as NotificationType));
  const wantType = (t: NotificationType) =>
    (category === "all" || t.startsWith(`${category}.`)) &&
    (typesFilter.length === 0 || typesFilter.includes(t));
  const wantAtlas = category === "all" || category === "atlas";
  const projectId = readPlaceIdAlias(body) || null;
  const q = (body.q ?? "").toString().trim().toLowerCase() || null;

  const items: NotificationItem[] = [];

  if (wantAtlas) {
    // Pull a window per source then merge-sort-slice. Each source is capped
    // at `limit` so a flood in one type can't starve the others before the
    // final sort. Sources whose type the caller filtered out are skipped
    // entirely.
    const createdQuery = wantType("atlas.place_created")
      ? (() => {
        let qb = admin
          .from("profiles")
          .select(
            "id, slug, name, address, category_label, google_place_id, listing_type, status, created_at, enriched_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (projectId) qb = qb.eq("id", projectId);
        return qb;
      })()
      : Promise.resolve({ data: null, error: null });

    const enrichedQuery = wantType("atlas.place_enriched")
      ? (() => {
        let qb = admin
          .from("profiles")
          .select(
            "id, slug, name, address, category_label, google_place_id, editorial_summary, description, details, enriched_at",
          )
          .not("enriched_at", "is", null)
          .order("enriched_at", { ascending: false })
          .limit(limit);
        if (projectId) qb = qb.eq("id", projectId);
        return qb;
      })()
      : Promise.resolve({ data: null, error: null });

    const stepsQuery = wantType("atlas.enrichment_step")
      ? (() => {
        let qb = admin
          .from("place_enrichment_events")
          .select(
            "id, place_id, step, step_name, status, detail, meta, created_at, place:places(id, name, address, category_label, google_place_id)",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (projectId) qb = qb.eq("place_id", projectId);
        return qb;
      })()
      : Promise.resolve({ data: null, error: null });

    const claimsQuery = wantType("atlas.ownership_claimed")
      ? (() => {
        let qb = admin
          .from("project_verifications")
          .select(
            // project_verifications has no FK to places — it references the
            // projects entity (shared PK with places). Hop through projects to
            // reach the profile; slug lives on projects, the rest on places.
            "id, place_id, method, requester_email, status, created_at, project:projects(id, slug, place:places(name, address, category_label, google_place_id))",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (projectId) qb = qb.eq("place_id", projectId);
        return qb;
      })()
      : Promise.resolve({ data: null, error: null });

    const [createdRes, enrichedRes, stepsRes, claimsRes] = await Promise.all([
      createdQuery,
      enrichedQuery,
      stepsQuery,
      claimsQuery,
    ]);

    if (createdRes.error) {
      return json({ ok: false, error: `places_created: ${createdRes.error.message}` }, 500);
    }
    if (enrichedRes.error) {
      return json({ ok: false, error: `places_enriched: ${enrichedRes.error.message}` }, 500);
    }
    if (stepsRes.error) {
      return json({ ok: false, error: `enrichment_steps: ${stepsRes.error.message}` }, 500);
    }
    if (claimsRes.error) {
      return json({ ok: false, error: `claims: ${claimsRes.error.message}` }, 500);
    }

    const createdRows = (createdRes.data ?? []) as CreatedNotificationRow[];

    // Resolve the current owner for the created places in one batched read.
    // Most freshly-created places are unclaimed, so this map is usually small.
    const ownerByPlace = new Map<string, { email: string | null; name: string | null }>();
    const createdIds = createdRows.map((r) => r.id);
    if (createdIds.length > 0) {
      const { data: owners, error: ownersErr } = await admin
        .from("project_members")
        // project_members.manager_id → managers (the business-account table;
        // no compat view exists, so embedding any older name 500s). Alias the
        // result back to `business`.
        .select("place_id, business:managers(email, full_name, first_name, last_name)")
        .eq("role", "owner")
        .in("place_id", createdIds);
      if (ownersErr) {
        return json({ ok: false, error: `owners: ${ownersErr.message}` }, 500);
      }
      for (const row of (owners ?? []) as Array<{
        place_id: string;
        business:
          | { email: string | null; full_name: string | null; first_name: string | null; last_name: string | null }
          | Array<{ email: string | null; full_name: string | null; first_name: string | null; last_name: string | null }>
          | null;
      }>) {
        const b = one(row.business);
        const joined = [b?.first_name, b?.last_name].filter(Boolean).join(" ").trim();
        const fullName = b?.full_name?.trim() || null;
        const name = fullName || (joined.length > 0 ? joined : null);
        ownerByPlace.set(row.place_id, { email: b?.email ?? null, name });
      }
    }

    // ── atlas.place_created ──────────────────────────────────────────────
    for (const v of createdRows) {
      const owner = ownerByPlace.get(v.id);
      items.push(mapPlaceCreatedNotification(v, owner));
    }

    // ── atlas.place_enriched ─────────────────────────────────────────────
    for (const v of (enrichedRes.data ?? []) as Array<
      PlaceShape & {
        editorial_summary: string | null;
        description: string | null;
        details: unknown;
        enriched_at: string;
      }
    >) {
      const summary =
        (v.editorial_summary && v.editorial_summary.trim()) ||
        (v.description && v.description.trim()) ||
        null;
      const detailsFields =
        v.details && typeof v.details === "object" && !Array.isArray(v.details)
          ? Object.keys(v.details as Record<string, unknown>).length
          : 0;
      items.push({
        id: `atlas.place_enriched:${v.id}`,
        category: "atlas",
        type: "atlas.place_enriched",
        occurredAt: v.enriched_at,
        place: placeRef(v),
        actor: "Intaker",
        detail: summary ? truncate(summary, 260) : null,
        meta: { detailsFields, hasSummary: !!summary },
      });
    }

    // ── atlas.enrichment_step ────────────────────────────────────────────
    for (const e of (stepsRes.data ?? []) as Array<{
      id: string;
      place_id: string;
      step: string;
      step_name: string;
      status: string;
      detail: string | null;
      meta: Record<string, unknown> | null;
      created_at: string;
      place: PlaceShape | PlaceShape[] | null;
    }>) {
      items.push({
        id: `atlas.enrichment_step:${e.id}`,
        category: "atlas",
        type: "atlas.enrichment_step",
        occurredAt: e.created_at,
        place: placeRef(one(e.place)),
        actor: "Intaker",
        detail: e.detail,
        meta: {
          step: e.step,
          stepName: e.step_name,
          status: e.status,
          ...(e.meta && typeof e.meta === "object" ? e.meta : {}),
        },
      });
    }

    // ── atlas.ownership_claimed ──────────────────────────────────────────
    for (const c of (claimsRes.data ?? []) as Array<{
      id: string;
      place_id: string;
      method: string | null;
      requester_email: string | null;
      status: string | null;
      created_at: string;
      project: ProjectPlaceShape | ProjectPlaceShape[] | null;
    }>) {
      items.push({
        id: `atlas.ownership_claimed:${c.id}`,
        category: "atlas",
        type: "atlas.ownership_claimed",
        occurredAt: c.created_at,
        place: projectPlaceRef(one(c.project)),
        actor: c.requester_email ?? null,
        detail: null,
        meta: { method: c.method, status: c.status },
      });
    }
  }

  // ── Consumer activity (consumer / rewards / reservations) ─────────────
  // Same per-source window + merge pattern as atlas. Every source hops
  // project → places for the profile and embeds the consumer for the actor.
  // Visit tickets contribute three event types from three timestamps — each
  // gets its OWN window (ordered by its own timestamp) so a burst of creates
  // can't hide older visits/closes. The ticket TABLE is the type now: the
  // `kind` discriminator is gone, so no payload carries it.
  {
    type ActivityRow = {
      id: string;
      created_at: string;
      project: ProjectPlaceShape | ProjectPlaceShape[] | null;
      consumer: ConsumerShape | ConsumerShape[] | null;
    };

    const activitySource = (
      table: string,
      extraCols: string,
      orderCol: string,
      wanted: boolean,
      eqFilters: Record<string, string> = {},
    ) =>
      wanted
        ? (() => {
          let qb = admin
            .from(table)
            .select(
              `id, created_at, ${extraCols}${PROJECT_EMBED}, ${CONSUMER_EMBED}`,
            )
            .order(orderCol, { ascending: false })
            .limit(limit);
          if (projectId) qb = qb.eq("place_id", projectId);
          if (orderCol !== "created_at") qb = qb.not(orderCol, "is", null);
          for (const [col, val] of Object.entries(eqFilters)) {
            qb = qb.eq(col, val);
          }
          return qb;
        })()
        : Promise.resolve({ data: null, error: null });

    const [
      savesRes,
      tCreatedRes,
      tVisitRes,
      tClosedRes,
      reviewsRes,
      reportsRes,
      resvRes,
    ] = await Promise.all([
        activitySource("favorites", "", "created_at", wantType("consumer.place_saved")),
        activitySource(
          "visit_tickets",
          "status, ",
          "created_at",
          wantType("rewards.ticket_created"),
        ),
        activitySource(
          "visit_tickets",
          "status, first_scanned_at, ",
          "first_scanned_at",
          wantType("rewards.ticket_visit"),
        ),
        // Close = status revealed (v3b). Order by revealed_at so a later
        // status rewrite can't reshuffle history; paid_at is still stamped
        // by informal close but is no longer the feed's vocabulary.
        activitySource(
          "visit_tickets",
          "status, revealed_at, bill_subtotal_cents, discount_percent, discount_cents, currency, ",
          "revealed_at",
          wantType("rewards.ticket_closed"),
          { status: CLOSED_TICKET_STATUS },
        ),
        activitySource(
          "ticket_reviews",
          "overall, food, service, ambience, comments, ",
          "created_at",
          wantType("rewards.review_submitted"),
        ),
        activitySource(
          "ticket_reports",
          "reason, details, status, ",
          "created_at",
          wantType("rewards.ticket_reported"),
        ),
        activitySource(
          "reservation_tickets",
          "status, party_size, reserved_at, is_test, ",
          "created_at",
          wantType("reservations.reservation_created"),
        ),
      ]);

    for (const [label, r] of [
      ["favorites", savesRes],
      ["tickets_created", tCreatedRes],
      ["tickets_visit", tVisitRes],
      ["tickets_closed", tClosedRes],
      ["ticket_reviews", reviewsRes],
      ["ticket_reports", reportsRes],
      ["reservations", resvRes],
    ] as const) {
      if (r.error) {
        return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
      }
    }

    const push = (
      type: NotificationType,
      category: Category,
      row: ActivityRow,
      occurredAt: string,
      detail: string | null,
      meta: Record<string, unknown>,
    ) =>
      items.push({
        id: `${type}:${row.id}`,
        category,
        type,
        occurredAt,
        place: projectPlaceRef(one(row.project)),
        actor: consumerActor(one(row.consumer)),
        detail,
        meta,
      });

    for (const r of ((savesRes.data ?? []) as unknown[]) as ActivityRow[]) {
      push("consumer.place_saved", "consumer", r, r.created_at, null, {});
    }

    for (const r of ((tCreatedRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      status: string;
    }>) {
      push("rewards.ticket_created", "rewards", r, r.created_at, null, {
        status: r.status,
      });
    }

    // A first scan is the visit signal — the guest's QR met the venue.
    for (const r of ((tVisitRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      status: string;
      first_scanned_at: string;
    }>) {
      push("rewards.ticket_visit", "rewards", r, r.first_scanned_at, null, {
        status: r.status,
      });
    }

    for (const r of ((tClosedRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      status: string;
      revealed_at: string;
      bill_subtotal_cents: number | null;
      discount_percent: number | null;
      discount_cents: number | null;
      currency: string | null;
    }>) {
      push("rewards.ticket_closed", "rewards", r, r.revealed_at, null, {
        status: r.status,
        subtotalCents: r.bill_subtotal_cents,
        discountPercent: r.discount_percent,
        discountCents: r.discount_cents,
        currency: r.currency,
      });
    }

    for (const r of ((reviewsRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      overall: number | null;
      food: number | null;
      service: number | null;
      ambience: number | null;
      comments: string | null;
    }>) {
      push(
        "rewards.review_submitted",
        "rewards",
        r,
        r.created_at,
        r.comments?.trim() ? truncate(r.comments, 260) : null,
        {
          overall: r.overall,
          food: r.food,
          service: r.service,
          ambience: r.ambience,
        },
      );
    }

    // The guest's complaint (v3c). `detail` carries their own words when they
    // wrote any — the operator reads this to decide whether the place earns a
    // strike, which stays a deliberate human call.
    for (const r of ((reportsRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      reason: string;
      details: string | null;
      status: string;
    }>) {
      push(
        "rewards.ticket_reported",
        "rewards",
        r,
        r.created_at,
        r.details?.trim() ? truncate(r.details, 260) : null,
        // reportId rides along so manage-single can drive the triage EF
        // (admin-web-review-ticket-report, MESITA-1311) without parsing
        // the composite item id.
        { reason: r.reason, status: r.status, reportId: r.id },
      );
    }

    for (const r of ((resvRes.data ?? []) as unknown[]) as Array<ActivityRow & {
      status: string;
      party_size: number | null;
      reserved_at: string | null;
      is_test: boolean;
    }>) {
      push("reservations.reservation_created", "reservations", r, r.created_at, null, {
        status: r.status,
        partySize: r.party_size,
        reservedAt: r.reserved_at,
        isTest: r.is_test,
      });
    }
  }

  // Stamp the eight Status facts on every item that has a place. Same
  // helpers as the catalog / Status box so the Monitor cannot disagree.
  await attachPlaceStatusFacts(admin, items);

  // Place-name substring filter, then newest-first across every type, then cap
  // to the requested window. Counts reflect the filtered set so the client's
  // pills stay consistent with what is shown.
  const filtered = q
    ? items.filter((i) => (i.place?.name ?? "").toLowerCase().includes(q))
    : items;

  const counts: Record<string, number> = {};
  for (const i of filtered) counts[i.type] = (counts[i.type] ?? 0) + 1;

  filtered.sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );
  const notifications = filtered.slice(0, limit);

  return json({
    ok: true,
    notifications,
    counts,
    categories: ALL_CATEGORIES,
    types: ALL_TYPES,
    total: filtered.length,
    generatedAt: new Date().toISOString(),
  });
});
