// Supabase Edge Function — admin-web-get-place-activity (admin caller)
//
// Everything the admin Performance tab shows BELOW the summary, for one
// place, in one round trip:
//
//   reservations — the bookings themselves PLUS the Reservationist call
//     lifecycle (attempts, state, last call status, the agent's reported
//     verdict, the alternatives a venue offered, when the next retry fires).
//     business-web-list-reservations deliberately omits all of that — the
//     business console shows a booking, the admin console debugs an agent.
//   lines        — the two Mesita phone numbers a human calls to change a
//     booking. READ-ONLY BY DESIGN (Pato 2026-08-03): "reservations tickets
//     cannot be directly edited. just must call the ai … just give the phone
//     numbers to reschedule". So this EF exposes no reservation writes and
//     the tab renders no edit affordance; rescheduling happens on the phone
//     with a3 (guests) / a4 (venues), which is the only path that keeps the
//     agent's own state consistent.
//   stories      — guest story/review screenshots submitted against this
//     place's tickets, with their verification state.
//   comments     — post-visit review text + per-axis ratings.
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
  id: string;
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

const GUEST_EMBED = "consumer:consumers(id, full_name, first_name, instagram_handle)";

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
  const limit = clampIntRange(Number(bodyRes.body.limit ?? 50), 1, 200);

  const [resvRes, storyRes, reviewRes] = await Promise.all([
    admin
      .from("reservations")
      .select(
        "id, reference_code, reserved_at, party_size, status, notes, created_at, " +
          "confirmed_at, cancelled_at, completed_at, cancelled_by, " +
          "call_attempts, attempts_planned, attempts_state, next_attempt_at, " +
          "last_call_status, last_called_at, reported_verdict, alternatives, " +
          "outcome_note, negotiation_rounds, callback_state, guest_confirmed_at, " +
          `is_test, consumer_number, business_number, ${GUEST_EMBED}`,
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit),
    // A story/review only exists once the guest submitted a screenshot.
    admin
      .from("tickets")
      .select(
        "id, created_at, status, story_status, story_screenshot_url, " +
          "story_submitted_at, story_verified_at, story_reject_reason, " +
          "review_status, review_screenshot_url, review_submitted_at, " +
          `review_verified_at, ${GUEST_EMBED}`,
      )
      .eq("project_id", projectId)
      .or("story_screenshot_url.not.is.null,review_screenshot_url.not.is.null")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("ticket_reviews")
      .select(
        `id, created_at, food, service, ambiance, overall, value, comments, ${GUEST_EMBED}`,
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  for (const [label, r] of [
    ["reservations", resvRes],
    ["stories", storyRes],
    ["comments", reviewRes],
  ] as const) {
    if (r.error) return json({ ok: false, error: `${label}: ${r.error.message}` }, 500);
  }

  type ResvRow = Record<string, unknown> & {
    id: string;
    consumer: GuestShape | GuestShape[] | null;
  };
  const reservations = ((resvRes.data ?? []) as unknown as ResvRow[]).map((r) => ({
    id: r.id,
    referenceCode: r.reference_code ?? null,
    reservedAt: r.reserved_at ?? null,
    partySize: r.party_size ?? null,
    status: r.status ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at ?? null,
    confirmedAt: r.confirmed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    cancelledBy: r.cancelled_by ?? null,
    guest: guestName(one(r.consumer)),
    // The call lifecycle — why a booking is in the state it's in.
    call: {
      attempts: r.call_attempts ?? 0,
      attemptsPlanned: r.attempts_planned ?? null,
      state: r.attempts_state ?? null,
      nextAttemptAt: r.next_attempt_at ?? null,
      lastStatus: r.last_call_status ?? null,
      lastCalledAt: r.last_called_at ?? null,
      verdict: r.reported_verdict ?? null,
      alternatives: r.alternatives ?? null,
      outcomeNote: r.outcome_note ?? null,
      negotiationRounds: r.negotiation_rounds ?? 0,
      callbackState: r.callback_state ?? null,
      guestConfirmedAt: r.guest_confirmed_at ?? null,
    },
    isTest: r.is_test === true,
    // Which numbers this specific booking used, when pre-resolved.
    guestNumber: r.consumer_number ?? null,
    venueNumber: r.business_number ?? null,
  }));

  type TicketRow = Record<string, unknown> & {
    id: string;
    consumer: GuestShape | GuestShape[] | null;
  };
  const stories = ((storyRes.data ?? []) as unknown as TicketRow[]).map((t) => ({
    ticketId: t.id,
    createdAt: t.created_at ?? null,
    guest: guestName(one(t.consumer)),
    story: {
      status: t.story_status ?? null,
      screenshotUrl: t.story_screenshot_url ?? null,
      submittedAt: t.story_submitted_at ?? null,
      verifiedAt: t.story_verified_at ?? null,
      rejectReason: t.story_reject_reason ?? null,
    },
    review: {
      status: t.review_status ?? null,
      screenshotUrl: t.review_screenshot_url ?? null,
      submittedAt: t.review_submitted_at ?? null,
      verifiedAt: t.review_verified_at ?? null,
    },
  }));

  type ReviewRow = Record<string, unknown> & {
    id: string;
    consumer: GuestShape | GuestShape[] | null;
  };
  const comments = ((reviewRes.data ?? []) as unknown as ReviewRow[]).map((v) => ({
    id: v.id,
    createdAt: v.created_at ?? null,
    guest: guestName(one(v.consumer)),
    food: v.food ?? null,
    service: v.service ?? null,
    ambiance: v.ambiance ?? null,
    value: v.value ?? null,
    overall: v.overall ?? null,
    comments: typeof v.comments === "string" ? v.comments : null,
  }));

  return json({
    ok: true,
    reservations,
    stories,
    comments,
    // The ONLY way to change a booking. Surfaced so the operator can read
    // them off the screen and dial — no write endpoint exists here.
    lines: {
      guest: consumerFromNumber(),
      venue: reservationFromNumber(),
    },
    generatedAt: new Date().toISOString(),
  });
});
