// Supabase Edge Function — business-web-list-tickets
//
// Authenticated. Returns the most recent tickets for a place the caller is
// a member of. Joins the consumer's display fields (code, full name) for the
// validator UI. Self-contained.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, clampIntRange, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type Body = { placeId?: string; projectId?: string; limit?: number };

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
  const body = bodyRes.body;
  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);
  const limit = clampIntRange(Number(body.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT);

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  const { data, error } = await admin
    .from("visit_tickets")
    .select(
      // Privacy-safe consumer join — never class_key / class_origin
      // (blended-rate privacy: businesses must not learn class or entry door).
      "id, kind, status, story_status, story_screenshot_url, story_submitted_at, story_verified_at, story_reject_reason, bill_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_percent, discount_cents, revealed_at, reservation_status, reservation_at, reservation_party_size, currency, created_at, paid_at, cancelled_at, cancel_reason, consumer:consumers(id, code, full_name, birthday, sex, country)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, tickets: data ?? [] });
});
