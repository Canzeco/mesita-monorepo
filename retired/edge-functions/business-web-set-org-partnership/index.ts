// ARCHIVED — a retired Edge Function, kept as a record. Not a module: nothing
// imports it, nothing builds it, and it is not deployable from here.
//
//   cloud slug     business-web-set-org-partnership
//   cloud version  2
//   last deployed  2026-09-12
//   repo source    supabase/supabase/functions/business-web-set-org-partnership,
//                  shipped by MESITA-1798. Git holds the full history; this
//                  copy is the file as it stood the day it was retired.
//   retired by     MESITA-1889
//
// Why. It was one of three doors writing the same entitlement, and the only
// one that COUPLED two facts into a single write: `organizations.partnered`
// and `organizations.mesita_pay_enabled` moved together, so the operator
// could not make an organization a Partner without also switching card
// payments on for its guests. It also refused ON without a Ready Connect
// account — a lock that belongs to Mesita Pay, not to the partnership
// (Pato, 2026-09-15: the Membership is not Stripe-locked).
//
// What replaced it. `organizations.partnered` is written by the Mesita
// Membership lifecycle alone (MESITA-1877: business-web-start-membership →
// stripe-webhook-handle-event → _shared/partner-membership.ts). Mesita Pay
// gets its own owner-only writer in MESITA-1890. The per-place cascade this
// EF used (joinPlacePatch / dropPlacePatch / writePlacePartnership) survives
// in _shared/org-partnership.ts and is what the Membership writer calls.
//
// Its body, `setOrgPartnership` in _shared/org-partnership.ts, was deleted in
// the same PR; only the cascade helpers remain there. The `../_shared/*`
// imports below are recorded as written and do not resolve from this
// directory.
//
// ─────────────────────── original source below, verbatim ───────────────────

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
