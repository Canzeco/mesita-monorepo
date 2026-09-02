// Supabase Edge Function — admin-web-review-ticket-report (product caller)
//
// Operator triage for guest-filed ticket reports (MESITA-1311), the review
// half of the v3c report loop: a report is EVIDENCE, never an automatic
// strike, so a human confirms or dismisses it here.
//
//   confirm  { reportId }  the report is real (ghost-partner refusal):
//            marks it reviewed AND sets the place's ghost-partner hold —
//            projects.reward_lane_pending_review_at — which closes the
//            reward lane (assessPromoLane → pending_review) ahead of any
//            strike decision, so a place under review honors nothing while
//            Mesita looks at it.
//   dismiss  { reportId }  the report doesn't hold up: marks it dismissed.
//            No place state changes.
//   restore  { placeId }   review ended — clears the hold. The lane
//            reopens to whatever the strike ladder already says.
//
// Writes to `projects` go through writePlace (the place-doc door) — never a
// raw .from("projects").update(). Auth: caller's JWT email must be in
// public.super_admins.
//
// Local:  supabase functions serve admin-web-review-ticket-report
// Deploy: supabase functions deploy admin-web-review-ticket-report

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";

type Body = {
  action?: string;
  reportId?: string;
  placeId?: string;
};

type ReportRow = {
  id: string;
  project_id: string;
  status: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const action = (body.action ?? "").toString();
  const now = new Date().toISOString();

  if (action === "restore") {
    const placeId = (body.placeId ?? "").toString().trim();
    if (!placeId) return json({ ok: false, error: "Missing placeId" });
    const update = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: placeId,
      patch: { reward_lane_pending_review_at: null },
      select: "id, reward_lane_pending_review_at",
    });
    if (!update.ok) return json({ ok: false, error: update.error });
    return json({ ok: true, placeId, hold: null });
  }

  if (action !== "confirm" && action !== "dismiss") {
    return json({
      ok: false,
      error: "action must be confirm, dismiss, or restore",
    });
  }

  const reportId = (body.reportId ?? "").toString().trim();
  if (!reportId) return json({ ok: false, error: "Missing reportId" });

  const reportRes = await admin
    .from("ticket_reports")
    .select("id, project_id, status")
    .eq("id", reportId)
    .maybeSingle();
  if (reportRes.error) {
    return json({ ok: false, error: reportRes.error.message });
  }
  const report = reportRes.data as ReportRow | null;
  if (!report) {
    return json({ ok: false, code: "not_found", error: "Report not found" });
  }
  if (report.status !== "open") {
    // Triage happened already — say so instead of silently re-stamping.
    return json({
      ok: false,
      code: "already_reviewed",
      error: `Report is already ${report.status}.`,
    });
  }

  if (action === "confirm") {
    // The hold FIRST: if the place write fails, the report stays open and
    // the whole action reads as not-done — never a reviewed report whose
    // hold silently didn't land.
    const update = await writePlace(admin, {
      table: "projects",
      mode: "update",
      id: report.project_id,
      patch: { reward_lane_pending_review_at: now },
      select: "id, reward_lane_pending_review_at",
    });
    if (!update.ok) return json({ ok: false, error: update.error });
  }

  const mark = await admin
    .from("ticket_reports")
    .update({
      status: action === "confirm" ? "reviewed" : "dismissed",
      reviewed_at: now,
      reviewed_by: authRes.user.id,
    })
    .eq("id", reportId)
    .eq("status", "open")
    .select("id, status")
    .maybeSingle();
  if (mark.error) return json({ ok: false, error: mark.error.message });
  if (!mark.data) {
    return json({
      ok: false,
      code: "already_reviewed",
      error: "Report was triaged by someone else just now.",
    });
  }

  return json({
    ok: true,
    report: { id: reportId, status: (mark.data as ReportRow).status },
    placeId: report.project_id,
    hold: action === "confirm" ? now : null,
  });
});
