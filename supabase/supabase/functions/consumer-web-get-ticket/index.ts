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
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { guestVisitsPolicy, loadVisitsConfig } from "../_shared/visits-config.ts";

// The wallet's list columns plus the v4 journey state. updated_at rides along
// so the client can keep the freshest of (wallet row · this poll).
const TICKET_COLUMNS =
  "id, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, " +
  "review_status, review_screenshot_url, review_submitted_at, review_verified_at, review_reject_reason, " +
  "check_code, first_scanned_at, bill_subtotal_cents, tip_cents, tip_pct, total_cents, redeem_cents, " +
  "discount_percent, discount_cents, bill_source, revealed_at, " +
  "approved_at, approved_discount_cents, approved_amount_due_cents, fix_requested, fix_note, paid_method, validated_at, " +
  "currency, created_at, paid_at, cancelled_at, cancel_reason, " +
  "project_id, updated_at";

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
  const row = data as (Record<string, unknown> & { project_id: string | null }) | null;
  if (!row) {
    // Uniform miss — never confirms someone else's ticket exists.
    return json({ ok: false, error: "Ticket not found" }, 404);
  }

  const [ticket] = await attachPlaces(admin, [row]);
  const visits = guestVisitsPolicy(await loadVisitsConfig(admin));
  return json({ ok: true, ticket, visits });
});
