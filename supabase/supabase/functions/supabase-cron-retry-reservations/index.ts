// Supabase Edge Function — supabase-cron-retry-reservations (internal)
//
// THE waker for every parked reservation leg (Docs › Reservations §B). The
// call engine can't sleep (the edge runtime dies at ~400s), so anything that
// must happen later is PARKED on the row and this poller — pg_cron, every
// minute — hands the due ones back to the engine.
//
// SWEEP ORDER IS LOAD-BEARING (eng-review 2026-08-04): dead work is buried
// BEFORE live work is woken, so a recovery after a cron outage can never dial
// a place about a slot that already passed.
//
//   0 · offers     a counter-offer nobody picked by its deadline (30 min
//                  before the latest offered slot, capped by the expiry) →
//                  the place is RELEASED (a place notice, swept in step 4
//                  this same run) and the ticket ends 'unresolved' with one
//                  guest notification (_shared/reservation-negotiation.ts,
//                  MESITA-3630). Before expiry, so an offer is never buried
//                  without telling the place.
//   1 · expiry     pending 4 h past reserved_at → 'unresolved' (no call),
//                  and the guest is told (Me › Notifications, MESITA-3619).
//                  `passed` stays DERIVED in the app; confirmed rows are
//                  never touched.
//   2 · moot       owed notices whose slot is 4 h gone → 'skipped' — a
//                  release call about last night's table helps nobody.
//   3 · reaper     claims stuck > 10 min whose call was NEVER PLACED are
//                  ZOMBIES (isolate died while dialing — deploy, wall kill):
//                  back to 'scheduled', due now, attempts and reported_verdict
//                  intact; the engine re-claims and resumes.
//   3b · owed      claims stuck > 10 min whose call WAS placed (a
//                  conversation id is on the ticket) are never redialed:
//                  the conversation is read ONCE per sweep and applied
//                  through the same door as eleven-webhook-post-call
//                  (_shared/reservation-call-outcome.ts). Still live after
//                  30 min → given up (a1: its reported verdict, else
//                  unresolved). Works with no webhook secret set; the webhook
//                  only makes it faster (MESITA-3618).
//   4 · wakes      due bookings (reserved_at-bounded) → intent book · due
//                  callbacks → callback_retry · owed notices → cancel_notice
//                  · due reminders (config-gated) → reminder
//                  ('pending' rides regardless of clock — that state means a
//                  cancel EF's fire-and-forget invoke was lost).
//
// Safe to run hot: the engine claims each errand compare-and-swap style
// (rotating run_id), so an overlapping poll loses the swap and skips.
//
// Body: { limit?: number } — per-sweep batch cap (default 25).
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).
//
// Deploy: supabase functions deploy supabase-cron-retry-reservations

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, readLimit, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import { loadReservationsConfig } from "../_shared/reservations-config.ts";
import { type ReservationPatch, validateReservationPatch, writeReservation } from "../_shared/reservation-doc.ts";
import { deadEndPatch, deadEndOutcome } from "../_shared/reservation-dead-end.ts";
import {
  OPEN_OFFER_MATCH,
  type OfferTicket,
  releaseUnansweredOffer,
} from "../_shared/reservation-negotiation.ts";
import { placeZone } from "../_shared/local-time.ts";

import { fetchConversation, resolveElevenLabsKey } from "../_shared/elevenlabs.ts";
import {
  applyCallResult,
  AWAITING,
  type CallResult,
  GIVE_UP,
  type OutcomeTicket,
  OUTCOME_TICKET_COLUMNS,
  owedCallStep,
  readConversation,
  REAP_UNPLACED,
  STALE_CLAIM_MS,
  supabaseOutcomeStore,
} from "../_shared/reservation-call-outcome.ts";

/** Throws if the patch fails validateReservationPatch — every bulk sweep
 * below hardcodes its own patch, so a validation failure here means the
 * literal patch itself is wrong, not bad caller input; fail loud. */
function validated(patch: Record<string, unknown>): Record<string, unknown> {
  const res = validateReservationPatch(patch);
  if (!res.ok) throw new Error(`reservation-retries: invalid patch — ${res.error}`);
  return res.patch;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXPIRE_AFTER_MS = 4 * 3600_000; // mirrors the app's passed-grace window

serveJson("supabase-cron-retry-reservations", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;

  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = readLimit(body.limit, DEFAULT_LIMIT, MAX_LIMIT);

  const nowIso = new Date().toISOString();
  const expiryFloor = new Date(Date.now() - EXPIRE_AFTER_MS).toISOString();
  const staleClaim = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const failed: Array<{ id: string; intent: string; error: string }> = [];

  const store = supabaseOutcomeStore(admin, env, "supabase-cron-retry-reservations");

  // ── 0 · Offers nobody took: release the place, end the ticket ─────────────
  // Few rows (open counter-offers only); each deadline needs the place's zone.
  const { data: offerRows } = await admin
    .from("reservation_tickets")
    .select("id, consumer_id, reference_code, reserved_at, place_id, state, attempts_state, reported_verdict, alternatives")
    .match(OPEN_OFFER_MATCH)
    .order("reserved_at", { ascending: true })
    .limit(limit);
  let offersReleased = 0;
  for (const row of (offerRows ?? []) as Array<OfferTicket & OutcomeTicket>) {
    try {
      const place = row.place_id ? await store.place(row.place_id) : null;
      const released = await releaseUnansweredOffer(
        {
          write: async (patch) => {
            const res = await writeReservation(admin, {
              mode: "update",
              id: row.id,
              patch: patch as ReservationPatch,
              match: { ...OPEN_OFFER_MATCH },
              select: "id",
            });
            return res.ok && !!res.row;
          },
          notify: (outcome) => store.notify(row, place, outcome),
        },
        row,
        placeZone(place),
      );
      if (released) offersReleased++;
    } catch (e) {
      failed.push({ id: row.id, intent: "offer_release", error: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── 1 · Expiry: bury stuck pending tickets FIRST ───────────────────────────
  const { data: expRows } = await admin
    .from("reservation_tickets")
    .update(validated(deadEndPatch(
      "expired",
      "expired: the reserved time passed while still unconfirmed",
    )))
    .eq("state", "pending")
    .lt("reserved_at", expiryFloor)
    .or("attempts_state.is.null,attempts_state.neq.running")
    .select("id, consumer_id, reference_code, place_id");
  // A dead end tells the guest (_shared/reservation-dead-end.ts).
  const expired = (expRows ?? []) as Array<
    { id: string; consumer_id: string; reference_code: string | null; place_id: string | null }
  >;
  for (const t of expired) {
    // A failed place read only costs the row its name and photo.
    const place = t.place_id ? await store.place(t.place_id).catch(() => null) : null;
    await store.notify(t as unknown as OutcomeTicket, place, deadEndOutcome("expired"));
  }

  // ── 2 · Moot notices: nobody needs a release call about a passed slot ──────
  const { data: mootRows } = await admin
    .from("reservation_tickets")
    .update(validated({
      notice_state: "skipped",
      notice_next_at: null,
      last_call_state: "cancel notice skipped — the slot already passed",
    }))
    .in("notice_state", ["pending", "scheduled"])
    .lt("reserved_at", expiryFloor)
    .select("id");

  const { data: mootReminderRows } = await admin
    .from("reservation_tickets")
    .update(validated({
      reminder_state: "skipped",
      reminder_at: null,
      last_call_state: "reminder skipped — the slot already passed",
    }))
    .in("reminder_state", ["scheduled", "idle"])
    .lt("reserved_at", expiryFloor)
    .select("id");

  // ── 3 · Reaper: zombie claims self-heal here ───────────────────────────────
  const reaped: Record<string, number> = {};
  for (const rule of REAP_UNPLACED) {
    const due = rule.leg === "book"
      ? { next_attempt_at: nowIso }
      : rule.leg === "callback"
      ? { callback_next_attempt_at: nowIso }
      : rule.leg === "notice"
      ? { notice_next_at: nowIso }
      : { reminder_at: nowIso };
    let q = admin
      .from("reservation_tickets")
      .update(validated({
        ...rule.patch,
        ...due,
        last_call_state: "run reaped — its worker died before the call was placed; resuming",
      }))
      .in(rule.field, rule.states)
      .not("claimed_at", "is", null)
      .lt("claimed_at", staleClaim);
    if (rule.convNull) q = q.is(rule.convNull, null);
    const { data } = await q.select("id");
    reaped[rule.leg] = (data ?? []).length;
  }

  // ── 3b · Owed outcomes: a placed call is read once, never redialed ───────
  const owed = { due: 0, applied: 0, waiting: 0 };
  const elevenKey = await resolveElevenLabsKey();
  for (const leg of Object.keys(AWAITING) as Array<keyof typeof AWAITING>) {
    const a = AWAITING[leg];
    const { data: rows } = await admin
      .from("reservation_tickets")
      .select(OUTCOME_TICKET_COLUMNS)
      .eq(a.field, a.state)
      .not(a.conv, "is", null)
      .not("claimed_at", "is", null)
      .lt("claimed_at", staleClaim)
      .order("claimed_at", { ascending: true })
      .limit(limit);
    for (const row of (rows ?? []) as unknown as OutcomeTicket[]) {
      owed.due++;
      const conv = String((row as unknown as Record<string, unknown>)[a.conv]);
      let result: CallResult | null = null;
      if (elevenKey?.startsWith("sk_")) {
        const got = await fetchConversation(elevenKey, conv);
        if (got.ok) result = readConversation(got.body);
        else console.error(`[reservation-retries] read ${conv} failed: ${got.error}`);
      }
      if (!result?.final) {
        if (owedCallStep(row.claimed_at, Date.now()) === "read") {
          owed.waiting++;
          continue;
        }
        result = GIVE_UP;
      }
      try {
        const applied = await applyCallResult(store, conv, result);
        if (applied.applied) owed.applied++;
      } catch (e) {
        failed.push({ id: row.id, intent: `outcome:${leg}`, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // ── 4 · Wakes ──────────────────────────────────────────────────────────────
  // Sequential on purpose: each engine call acks early (its legs run in the
  // background), so these loops are cheap, and a serial walk keeps a burst of
  // due tickets from opening a pile of simultaneous outbound calls.
  const wake = async (
    ids: string[],
    intent: "book" | "callback_retry" | "cancel_notice" | "reminder",
  ) => {
    let woken = 0;
    for (const id of ids) {
      const res = await invokeInternalCaller(
        env,
        "supabase-cron-retry-reservations",
        "supabase-edgefunc-place-reservation-call",
        intent === "book" ? { reservation_id: id } : { reservation_id: id, intent },
      );
      if (res.ok) woken++;
      else failed.push({ id, intent, error: res.error });
    }
    return woken;
  };

  const { data: bookRows, error: bookErr } = await admin
    .from("reservation_tickets")
    .select("id")
    .eq("state", "pending")
    .eq("attempts_state", "scheduled")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", nowIso)
    .gte("reserved_at", expiryFloor) // never dial about an already-buried slot
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (bookErr) return json({ ok: false, error: bookErr.message }, 500);
  const bookings = { due: (bookRows ?? []).length, woken: 0 };
  bookings.woken = await wake((bookRows ?? []).map((r) => r.id), "book");

  const { data: cbRows } = await admin
    .from("reservation_tickets")
    .select("id")
    .in("state", ["pending", "confirmed"])
    .eq("callback_state", "scheduled")
    .not("callback_next_attempt_at", "is", null)
    .lte("callback_next_attempt_at", nowIso)
    .gte("reserved_at", expiryFloor)
    .order("callback_next_attempt_at", { ascending: true })
    .limit(limit);
  const callbacks = { due: (cbRows ?? []).length, woken: 0 };
  callbacks.woken = await wake((cbRows ?? []).map((r) => r.id), "callback_retry");

  // Notices ride on their own columns, not on one state: 'cancelled' is the
  // normal owner, and a failed modification owes a release from 'unreachable'
  // / 'unresolved'. Live tickets are excluded by the engine's gate.
  const { data: ntRows } = await admin
    .from("reservation_tickets")
    .select("id")
    .in("notice_kind", ["place_cancel", "guest_cancel"])
    .or(`notice_state.eq.pending,and(notice_state.eq.scheduled,notice_next_at.lte.${nowIso})`)
    .limit(limit);
  const notices = { due: (ntRows ?? []).length, woken: 0 };
  notices.woken = await wake((ntRows ?? []).map((r) => r.id), "cancel_notice");

  const reminderOn = (await loadReservationsConfig(admin)).reminder.enabled;
  const reminders = { due: 0, woken: 0, skipped_knob: !reminderOn };
  if (reminderOn) {
    const { data: rmRows } = await admin
      .from("reservation_tickets")
      .select("id")
      .eq("state", "confirmed")
      .eq("reminder_state", "scheduled")
      .not("reminder_at", "is", null)
      .lte("reminder_at", nowIso)
      .gte("reserved_at", expiryFloor)
      .order("reminder_at", { ascending: true })
      .limit(limit);
    reminders.due = (rmRows ?? []).length;
    reminders.woken = await wake((rmRows ?? []).map((r) => r.id), "reminder");
  }

  return json({
    ok: true,
    offers_released: offersReleased,
    expired: (expRows ?? []).length,
    moot_notices: (mootRows ?? []).length,
    moot_reminders: (mootReminderRows ?? []).length,
    reaped,
    owed,
    bookings,
    callbacks,
    notices,
    reminders,
    failed,
  });
});
