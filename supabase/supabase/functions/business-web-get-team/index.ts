// Supabase Edge Function — business-web-get-team
//
// MESITA-3120. A place's team for Settings: the owner, the editors and (for
// the owner and Mesita staff) the open invites. Any member may read it.
// Teams are per place; there is no organization layer above places.
//
// Body: { place_id: uuid }
// Response: { ok: true, role, members: [{ id, name, email, role, live,
//   expires_at, me }], invites: [{ id, email, created_at }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { canManage, MANAGER_COLUMNS, type ManagerRow, requirePlaceAccess, shapeOwners } from "../_shared/place-access.ts";

serveJson("business-web-get-team", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const rows = await admin.from("place_managers").select(MANAGER_COLUMNS).eq("place_id", placeId).is("revoked_at", null)
    .order("verified_at", { ascending: true });
  if (rows.error) return json({ ok: false, error: rows.error.message }, 500);
  const managers = (rows.data ?? []) as ManagerRow[];
  const { owners } = await shapeOwners(admin, managers, []);

  // Google emails come from auth (consumers rows carry none).
  const emails = new Map<string, string | null>();
  await Promise.all(managers.map(async (m) => {
    const u = await admin.auth.admin.getUserById(m.consumer_id);
    emails.set(m.consumer_id, u.data.user?.email ?? null);
  }));

  let invites: Array<{ id: string; email: string; created_at: string }> = [];
  if (canManage(access.role)) {
    const inv = await admin.from("place_invites").select("id, email, created_at").eq("place_id", placeId)
      .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: true });
    if (inv.error) return json({ ok: false, error: inv.error.message }, 500);
    invites = (inv.data ?? []) as typeof invites;
  }

  const members = owners
    .map((o) => ({
      id: o.id,
      name: o.name,
      email: emails.get(o.consumer_id) ?? null,
      role: o.role,
      live: o.live,
      expires_at: o.expires_at,
      me: o.consumer_id === user.id,
    }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));

  return json({ ok: true, role: access.role, members, invites });
});
