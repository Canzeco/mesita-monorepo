// Supabase Edge Function — business-web-remove-member
//
// MESITA-3120. The owner (or Mesita staff) removes an editor from a place, or
// cancels an open invite. The owner is never removed here: hand the place
// over first (business-web-transfer-owner).
//
// Body: { place_id: uuid, manager_id?: uuid, invite_id?: uuid }
// Response: { ok: true }   409 cannot_remove_owner · 403 owner_only · 404

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";

serveJson("business-web-remove-member", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, manager_id: managerId, invite_id: inviteId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isUuid(managerId) && !isUuid(inviteId)) return json({ ok: false, error: "manager_id or invite_id is required" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();
  const now = new Date().toISOString();

  if (isUuid(inviteId)) {
    const { data, error } = await admin.from("place_invites").update({ revoked_at: now })
      .eq("id", inviteId).eq("place_id", placeId).is("accepted_at", null).is("revoked_at", null).select("id").maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, code: "not_found", error: "Invite not found" }, 404);
    return json({ ok: true });
  }

  const row = await admin.from("place_managers").select("id, role").eq("id", managerId).eq("place_id", placeId)
    .is("revoked_at", null).maybeSingle();
  if (row.error) return json({ ok: false, error: row.error.message }, 500);
  if (!row.data) return json({ ok: false, code: "not_found", error: "Member not found" }, 404);
  if ((row.data as { role: string }).role === "owner") {
    return json({ ok: false, code: "cannot_remove_owner", error: "Make an editor the owner first" }, 409);
  }
  const { error } = await admin.from("place_managers")
    .update({ revoked_at: now, revoked_by: access.role === "superadmin" ? (user.emailLower ?? "staff") : "owner", updated_at: now })
    .eq("id", managerId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
});
