// Supabase Edge Function — consumer-web-list-tickets
//
// Authenticated. Returns the caller's tickets (consumer perspective), most
// recent first, with the place name joined for display. Self-contained:
// own JWT verification, own DB read; never calls another Edge Function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  // Tickets v2 (MESITA-806): the Rewards New/History tabs read this EF
  // directly (the list used to be notification-derived). `scope` splits the
  // two tabs server-side; check_code is returned to the OWNER only — it is
  // their ticket, and the New tab renders the mesita.ai/check QR from it.
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
    .from("tickets")
    .select(
      "id, kind, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, review_status, review_screenshot_url, review_submitted_at, review_verified_at, review_reject_reason, check_code, first_scanned_at, check_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_percent, discount_cents, revealed_at, reservation_status, reservation_at, reservation_party_size, currency, created_at, paid_at, cancelled_at, cancel_reason, project_id",
    )
    .eq("consumer_id", userId);
  if (scope === "active") {
    query = query.in("status", ["open", "awaiting_story", "awaiting_payment_confirm"]);
  } else if (scope === "history") {
    query = query.in("status", ["revealed", "cancelled"]);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, tickets: await attachPlaces(admin, data ?? []) });
});
