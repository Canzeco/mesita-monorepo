// Supabase Edge Function — business-web-set-org-partnership
//
// The OPERATOR's door onto an organization's Partner switch (MESITA-1798).
// Place-level join/drop stays on business-web-set-partnership for strategy
// and forfeit recovery; THIS door is the Organization screen's one toggle.
//
// Body: { orgId, partnered: boolean }
// Response: { ok: true, partnered, mesitaPayEnabled, placesJoined, placesDropped }
//
// Auth: requireOrgRole owner — same as Connect Stripe. Partner is an org
// fact that cascades onto every held place.
//
// Turning ON refuses unless the org's Connect account is charge-ready
// (code stripe_not_ready). The client lock and this 409 are the same gate.
//
// Local:  supabase functions serve business-web-set-org-partnership
// Deploy: supabase functions deploy business-web-set-org-partnership

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { setOrgPartnership } from "../_shared/org-partnership.ts";

type Body = { orgId?: unknown; partnered?: unknown };

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
  const orgId = typeof bodyRes.body.orgId === "string"
    ? bodyRes.body.orgId.trim()
    : "";
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);
  if (typeof bodyRes.body.partnered !== "boolean") {
    return json({ ok: false, error: "partnered must be a boolean" }, 400);
  }

  const admin = adminClient(envRes.env);
  const roleRes = await requireOrgRole(admin, authRes.user, orgId, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const result = await setOrgPartnership(admin, orgId, bodyRes.body.partnered);
  if (!result.ok) {
    return json(
      { ok: false, code: result.code, error: result.error },
      result.status,
    );
  }
  return json({
    ok: true,
    partnered: result.partnered,
    mesitaPayEnabled: result.mesitaPayEnabled,
    placesJoined: result.placesJoined,
    placesDropped: result.placesDropped,
  });
});
