// Supabase Edge Function — admin-web-get-place-activity (admin caller)
//
// Everything the admin Performance tab needs for ONE place, in one round
// trip. The tab answers a single question — "is Mesita working here?" — so
// this endpoint returns the numbers that answer it plus the short lists that
// support it. Nothing else.
//
//   stats        — REAL aggregates over the whole place, not a sample. Counts
//     run server-side (head + exact count); the money sums drain every closed
//     ticket's amount columns past PostgREST's default page (MESITA-890).
//     Amount = total_cents ?? check_subtotal_cents — same formula as
//     business-web-get-performance, so admin and business never disagree on
//     "influenced spend" for the same place.
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
import { clampIntRange, corsPreflight, json, methodNotAllowed, readJson, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { consumerFromNumber, reservationFromNumber } from "../_shared/elevenlabs.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type Body = { placeId?: string; projectId?: string; limit?: number };

// A ticket counts as CLOSED once staff marked the visit done (v3b /
// MESITA-850). Matches business-web-get-performance. paid_at is still stamped
// by informal close, but vocabulary and predicates follow status=revealed.
const CLOSED_STATUS = "revealed";
const CLOSED_PAGE = 1000;

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

type MoneyRow = {
  check_subtotal_cents: number | null;
  total_cents: number | null;
  discount_cents: number | null;
  bill_source: string | null;
};

/** Drain every closed ticket's money columns for this place. */
async function fetchAllClosedMoney(
  admin: SupabaseClient,
  projectId: string,
): Promise<{ ok: true; rows: MoneyRow[] } | { ok: false; error: string }> {
  const rows: MoneyRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("tickets")
      .select("check_subtotal_cents, total_cents, discount_cents, bill_source")
      .eq("project_id", projectId)
      .eq("status", CLOSED_STATUS)
      .order("created_at", { ascending: false })
      .range(from, from + CLOSED_PAGE - 1);
    if (error) return { ok: false, error: error.message };
    const page = (data ?? []) as unknown as MoneyRow[];
    rows.push(...page);
    if (page.length < CLOSED_PAGE) break;
    from += CLOSED_PAGE;
  }
  return { ok: true, rows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

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
  // A close = status revealed (v3b — "marks as done", not a payment).
  const [
    savesRes,
    ticketsRes,
    visitsRes,
    closedRes,
    resvCountRes,
    moneyDrain,
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
      .eq("status", CLOSED_STATUS),
    admin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    fetchAllClosedMoney(admin, projectId),
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
    ["closed", closedRes],
    ["reservation_count", resvCountRes],
    ["reservations", resvListRes],
  ] as const) {
    if (r.error) return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
  }
  if (!moneyDrain.ok) {
    return json({ ok: false, error: `money: ${moneyDrain.error}` }, 500);
  }

  let influencedCents = 0;
  let discountCents = 0;
  let billedCount = 0;
  let consumerReportedCount = 0;
  for (const row of moneyDrain.rows) {
    // Same amount resolution as business-web-get-performance — v3b made the
    // bill optional and total_cents the preferred recorded amount.
    const amount = row.total_cents ?? row.check_subtotal_cents ?? 0;
    if (amount > 0) {
      influencedCents += amount;
      billedCount += 1;
      if (row.bill_source === "consumer") consumerReportedCount += 1;
    }
    discountCents += row.discount_cents ?? 0;
  }

  const saves = savesRes.count ?? 0;
  const visits = visitsRes.count ?? 0;
  const closed = closedRes.count ?? 0;

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
      closed,
      // Compat alias — older admin clients read `paid`. Same integer.
      paid: closed,
      reservations: resvCountRes.count ?? 0,
      influencedCents,
      discountCents,
      billedCount,
      // Of billedCount, how many amounts the GUEST typed (v3b provenance).
      consumerReportedCount,
      // Averaged over tickets that actually carry an amount, so one
      // un-billed close can't drag the average down.
      avgTicketCents: billedCount > 0
        ? Math.round(influencedCents / billedCount)
        : null,
      // The two conversions the funnel annotates.
      visitRate: saves > 0 ? Math.round((visits / saves) * 100) : null,
      closeRate: visits > 0 ? Math.round((closed / visits) * 100) : null,
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
