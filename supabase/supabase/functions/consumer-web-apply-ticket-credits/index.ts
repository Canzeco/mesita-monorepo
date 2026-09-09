// Supabase Edge Function — consumer-web-apply-ticket-credits
//
// THE TICKET v4 (MESITA-1678): once approved, a guest may apply Credits as a
// one-time bill REDUCTION on (subtotal - discount) — never the tip, never a
// payment method of its own. Single-shot: a ticket either has never applied
// Credits or has applied exactly once; the RPC this calls is idempotent on
// that, so a client retry after a timeout returns the original result rather
// than double-spending.
//
// Gate is credits_enabled (place) AND payCredits (rail) — NOT
// resolveChargeableOrganizationForCredits from _shared/credits-readiness.ts,
// which also requires Stripe Connect charge-readiness. That chain answers
// "can this org receive a NEW Credits purchase" (MESITA-1676); spending an
// existing balance never touches Stripe at all under at_place, and even
// under mesita_pay the charge (if any) is computed separately on the net
// amount. Reusing the buy-readiness chain here would wrongly block spend at
// an org that accepts Credits but has no live Connect account.
//
// Caller: consumer. Verb: apply. Noun: ticket-credits.
//
// Body:     { ticketId, amountCents }
// Response: { ok: true, creditsAppliedCents, netAmountDueCents, idempotent? } | 400 | 404 | 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";

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

  const visitsConfig = await loadVisitsConfig(admin);
  if (!visitsConfig.payCredits) {
    return json(
      { ok: false, code: "not_chargeable", error: "Credits aren't accepted here." },
      409,
    );
  }
  const placeId = ticket.place_id as string | null;
  const [place, org] = await Promise.all([
    admin.from("place_profiles").select("credits_enabled").eq("id", placeId).maybeSingle(),
    admin.from("places").select("organization_id").eq("id", placeId).maybeSingle(),
  ]);
  const creditsEnabled =
    (place.data as { credits_enabled?: boolean } | null)?.credits_enabled === true;
  const organizationId =
    (org.data as { organization_id?: string | null } | null)?.organization_id ?? null;
  if (!creditsEnabled || !organizationId) {
    return json(
      { ok: false, code: "not_chargeable", error: "Credits aren't accepted here." },
      409,
    );
  }

  const { data, error } = await admin.rpc("apply_ticket_credits", {
    p_ticket_id: ticket.id,
    p_consumer_id: authRes.user.id,
    p_organization_id: organizationId,
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
