// Supabase Edge Function — business-web-get-performance
//
// Naming: caller-verb-words. Caller = business, verb = get, words = performance.
//
// v3d (MESITA-852): the place's whole record in one call — the three bands the
// Performance tab renders.
//
//   summary   what the program did: tickets opened, visits, closes, the spend
//             it influenced, what the discounts cost, repeat guests.
//   content   what the guests PRODUCED — Mesita reviews with their 1–5 scores
//             and comments, plus the attested story / Google-review counts.
//             This is the output the discounts bought.
//   feed      the per-place activity stream, newest first.
//
// AGGREGATES ARE EXACT (same class of fix as admin-web-get-place-activity).
// Funnel / content counts run server-side with `{ count: "exact", head: true }`.
// Money + guest/repeat/by-action read only the narrow columns of this place's
// closed tickets (paginated past PostgREST's 1000-row page). The feed is a
// capped recent sample and must never be the source of the headline numbers.
//
// TWO HARD CONSTRAINTS, both load-bearing:
//
//   1. Every read is scoped to ONE place the caller is a member of
//      (requireMembership). An admin-shaped feed leaking a competitor's rows
//      would be a data breach between businesses.
//   2. NEVER expose a consumer's class or entry door — blended-rate privacy
//      (Product Rules §A). Nothing here selects class_key, and the feed
//      carries a first name at most. The issue's "redemption by segment" is
//      therefore reported BY ACTION (welcome / story / review), never by
//      class: the honest cut that doesn't leak who was Premium.
//
// WHAT IS DELIBERATELY ABSENT: views and swipes. There is no impressions
// table in this database — no view is recorded anywhere — so the funnel
// starts at "saved", the first stage that has a real row behind it. Shipping
// a zero or an estimate there would be inventing numbers a place might price
// against. Same for per-guest Instagram/Google CONTENT: those actions are
// self-attested (MESITA-849) and no URL is ever captured, so the counts are
// real and the artefacts don't exist.
//
// Closed = status "revealed" (v3b: the close is the unconditional signal).
// Admin Performance aligned to the same close predicate in MESITA-890.
//
// Body:     { placeId: string, feedLimit?: number, reviewLimit?: number }
// Response: { ok: true, summary, content, feed }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { CLOSED_TICKET_STATUS, TICKET_STATUS } from "../_shared/ticket-status.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_FEED_LIMIT = 40;
const MAX_FEED_LIMIT = 100;
const DEFAULT_REVIEW_LIMIT = 20;
const MAX_REVIEW_LIMIT = 50;
const CLOSED_PAGE = 1000;
// Pull enough recent ticket rows to seed the activity feed without pretending
// they are the whole history.
const FEED_TICKET_PAGE = 80;

// A ticket counts as HONORED once it closed — v3b made the close the single
// unconditional signal (MESITA-850), so this matches what activation records.
const CLOSED_STATUS = CLOSED_TICKET_STATUS;

const ATTESTED_STATUSES = [
  "self_verified",
  "ai_verified",
  "staff_verified",
  "waiter_verified",
] as const;

type Body = {
  placeId?: string;
  projectId?: string;
  feedLimit?: number;
  reviewLimit?: number;
};

type ClosedTicketRow = {
  id: string;
  consumer_id: string;
  story_status: string | null;
  review_status: string | null;
  bill_subtotal_cents: number | null;
  total_cents: number | null;
  discount_cents: number | null;
  discount_percent: number | null;
  bill_source: string | null;
  currency: string | null;
  created_at: string;
  revealed_at: string | null;
  first_scanned_at: string | null;
};

type FeedTicketRow = {
  id: string;
  status: string;
  first_scanned_at: string | null;
  created_at: string;
  revealed_at: string | null;
  cancelled_at: string | null;
  bill_subtotal_cents: number | null;
  total_cents: number | null;
  discount_cents: number | null;
  discount_percent: number | null;
  bill_source: string | null;
};

// Mirrors _shared/rewards-config isActionVerified — an action counts once the
// guest attested it (self_verified since MESITA-849) or it was ever approved.
function isAttested(status: string | null): boolean {
  return status === "self_verified" ||
    status === "ai_verified" ||
    status === "staff_verified" ||
    status === "waiter_verified";
}

/** Drain every closed ticket for this place (narrow columns only). */
async function fetchAllClosedTickets(
  admin: SupabaseClient,
  projectId: string,
): Promise<{ ok: true; rows: ClosedTicketRow[] } | { ok: false; error: string }> {
  const rows: ClosedTicketRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("visit_tickets")
      .select(
        "id, consumer_id, story_status, review_status, " +
          "bill_subtotal_cents, total_cents, discount_cents, discount_percent, " +
          "bill_source, currency, created_at, revealed_at, first_scanned_at",
      )
      .eq("project_id", projectId)
      .eq("status", CLOSED_STATUS)
      .order("created_at", { ascending: false })
      .range(from, from + CLOSED_PAGE - 1);
    if (error) return { ok: false, error: error.message };
    const page = (data ?? []) as unknown as ClosedTicketRow[];
    rows.push(...page);
    if (page.length < CLOSED_PAGE) break;
    from += CLOSED_PAGE;
  }
  return { ok: true, rows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  const feedLimit = clampIntRange(
    Number(bodyRes.body.feedLimit ?? DEFAULT_FEED_LIMIT),
    1,
    MAX_FEED_LIMIT,
  );
  const reviewLimit = clampIntRange(
    Number(bodyRes.body.reviewLimit ?? DEFAULT_REVIEW_LIMIT),
    1,
    MAX_REVIEW_LIMIT,
  );

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  // Exact counts + capped lists in parallel. Closed-ticket money/guest math
  // is a second wave so we don't hold the count queries behind pagination.
  const [
    savedCountRes,
    ticketsCountRes,
    visitsCountRes,
    honoredCountRes,
    cancelledCountRes,
    storiesCountRes,
    googleReviewsCountRes,
    mesitaReviewsCountRes,
    reviewsRes,
    savesFeedRes,
    ticketsFeedRes,
    resvRes,
  ] = await Promise.all([
    admin
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("first_scanned_at", "is", null),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", CLOSED_STATUS),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", TICKET_STATUS.cancelled),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("story_status", [...ATTESTED_STATUSES]),
    admin
      .from("visit_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("review_status", [...ATTESTED_STATUSES]),
    admin
      .from("ticket_reviews")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    admin
      .from("ticket_reviews")
      .select(
        "id, food, service, ambience, value, overall, comments, created_at, " +
          "consumer:consumers(first_name)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(reviewLimit),
    admin
      .from("favorites")
      .select("id, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_FEED_LIMIT),
    admin
      .from("visit_tickets")
      .select(
        "id, status, first_scanned_at, created_at, revealed_at, cancelled_at, " +
          "bill_subtotal_cents, total_cents, discount_cents, discount_percent, bill_source",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(FEED_TICKET_PAGE),
    admin
      .from("reservation_tickets")
      .select("id, status, party_size, reserved_at, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_FEED_LIMIT),
  ]);

  for (const [label, r] of [
    ["saved_count", savedCountRes],
    ["tickets_count", ticketsCountRes],
    ["visits_count", visitsCountRes],
    ["honored_count", honoredCountRes],
    ["cancelled_count", cancelledCountRes],
    ["stories_count", storiesCountRes],
    ["google_reviews_count", googleReviewsCountRes],
    ["mesita_reviews_count", mesitaReviewsCountRes],
    ["ticket_reviews", reviewsRes],
    ["saved_places", savesFeedRes],
    ["tickets_feed", ticketsFeedRes],
    ["reservations", resvRes],
  ] as const) {
    if (r.error) return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
  }

  const closedRes = await fetchAllClosedTickets(admin, projectId);
  if (!closedRes.ok) {
    return json({ ok: false, error: `closed_tickets: ${closedRes.error}` }, 500);
  }
  const closed = closedRes.rows;

  // Influenced spend = what guests actually spent on visits this program
  // closed. Only tickets with an amount on record contribute; v3b made the
  // bill optional, so `billedCount` is what the averages are honestly over.
  let influencedCents = 0;
  let discountCents = 0;
  let billedCount = 0;
  let consumerBilledCount = 0;
  for (const t of closed) {
    const amount = t.total_cents ?? t.bill_subtotal_cents ?? 0;
    if (amount > 0) {
      influencedCents += amount;
      billedCount += 1;
      if (t.bill_source === "consumer") consumerBilledCount += 1;
    }
    discountCents += t.discount_cents ?? 0;
  }

  // Repeat guests: distinct consumers with more than one CLOSED visit.
  const visitsByConsumer = new Map<string, number>();
  for (const t of closed) {
    visitsByConsumer.set(
      t.consumer_id,
      (visitsByConsumer.get(t.consumer_id) ?? 0) + 1,
    );
  }
  let repeatGuests = 0;
  for (const n of visitsByConsumer.values()) if (n > 1) repeatGuests += 1;

  const summary = {
    // The funnel, starting where real data starts (see the header note).
    saved: savedCountRes.count ?? 0,
    ticketsOpened: ticketsCountRes.count ?? 0,
    visits: visitsCountRes.count ?? 0,
    honored: honoredCountRes.count ?? 0,
    cancelled: cancelledCountRes.count ?? 0,
    guests: visitsByConsumer.size,
    repeatGuests,
    influencedCents,
    discountCents,
    billedCount,
    // How many of those amounts the GUEST typed rather than the place
    // (v3b provenance) — an average built on these is softer, and the tab
    // says so rather than presenting it as confirmed.
    consumerReportedCount: consumerBilledCount,
    avgTicketCents: billedCount > 0 ? Math.round(influencedCents / billedCount) : null,
    // "Redemption by segment", reported by ACTION — never by class.
    byAction: {
      welcome: closed.filter((t) => (visitsByConsumer.get(t.consumer_id) ?? 0) === 1)
        .length,
      story: closed.filter((t) => isAttested(t.story_status)).length,
      review: closed.filter((t) => isAttested(t.review_status)).length,
    },
    currency: closed.find((t) => t.currency)?.currency ?? "MXN",
  };

  // The embed makes PostgREST's inferred row type unusable — cast once.
  const reviewRows = (reviewsRes.data ?? []) as unknown as Array<{
    id: string;
    food: number | null;
    service: number | null;
    ambience: number | null;
    value: number | null;
    overall: number | null;
    comments: string | null;
    created_at: string;
    consumer: { first_name: string | null } | null;
  }>;

  const content = {
    mesitaReviews: reviewRows.map((r) => ({
      id: r.id,
      food: r.food,
      service: r.service,
      ambience: r.ambience,
      value: r.value,
      overall: r.overall,
      comments: r.comments,
      createdAt: r.created_at,
      // First name only: enough to read as a person, never an identity.
      guestFirstName: r.consumer?.first_name ?? null,
    })),
    // Exact totals — the listed reviews stay capped for the UI.
    mesitaReviewCount: mesitaReviewsCountRes.count ?? 0,
    // Attested counts. No artefact exists to link — these actions are
    // self-declared and no URL is captured (MESITA-849).
    storiesPosted: storiesCountRes.count ?? 0,
    googleReviews: googleReviewsCountRes.count ?? 0,
  };

  // The feed — the same event vocabulary as the admin monitor, scoped to this
  // place and stripped of anything class-shaped. Guest complaints
  // (ticket_reports, v3c) are deliberately NOT here: a report goes to Mesita
  // first, and showing the accused the accusation invites retaliation.
  type FeedItem = {
    id: string;
    type: string;
    occurredAt: string;
    meta: Record<string, unknown>;
  };
  const feed: FeedItem[] = [];

  for (const t of (ticketsFeedRes.data ?? []) as unknown as FeedTicketRow[]) {
    feed.push({
      id: `ticket_created:${t.id}`,
      type: "rewards.ticket_created",
      occurredAt: t.created_at,
      meta: {},
    });
    if (t.first_scanned_at) {
      feed.push({
        id: `ticket_visit:${t.id}`,
        type: "rewards.ticket_visit",
        occurredAt: t.first_scanned_at,
        meta: {},
      });
    }
    if (t.revealed_at) {
      feed.push({
        id: `ticket_closed:${t.id}`,
        type: "rewards.ticket_closed",
        occurredAt: t.revealed_at,
        meta: {
          discountPercent: t.discount_percent,
          discountCents: t.discount_cents,
          amountCents: t.total_cents ?? t.bill_subtotal_cents,
          billSource: t.bill_source,
        },
      });
    }
  }
  for (const s of (savesFeedRes.data ?? []) as Array<{ id: string; created_at: string }>) {
    feed.push({
      id: `saved:${s.id}`,
      type: "consumer.place_saved",
      occurredAt: s.created_at,
      meta: {},
    });
  }
  for (const r of reviewRows) {
    feed.push({
      id: `review:${r.id}`,
      type: "rewards.review_submitted",
      occurredAt: r.created_at,
      meta: { overall: r.overall },
    });
  }
  for (
    const r of (resvRes.data ?? []) as Array<{
      id: string;
      status: string;
      party_size: number | null;
      reserved_at: string | null;
      created_at: string;
    }>
  ) {
    feed.push({
      id: `reservation:${r.id}`,
      type: "reservations.reservation_created",
      occurredAt: r.created_at,
      meta: {
        status: r.status,
        partySize: r.party_size,
        reservedAt: r.reserved_at,
      },
    });
  }

  feed.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  return json({
    ok: true,
    summary,
    content,
    feed: feed.slice(0, feedLimit),
  });
});
