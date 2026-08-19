// Supabase Edge Function — business-web-record-strike
//
// Records a refused/ignored-QR strike against a place's Promos v4 membership
// (MESITA-542). Applies the ladder (1 warning+re-test · 2 pause 30d · 3 forfeit).
// The burned guest gets no compensation grant — a reward comes from showing up.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireEditor,
} from "../_shared/auth.ts";
import {
  isStrikeReason,
  recordMembershipStrike,
} from "../_shared/membership-enforcement.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  reason?: string;
  consumerId?: string;
  ticketId?: string;
  notes?: string;
};

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
  const reason = (body.reason ?? "").toString().trim();
  if (!isStrikeReason(reason)) {
    return json(
      { ok: false, error: "reason must be refused_qr or ignored_qr" },
      400,
    );
  }

  const admin = adminClient(envRes.env);
  const membership = await requireEditor(admin, authRes.user, projectId);
  if (!membership.ok) return membership.response;

  // Prefer consumer from the ticket when ticketId is supplied.
  let consumerId = (body.consumerId ?? "").toString().trim() || null;
  const ticketId = (body.ticketId ?? "").toString().trim() || null;
  if (ticketId) {
    const ticket = await admin
      .from("visit_tickets")
      .select("id, project_id, consumer_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticket.error) {
      return json({ ok: false, error: ticket.error.message }, 500);
    }
    if (!ticket.data || ticket.data.project_id !== projectId) {
      return json({ ok: false, error: "Ticket not found for this place" }, 404);
    }
    consumerId = (ticket.data.consumer_id as string) ?? consumerId;
  }

  const result = await recordMembershipStrike(admin, {
    projectId,
    reason,
    consumerId,
    ticketId,
    notes: (body.notes ?? "").toString().trim().slice(0, 240) || null,
  });
  if (!result.ok) return json({ ok: false, error: result.error }, 500);

  return json({
    ok: true,
    strikeNumber: result.strikeNumber,
    consequence: result.consequence,
    alreadyRecorded: result.alreadyRecorded ?? false,
  });
});
