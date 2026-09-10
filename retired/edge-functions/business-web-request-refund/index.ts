// ARCHIVED — a retired Edge Function, kept as a record. Not a module: nothing
// imports it, nothing builds it, and it is not deployable from here.
//
//   cloud slug     business-web-request-refund
//   cloud version  15
//   last deployed  2026-08-23
//   repo source    none. This function never existed in mesita-monorepo and
//                  carries no git history anywhere — a leftover from the
//                  pre-monorepo standalone repos, deployed to the singleton
//                  project and never undeployed.
//   retired by     MESITA-1722
//
// Captured verbatim from the Supabase Management API so the deletion stays
// recoverable, because git holds no other copy. Nothing in apps/ or
// supabase/ called it.
//
// It could not have run. The bundle is frozen at its 2026-08-23 deploy, so it
// still reads `public.projects` (renamed to `public.places` by MESITA-1590)
// and inserts into `public.refund_requests`, which 20260825001000 dropped
// outright — the pgTAP suite now asserts that table stays gone. The
// `../_shared/*` paths below resolved against
// supabase/supabase/functions/_shared/ as it stood that day; they are recorded
// as written and do not resolve from this directory.
//
// ─────────────────────── original source below, verbatim ───────────────────

// Supabase Edge Function — business-web-request-refund (product caller)
//
// MESITA-1154 item 4: founding guarantee — a paid place's owner asks for a
// pro-rata refund in the first 90 days of membership. This EF only FILES the
// request; nothing here moves money or changes the plan. Admin adjudicates
// (admin-web-review-refund-request): approval downgrades plan→free and is
// still not automatic Stripe refund issuance (rule 11) — that stays a manual
// dashboard action.
//
// Body: { placeId | projectId, reason?: string }
// Response: { ok: true, request, withinGuaranteeWindow: boolean }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireOwner } from "../_shared/auth.ts";
import { isPaidPlan } from "../_shared/membership-enforcement-helpers.ts";

const GUARANTEE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_REASON = 1000;

type Body = { placeId?: string; projectId?: string; reason?: unknown };

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
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    projectId,
    "Only owners can request a refund.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const project = await admin
    .from("projects")
    .select("plan, plan_live_at, plan_forfeited_at")
    .eq("id", projectId)
    .maybeSingle();
  if (project.error) {
    return json({ ok: false, error: `project_read: ${project.error.message}` }, 500);
  }
  if (!project.data) return json({ ok: false, error: "Place not found" }, 404);

  if (!isPaidPlan(project.data.plan)) {
    return json(
      { ok: false, code: "not_a_member", error: "This place isn't on a paid Membership." },
      409,
    );
  }

  const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reasonRaw.length > MAX_REASON) {
    return json({ ok: false, error: `reason must be ${MAX_REASON} characters or fewer` }, 400);
  }
  const reason = reasonRaw || null;

  const planLiveAt = project.data.plan_live_at as string | null;
  const withinGuaranteeWindow = planLiveAt
    ? Date.now() - new Date(planLiveAt).getTime() <= GUARANTEE_WINDOW_MS
    : true; // No activation stamp yet — err toward letting the human decide.

  const inserted = await admin
    .from("refund_requests")
    .insert({
      project_id: projectId,
      requested_by: authRes.user.id,
      reason,
    })
    .select("id, status, created_at, reason")
    .single();
  if (inserted.error) {
    // The partial unique index (one PENDING request per project) blocks a
    // duplicate ask while one is already awaiting review.
    if (inserted.error.code === "23505") {
      return json(
        {
          ok: false,
          code: "already_requested",
          error: "A refund request for this place is already pending review.",
        },
        409,
      );
    }
    return json({ ok: false, error: `refund_insert: ${inserted.error.message}` }, 500);
  }

  return json({ ok: true, request: inserted.data, withinGuaranteeWindow });
});
