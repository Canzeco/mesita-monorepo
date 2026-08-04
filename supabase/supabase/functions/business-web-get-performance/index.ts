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
// Body:     { placeId: string, feedLimit?: number, reviewLimit?: number }
// Response: { ok: true, summary, content, feed }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  clampIntRange,
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";

const DEFAULT_FEED_LIMIT = 40;
const MAX_FEED_LIMIT = 100;
const DEFAULT_REVIEW_LIMIT = 20;
const MAX_REVIEW_LIMIT = 50;

// A ticket counts as HONORED once it closed — v3b made the close the single
// unconditional signal (MESITA-850), so this matches what activation records.
const CLOSED_STATUS = "revealed";

type Body = {
  placeId?: string;
  projectId?: string;
  feedLimit?: number;
  reviewLimit?: number;
};

type TicketRow = {
  id: string;
  consumer_id: string;
  status: string;
  story_status: string | null;
  review_status: string | null;
  first_scanned_at: string | null;
  check_subtotal_cents: number | null;
  total_cents: number | null;
  discount_cents: number | null;
  discount_percent: number | null;
  bill_source: string | null;
  currency: string | null;
  created_at: string;
  revealed_at: string | null;
  cancelled_at: string | null;
};

// Mirrors _shared/rewards-config isActionVerified — an action counts once the
// guest attested it (self_verified since MESITA-849) or it was ever approved.
function isAttested(status: string | null): boolean {
  return status === "self_verified" ||
    status === "ai_verified" ||
    status === "staff_verified" ||
    status === "waiter_verified";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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

  // Every source is filtered on project_id — constraint 1, enforced per query
  // rather than trusted to a shared helper.
  const [ticketsRes, reviewsRes, savesRes, resvRes] = await Promise.all([
    admin
      .from("tickets")
      .select(
        "id, consumer_id, status, story_status, review_status, first_scanned_at, " +
          "check_subtotal_cents, total_cents, discount_cents, discount_percent, " +
          "bill_source, currency, created_at, revealed_at, cancelled_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    admin
      .from("ticket_reviews")
      .select(
        "id, food, service, ambiance, value, overall, comments, created_at, " +
          "consumer:consumers(first_name)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(reviewLimit),
    admin
      .from("saved_places")
      .select("id, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_FEED_LIMIT),
    admin
      .from("reservations")
      .select("id, status, party_size, reserved_at, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_FEED_LIMIT),
  ]);

  for (const [label, r] of [
    ["tickets", ticketsRes],
    ["ticket_reviews", reviewsRes],
    ["saved_places", savesRes],
    ["reservations", resvRes],
  ] as const) {
    if (r.error) return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
  }

  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];
  const closed = tickets.filter((t) => t.status === CLOSED_STATUS);

  // Influenced spend = what guests actually spent on visits this program
  // closed. Only tickets with an amount on record contribute; v3b made the
  // bill optional, so `billedCount` is what the averages are honestly over.
  let influencedCents = 0;
  let discountCents = 0;
  let billedCount = 0;
  let consumerBilledCount = 0;
  for (const t of closed) {
    const amount = t.total_cents ?? t.check_subtotal_cents ?? 0;
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
    saved: (savesRes.data ?? []).length,
    ticketsOpened: tickets.length,
    visits: tickets.filter((t) => t.first_scanned_at != null).length,
    honored: closed.length,
    cancelled: tickets.filter((t) => t.status === "cancelled").length,
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
      welcome: closed.filter((t) => (visitsByConsumer.get(t.consumer_id) ?? 0) === 1).length,
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
    ambiance: number | null;
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
      ambiance: r.ambiance,
      value: r.value,
      overall: r.overall,
      comments: r.comments,
      createdAt: r.created_at,
      // First name only: enough to read as a person, never an identity.
      guestFirstName: r.consumer?.first_name ?? null,
    })),
    // Attested counts. No artefact exists to link — these actions are
    // self-declared and no URL is captured (MESITA-849).
    storiesPosted: tickets.filter((t) => isAttested(t.story_status)).length,
    googleReviews: tickets.filter((t) => isAttested(t.review_status)).length,
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

  for (const t of tickets) {
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
          amountCents: t.total_cents ?? t.check_subtotal_cents,
          billSource: t.bill_source,
        },
      });
    }
  }
  for (const s of (savesRes.data ?? []) as Array<{ id: string; created_at: string }>) {
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
