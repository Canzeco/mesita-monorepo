// Supabase Edge Function — consumer-web-apply-ticket-credits
//
// THE TICKET v4 (MESITA-1678): once approved, a guest may apply Credits as a
// one-time bill REDUCTION on (subtotal - discount) — never the tip, never a
// payment method of its own. Single-shot: a ticket either has never applied
// Credits or has applied exactly once; the RPC this calls is idempotent on
// that, so a client retry after a timeout returns the original result rather
// than double-spending.
//
// Gate is payCredits (rail) AND the place honours spend (issuer rule, G4),
// computed by
// placesHonouringCredits (MESITA-2051) — NOT
// resolveChargeablePlaceForCredits from _shared/credits-readiness.ts, which
// also requires Stripe Connect charge-readiness. That chain answers "can this
// place receive a NEW Credits purchase" (MESITA-1676); spending an existing
// balance never touches Stripe at all under at_place, and even under
// mesita_pay the charge (if any) is computed separately on the net amount.
// Reusing the buy-readiness chain here would wrongly block spend at a place
// that accepts Credits but has no live Connect account.
//
// ONE PLACE LOOKUP, NOT TWO (MESITA-1892). This used to read the ticket's
// place AND that place's organization, because the balance being spent hung
// off the organization and the RPC took its id. credit_lots is the place's
// now, so the ticket's own place_id is the whole scope: the guest spends what
// they are owed at the venue they are sitting in.
//
// Caller: consumer. Verb: apply. Noun: ticket-credits.
//
// Body:     { ticketId, amountCents }
// Response: { ok: true, creditsAppliedCents, netAmountDueCents, idempotent? } | 400 | 404 | 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { placesHonouringCredits } from "../_shared/credits-readiness.ts";

type Body = { ticketId?: string; amountCents?: number };

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
  if (!ticketId) return jsonError("ticketId is required", 400);

  // Validated BEFORE the RPC call: a non-integer or non-positive value here
  // would otherwise surface as a raw PostgREST 500 instead of a clean 400.
  const amountCents = bodyRes.body.amountCents;
  if (
    typeof amountCents !== "number" || !Number.isFinite(amountCents) ||
    !Number.isInteger(amountCents) || amountCents <= 0
  ) {
    return jsonError("amountCents must be a positive integer", 400);
  }

  const admin = adminClient(envRes.env);
  const ticketRow = await admin
    .from("visit_tickets")
    // visit_tickets.place_id, NOT project_id — the column was renamed
    // repo-wide in 20260825005000_rename_project_id_to_place_id.sql.
    // consumer-web-select-ticket-payment had this wrong (fixed alongside
    // this EF, MESITA-1678) — verified directly against the live schema
    // rather than copying that file's pattern.
    .select("id, consumer_id, state, place_id, credits_applied_cents")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return jsonError(`ticket_lookup: ${ticketRow.error.message}`, 500);
  }
  if (!ticketRow.data || ticketRow.data.consumer_id !== authRes.user.id) {
    return jsonError("Ticket not found", 404);
  }
  const ticket = ticketRow.data;

  // A FAILED LOOKUP IS NOT "NOT ACCEPTED" (MESITA-2051). This read used to be
  // inline and never looked at its error, so a database blip told a guest at
  // the table "Credits aren't accepted here." The shared predicate returns
  // ok:false instead, and that is a 500 with a name, not a false 409.
  const visitsConfig = await loadVisitsConfig(admin);
  const placeId = ticket.place_id as string | null;
  const honour = placeId
    ? await placesHonouringCredits(admin, [placeId], visitsConfig.payCredits)
    : null;
  if (honour && !honour.ok) {
    return jsonError(`credits_honour_lookup: ${honour.error}`, 500);
  }
  if (!placeId || !honour?.ok || !honour.honoured.has(placeId)) {
    return json(
      { ok: false, code: "not_chargeable", error: "Credits aren't accepted here." },
      409,
    );
  }

  const { data, error } = await admin.rpc("apply_ticket_credits", {
    p_ticket_id: ticket.id,
    p_consumer_id: authRes.user.id,
    p_place_id: placeId,
    p_amount_cents: amountCents,
  });
  if (error) return jsonError(`apply_ticket_credits: ${error.message}`, 500);

  const result = data as {
    ok: boolean;
    code?: string;
    cap?: number;
    idempotent?: boolean;
    creditsAppliedCents?: number;
    netAmountDueCents?: number;
    state?: string;
  };
  if (!result.ok) {
    const status = result.code === "not_found"
      ? 404
      : (result.code === "stale_state" || result.code === "insufficient_credits" ||
          result.code === "race_lost")
      ? 409
      : 400;
    return json(result, status);
  }

  return json({
    ok: true,
    creditsAppliedCents: result.creditsAppliedCents,
    netAmountDueCents: result.netAmountDueCents,
    ...(result.idempotent ? { idempotent: true } : {}),
  });
});
