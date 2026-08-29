// Supabase Edge Function — consumer-web-get-ticket
//
// THE TICKET v4 (MESITA-1091): the guest side's live sync. The ticket screen
// polls THIS — one owner-scoped row — while mounted (cadence from
// visits_config.consumerPollSeconds), instead of re-fetching the whole wallet
// through consumer-web-list-tickets every tick.
// This is also why Realtime stays off `tickets`: enabling postgres_changes
// would reverse two security migrations and the clients-never-call-the-DB
// law, so the live handshake is owner-scoped polling on both sides.
//
// Caller: consumer. Verb: get. Noun: ticket.
//
// Body:     { ticketId: string }
// Response: { ok: true, ticket, visits } | 404

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { fromPlaceIdRow } from "../_shared/place-id.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import {
  guestVisitsPolicy,
  loadVisitsConfig,
} from "../_shared/visits-config.ts";
import { isConnectChargeReady } from "../_shared/payment-account-doc.ts";

// The wallet's list columns plus the v4 journey state. updated_at rides along
// so the client can keep the freshest of (wallet row · this poll).
const TICKET_COLUMNS =
  "id, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, " +
  "review_status, review_screenshot_url, review_submitted_at, review_verified_at, review_reject_reason, " +
  "check_code, first_scanned_at, bill_subtotal_cents, tip_cents, tip_pct, total_cents, redeem_cents, " +
  "discount_percent, discount_cents, bill_source, revealed_at, " +
  "approved_at, approved_discount_cents, approved_amount_due_cents, fix_requested, fix_note, paid_method, validated_at, " +
  "currency, created_at, paid_at, cancelled_at, cancel_reason, " +
  "place_id, updated_at";

type Body = { ticketId?: string };

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
  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin
    .from("visit_tickets")
    .select(TICKET_COLUMNS)
    .eq("id", ticketId)
    .eq("consumer_id", authRes.user.id)
    .maybeSingle();
  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }
  // Cast at the query boundary: the EF clients carry no `Database` generic, so a
  // select() the type parameter can't resolve degrades the row to
  // `GenericStringError`, and narrowing `null` away first leaves attachPlaces
  // nothing to match its `project_id` constraint against (MESITA-1140).
  // fromPlaceIdRow copies the live `place_id` column onto the frozen HTTP
  // field `project_id` that attachPlaces and clients still speak.
  const row = fromPlaceIdRow(data as Record<string, unknown> | null) as
    | (Record<string, unknown> & { project_id: string | null })
    | null;
  if (!row) {
    // Uniform miss — never confirms someone else's ticket exists.
    return json({ ok: false, error: "Ticket not found" }, 404);
  }

  const [ticket] = await attachPlaces(admin, [row]);
  const visitsConfig = await loadVisitsConfig(admin);
  const visits = guestVisitsPolicy(visitsConfig);
  const settlement = {
    cardRail: await cardRailReady(admin, visitsConfig.payCard, row.project_id),
  };
  return json({ ok: true, ticket, visits, settlement });
});

/**
 * Mesita Pay readiness for THIS ticket's place — the full three-leg chain the
 * intent-bit column comments promise (_shared/payment-account-doc.ts):
 *
 *   places.mesita_pay_enabled  (operator intent bit)
 *   ∧ visits_config.payCard    (global rail switch)
 *   ∧ isConnectChargeReady     (Stripe-derived Connect capability)
 *
 * Returned as ONE derived boolean. The legs themselves never cross the wire:
 * `mesita_pay_enabled` is an admin-only Status fact (#10), deliberately kept
 * off the publicly-readable profiles view, and a guest has no business
 * learning a place's Connect state either.
 *
 * The global switch is checked FIRST and short-circuits, so while payCard is
 * false — which is every ticket in production today — this adds zero queries
 * to a poll that runs every consumerPollSeconds.
 */
async function cardRailReady(
  admin: ReturnType<typeof adminClient>,
  payCard: boolean,
  placeId: string | null,
): Promise<boolean> {
  if (!payCard || !placeId) return false;
  const [place, account] = await Promise.all([
    admin
      .from("places")
      .select("mesita_pay_enabled")
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("place_payment_accounts")
      .select("charges_enabled, details_submitted")
      .eq("place_id", placeId)
      .maybeSingle(),
  ]);
  const intent = (place.data as { mesita_pay_enabled?: boolean } | null)
    ?.mesita_pay_enabled ===
    true;
  if (!intent) return false;
  return isConnectChargeReady(
    account.data as
      | { charges_enabled: boolean; details_submitted: boolean }
      | null,
  );
}
