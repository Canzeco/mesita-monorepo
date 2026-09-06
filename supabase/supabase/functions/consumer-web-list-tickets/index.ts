// Supabase Edge Function — consumer-web-list-tickets
//
// Authenticated. Returns the caller's tickets (consumer perspective), most
// recent first, with the place name joined for display. Self-contained:
// own JWT verification, own DB read; never calls another Edge Function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, rejectUnlessMethods, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { LIVE_STATES, TERMINAL_STATES } from "../_shared/ticket-state.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const _methodGuard = rejectUnlessMethods(req, "GET", "POST");
  if (_methodGuard) return _methodGuard;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  // Tickets v2 (MESITA-806): the Rewards New/History tabs read this EF
  // directly (the list used to be notification-derived). `scope` splits the
  // two tabs server-side; check_code is returned to the OWNER only — it is
  // their ticket, and the New tab renders the check.mesita.ai QR from it.
  let limit = DEFAULT_LIMIT;
  let scope: "active" | "history" | null = null;
  if (req.method === "POST") {
    const body = await readJsonOr<{ limit?: number; scope?: string }>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
    if (body.scope === "active" || body.scope === "history") {
      scope = body.scope;
    }
  }

  const admin = adminClient(envRes.env);

  let query = admin
    .from("visit_tickets")
    .select(
      "id, state, story_state, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, review_state, review_screenshot_url, review_submitted_at, review_verified_at, review_reject_reason, check_code, first_scanned_at, bill_subtotal_cents, tip_cents, tip_pct, total_cents, redeem_cents, discount_percent, discount_cents, bill_source, revealed_at, approved_at, approved_discount_cents, approved_amount_due_cents, fix_requested, fix_note, paid_method, validated_at, currency, created_at, paid_at, cancelled_at, cancel_reason, place_id, updated_at",
    )
    .eq("consumer_id", userId);
  if (scope === "active") {
    query = query.in("state", [...LIVE_STATES]);
  } else if (scope === "history") {
    query = query.in("state", [...TERMINAL_STATES]);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, tickets: await attachPlaces(admin, data ?? []) });
});
