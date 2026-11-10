// Supabase Edge Function — business-web-decide-verification
//
// MESITA-3103. Super-admin only. Approve or reject a pending "I run this
// place" request, or revoke a guest who runs a place. Approval writes the
// row and closes the request in one RPC (place_verification_approve). Every
// decision lands in admin_operator_events.
//
// Body: { request_id: uuid, decision: "approve" | "reject", note?: string }
//     | { manager_id: uuid, decision: "revoke", note?: string }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessSuperAdmin } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { boundedText, VERIFICATION_DAYS } from "../_shared/place-verification.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

const SOURCE = "business-web-decide-verification";

serveJson("business-web-decide-verification", async (req) => {
  const ctx = await requireBusinessSuperAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { request_id: requestId, manager_id: managerId, decision } = bodyRes.body;
  const note = boundedText(bodyRes.body.note, 500);
  if (note === undefined) return json({ ok: false, error: "The note is 500 characters at most" }, 400);

  if (decision === "revoke") {
    if (!isUuid(managerId)) return json({ ok: false, error: "manager_id is required" }, 400);
    const { data, error } = await admin
      .from("place_managers")
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.emailLower, note, updated_at: new Date().toISOString() })
      .eq("id", managerId)
      .is("revoked_at", null)
      .select("place_id, consumer_id")
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, error: "Not found or already revoked" }, 404);
    await recordAdminOperatorEvent(admin, {
      verb: "update", outcome: "succeeded", placeId: data.place_id, actorUserId: user.id, source: SOURCE,
      detail: { decision: "revoke", manager_id: managerId, consumer_id: data.consumer_id },
    });
    return json({ ok: true });
  }

  if (decision !== "approve" && decision !== "reject") {
    return json({ ok: false, error: "decision must be approve, reject or revoke" }, 400);
  }
  if (!isUuid(requestId)) return json({ ok: false, error: "request_id is required" }, 400);

  const { data: request, error: readErr } = await admin
    .from("place_verification_requests")
    .select("id, place_id, consumer_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  if (!request || request.status !== "pending") {
    return json({ ok: false, code: "not_pending", error: "This request was already decided" }, 409);
  }

  if (decision === "approve") {
    const { data, error } = await admin.rpc("place_verification_approve", {
      p_place_id: request.place_id,
      p_consumer_id: request.consumer_id,
      p_method: "review",
      p_days: VERIFICATION_DAYS,
      p_request_id: request.id,
      p_reviewer: user.emailLower,
      p_note: note,
    });
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, code: "not_pending", error: "This request was already decided" }, 409);
  } else {
    const { data, error } = await admin
      .from("place_verification_requests")
      .update({ status: "rejected", decided_at: new Date().toISOString(), reviewer_email: user.emailLower, decision_note: note })
      .eq("id", request.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, code: "not_pending", error: "This request was already decided" }, 409);
  }

  await recordAdminOperatorEvent(admin, {
    verb: "update", outcome: "succeeded", placeId: request.place_id, actorUserId: user.id, source: SOURCE,
    detail: { decision, request_id: request.id, consumer_id: request.consumer_id },
  });
  return json({ ok: true });
});
