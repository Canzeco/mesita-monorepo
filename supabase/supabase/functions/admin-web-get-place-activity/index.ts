// Supabase Edge Function — admin-web-get-place-activity (admin caller)
//
// Everything the admin Performance tab needs for ONE place, in one round
// trip. The tab answers a single question — "is Mesita working here?" — so
// this endpoint returns the numbers that answer it plus the short lists that
// support it. Nothing else.
//
//   stats        — REAL aggregates over the whole place, not a sample. Counts
//     run server-side (head + exact count); the two money sums read only the
//     two integer columns of this place's paid tickets.
//
//     This replaced deriving the headline numbers from a page of the
//     notification feed. That feed is capped (default 150 events), so
//     "influenced spend" silently meant "…of the last 150 events" — a
//     plausible number that was wrong, on the one card whose entire job is to
//     be trusted. Aggregates can't drift from the truth that way.
//
//   reservations — the compact booking list: when, who, party, status. The
//     call-lifecycle columns (attempts, verdicts, alternatives, retries) are
//     deliberately NOT returned any more; they were agent-debugging detail on
//     a page meant to be read at a glance.
//
//   lines        — the two Mesita numbers a human calls to change a booking.
//     READ-ONLY BY DESIGN (Pato): "reservations tickets cannot be directly
//     edited. just must call the ai … just give the phone numbers to
//     reschedule". No reservation write exists here, and the tab renders no
//     edit affordance — rescheduling happens on the phone with a3 (guests) /
//     a4 (venues), the only path that keeps the agent's own state consistent.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-get-place-activity

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
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { consumerFromNumber, reservationFromNumber } from "../_shared/elevenlabs.ts";

type Body = { placeId?: string; projectId?: string; limit?: number };

// supabase-js types a to-one embed as T | T[]; normalise.
function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

type GuestShape = {
  full_name: string | null;
  first_name: string | null;
  instagram_handle: string | null;
};

function guestName(c: GuestShape | null): string {
  if (!c) return "Guest";
  const full = c.full_name?.trim();
  if (full) return full;
  const first = c.first_name?.trim();
  if (first) return first;
  const ig = c.instagram_handle?.trim();
  if (ig) return `@${ig.replace(/^@/, "")}`;
  return "Guest";
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

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);
  const limit = clampIntRange(Number(bodyRes.body.limit ?? 8), 1, 50);

  // A visit = the guest's QR met the venue (first_scanned_at stamped).
  // A paid check = the ticket was closed and honored (paid_at stamped) —
  // paid_at rather than status so a later status change can't rewrite history.
  const [
    savesRes,
    ticketsRes,
    visitsRes,
    paidRes,
    resvCountRes,
    moneyRes,
    resvListRes,
  ] = await Promise.all([
    admin
      .from("saved_places")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("first_scanned_at", "is", null),
    admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("paid_at", "is", null),
    admin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    // Only two integer columns, only this place's paid tickets — small even
    // for a busy venue, and exact (no sampling).
    admin
      .from("tickets")
      .select("check_subtotal_cents, discount_cents")
      .eq("project_id", projectId)
      .not("paid_at", "is", null),
    admin
      .from("reservations")
      .select(
        "id, reserved_at, party_size, status, is_test, " +
          "consumer:consumers(full_name, first_name, instagram_handle)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  for (const [label, r] of [
    ["saves", savesRes],
    ["tickets", ticketsRes],
    ["visits", visitsRes],
    ["paid", paidRes],
    ["reservation_count", resvCountRes],
    ["money", moneyRes],
    ["reservations", resvListRes],
  ] as const) {
    if (r.error) return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
  }

  let influencedCents = 0;
  let discountCents = 0;
  let withAmount = 0;
  for (
    const row of (moneyRes.data ?? []) as Array<{
      check_subtotal_cents: number | null;
      discount_cents: number | null;
    }>
  ) {
    const sub = row.check_subtotal_cents ?? 0;
    if (sub > 0) {
      influencedCents += sub;
      withAmount += 1;
    }
    discountCents += row.discount_cents ?? 0;
  }

  const saves = savesRes.count ?? 0;
  const visits = visitsRes.count ?? 0;
  const paid = paidRes.count ?? 0;

  type ResvRow = {
    id: string;
    reserved_at: string | null;
    party_size: number | null;
    status: string | null;
    is_test: boolean | null;
    consumer: GuestShape | GuestShape[] | null;
  };
  const reservations = ((resvListRes.data ?? []) as unknown as ResvRow[]).map((r) => ({
    id: r.id,
    reservedAt: r.reserved_at,
    partySize: r.party_size,
    status: r.status,
    isTest: r.is_test === true,
    guest: guestName(one(r.consumer)),
  }));

  return json({
    ok: true,
    stats: {
      saves,
      tickets: ticketsRes.count ?? 0,
      visits,
      paid,
      reservations: resvCountRes.count ?? 0,
      influencedCents,
      discountCents,
      // Averaged over the tickets that actually carry a subtotal, so one
      // un-billed close can't drag the average down.
      avgTicketCents: withAmount > 0 ? Math.round(influencedCents / withAmount) : null,
      // The two conversions the funnel annotates.
      visitRate: saves > 0 ? Math.round((visits / saves) * 100) : null,
      closeRate: visits > 0 ? Math.round((paid / visits) * 100) : null,
    },
    reservations,
    reservationTotal: resvCountRes.count ?? 0,
    lines: {
      guest: consumerFromNumber(),
      venue: reservationFromNumber(),
    },
    generatedAt: new Date().toISOString(),
  });
});
