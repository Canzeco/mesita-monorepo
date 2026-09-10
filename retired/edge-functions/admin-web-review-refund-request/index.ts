// ARCHIVED — a retired Edge Function, kept as a record. Not a module: nothing
// imports it, nothing builds it, and it is not deployable from here.
//
//   cloud slug     admin-web-review-refund-request
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
// still reads and writes `public.projects` and `public.project_strikes`
// (renamed by MESITA-1590) and `public.refund_requests`, which 20260825001000
// dropped outright — the pgTAP suite now asserts that table stays gone. The
// `../_shared/*` paths below resolved against
// supabase/supabase/functions/_shared/ as it stood that day; they are recorded
// as written and do not resolve from this directory.
//
// ─────────────────────── original source below, verbatim ───────────────────

// Supabase Edge Function — admin-web-review-refund-request (admin caller)
//
// MESITA-1154 item 4: the admin-side half of the founding guarantee. A human
// adjudicates a business-web-request-refund row:
//
//   • approve — hard-gated on the place's own conduct (honored-rate clean,
//     no active strikes, not already forfeited) — same spirit as the issue's
//     "conditioned on the place's own conduct". Downgrades plan→free through
//     the SAME patch shape admin-web-set-plan uses for a voluntary drop.
//     Refund never comps to free-and-stays-paid; it always ends the
//     membership. Does NOT call Stripe — issuing the actual refund is a
//     manual admin action in the Stripe dashboard (rule 11: no automatic
//     refund execution). Call this EF again with action "mark_refunded"
//     once that's done, to close the audit trail.
//   • deny — status only, no plan change.
//   • mark_refunded — stamps stripe_refund_completed_at after the admin has
//     manually issued the refund. Only valid once approved.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Body: { requestId, action: "approve" | "deny" | "mark_refunded", notes?: string }
// Response: { ok: true, request }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { effectiveStrikeCount } from "../_shared/membership-enforcement.ts";
import { applyListingTypeToPatch } from "../_shared/partner-derivation.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";

const ACTIONS = ["approve", "deny", "mark_refunded"] as const;
type Action = (typeof ACTIONS)[number];

type Body = { requestId?: string; action?: string; notes?: unknown };

function isAction(v: unknown): v is Action {
  return (ACTIONS as readonly unknown[]).includes(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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

  const requestId = (body.requestId ?? "").toString().trim();
  if (!requestId) return json({ ok: false, error: "requestId is required" }, 400);
  if (!isAction(body.action)) {
    return json({ ok: false, error: `action must be one of ${ACTIONS.join(" | ")}` }, 400);
  }
  const notesRaw = typeof body.notes === "string" ? body.notes.trim() : "";
  const notes = notesRaw.length > 0 ? notesRaw.slice(0, 1000) : null;

  const reqRow = await admin
    .from("refund_requests")
    .select("id, project_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (reqRow.error) {
    return json({ ok: false, error: `request_read: ${reqRow.error.message}` }, 500);
  }
  if (!reqRow.data) return json({ ok: false, error: "Refund request not found" }, 404);
  const request = reqRow.data as { id: string; project_id: string; status: string };

  if (body.action === "mark_refunded") {
    if (request.status !== "approved") {
      return json(
        { ok: false, error: "Only an approved request can be marked refunded" },
        409,
      );
    }
    const stamp = await admin
      .from("refund_requests")
      .update({ stripe_refund_completed_at: new Date().toISOString() })
      .eq("id", requestId)
      .select("id, status, stripe_refund_completed_at")
      .single();
    if (stamp.error) return json({ ok: false, error: stamp.error.message }, 500);
    return json({ ok: true, request: stamp.data });
  }

  if (request.status !== "pending") {
    return json({ ok: false, error: `Request is already ${request.status}` }, 409);
  }

  if (body.action === "deny") {
    const denied = await admin
      .from("refund_requests")
      .update({
        status: "denied",
        reviewed_at: new Date().toISOString(),
        reviewed_by: authRes.user.id,
        admin_notes: notes,
      })
      .eq("id", requestId)
      .select("id, status, reviewed_at, admin_notes")
      .single();
    if (denied.error) return json({ ok: false, error: denied.error.message }, 500);
    return json({ ok: true, request: denied.data });
  }

  // ── approve ────────────────────────────────────────────────────────────
  const project = await admin
    .from("projects")
    .select(
      "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, strike_count, last_strike_at, plan_forfeited_at",
    )
    .eq("id", request.project_id)
    .maybeSingle();
  if (project.error) {
    return json({ ok: false, error: `project_read: ${project.error.message}` }, 500);
  }
  if (!project.data) return json({ ok: false, error: "Place not found" }, 404);
  const row = project.data as Record<string, unknown>;

  if (row.plan_forfeited_at) {
    return json(
      {
        ok: false,
        code: "not_eligible",
        error: "This place already forfeited its membership on strikes — nothing to refund.",
      },
      409,
    );
  }
  const strikes = effectiveStrikeCount({
    strike_count: (row.strike_count as number) ?? 0,
    last_strike_at: (row.last_strike_at as string) ?? null,
  });
  if (strikes > 0) {
    return json(
      {
        ok: false,
        code: "not_eligible",
        error:
          "The founding guarantee is conditioned on a clean honored-rate — this place has active strikes.",
      },
      409,
    );
  }

  // Same patch shape as admin-web-set-plan's voluntary drop (T13): plan→free,
  // clear activation stamps, re-derive listing_type. Never comps to free —
  // the membership ends, it does not continue for free.
  const patch: Record<string, unknown> = {
    plan: "free",
    plan_live_at: null,
    first_ticket_honored_at: null,
  };
  applyListingTypeToPatch(patch, {
    plan: "free",
    rates: ratesFromPlace(row),
    currentListingType: row.listing_type as string,
  });

  const downgrade = await admin.from("projects").update(patch).eq("id", request.project_id);
  if (downgrade.error) {
    return json({ ok: false, error: `downgrade: ${downgrade.error.message}` }, 500);
  }

  const approved = await admin
    .from("refund_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: authRes.user.id,
      admin_notes: notes,
    })
    .eq("id", requestId)
    .select("id, status, reviewed_at, admin_notes")
    .single();
  if (approved.error) return json({ ok: false, error: approved.error.message }, 500);

  return json({ ok: true, request: approved.data, plan: "free" });
});
