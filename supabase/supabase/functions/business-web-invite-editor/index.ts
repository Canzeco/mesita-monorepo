// Supabase Edge Function — business-web-invite-editor
//
// MESITA-3120. The owner (or Mesita staff) invites an editor to a place by
// Google email. The invite is accepted when that email signs in to the
// Business app (business-web-get-identity → place_invite_accept).
//
// Body: { place_id: uuid, email: string }
// Response: { ok: true, invite: { id, email, created_at } }
//   409 already_invited · 403 owner_only

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serveJson("business-web-invite-editor", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const email = typeof bodyRes.body.email === "string" ? bodyRes.body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 320) {
    return json({ ok: false, code: "bad_email", error: "Enter a valid email" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();
  if (email === user.emailLower) return json({ ok: false, code: "self", error: "You are already on this place's team" }, 400);

  const { data, error } = await admin
    .from("place_invites")
    .insert({ place_id: placeId, email, invited_by: access.role === "superadmin" ? null : user.id })
    .select("id, email, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return json({ ok: false, code: "already_invited", error: "That email is already invited" }, 409);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, invite: data });
});
