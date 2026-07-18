// Supabase Edge Function — admin-web-set-plan
//
// The admin door onto projects.plan. business-web-change-subscription puts
// it this way: "A Stripe subscription is billing, not entitlement:
// projects.plan is the single source of truth and can be granted through
// other doors (admin, partnership)." This is that door.
//
// Grants or revokes a membership directly. No Stripe, no money, no
// project_subscriptions row — entitlement only. The admin console needs it
// because business-web-update-project deliberately rejects `plan` (it is
// billing, not profile), and business-web-change-subscription is the paid
// door: owner-scoped and, once live-mode ships, it would open a real Stripe
// Checkout against someone else's place.
//
// Deliberately NOT coupled to billing: if a place carries a live Stripe
// subscription, setting plan here changes entitlement and leaves that
// subscription alone — it will keep billing until it is cancelled through
// the paid door. Downgrading a paying place is an entitlement decision, not
// a refund. Same rule in reverse: granting `pro` here creates no
// subscription and charges nobody.
//
// Body: { placeId | projectId, plan: "free" | "pro" | "ultra" }
// Response: { ok: true, plan, place }  — `place` is the same AdminPlace
//           shape business-web-update-project returns, so the console can
//           reconcile its optimistic state from one call.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";

// public.membership — free | pro | ultra. `ultra` is legacy (no longer sold,
// MESITA-541) but still grantable for the places that already carry it.
const PLANS = ["free", "pro", "ultra"] as const;
type Plan = (typeof PLANS)[number];

type Body = {
  placeId?: unknown;
  projectId?: unknown;
  plan?: unknown;
};

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
  const body = bodyRes.body;

  const projectId = readPlaceIdAlias(body);
  if (!projectId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }
  if (!PLANS.includes(body.plan as Plan)) {
    return json(
      { ok: false, error: `plan must be one of ${PLANS.join(" | ")}` },
      400,
    );
  }
  const plan = body.plan as Plan;

  // plan is a `projects` column — write it where the other two plan writers
  // do (business-web-change-subscription's mock grant, stripe-webhook-handle-
  // event), not through projects_view.
  const { data: updated, error } = await admin
    .from("projects")
    .update({ plan })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) {
    return json({ ok: false, error: `plan_update: ${error.message}` }, 500);
  }
  if (!updated) {
    return json({ ok: false, error: "Place not found" }, 404);
  }

  // Re-read through the view so the console gets the same AdminPlace shape
  // business-web-update-project hands back.
  const { data: place, error: readError } = await admin
    .from("projects_view")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", projectId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, plan, place });
});
