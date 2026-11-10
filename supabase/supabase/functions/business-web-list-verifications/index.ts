// Supabase Edge Function — business-web-list-verifications
//
// MESITA-3103. Super-admin only. Who runs a place and who asked to: with
// `place_id`, that place's owners and pending requests; without, every
// pending request (the Internal queue), oldest first, each with its place's
// name. Each guest carries their phone, Instagram handle and Member number so
// the review is a quick decision.
//
// Body: { place_id?: uuid }
// Response: { ok: true, owners: OwnerView[], pending: (PendingRequestView & { place_name })[] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireBusinessSuperAdmin } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { listPlaceOwners, shapeOwners } from "../_shared/place-access.ts";

serveJson("business-web-list-verifications", async (req) => {
  const ctx = await requireBusinessSuperAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ place_id?: unknown }>(req, {});
  let result;
  if (isUuid(body.place_id)) {
    result = await listPlaceOwners(admin, body.place_id);
  } else {
    const { data, error } = await admin
      .from("place_verification_requests")
      .select("id, place_id, consumer_id, name, role, contact, note, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) return json({ ok: false, error: error.message }, 500);
    result = await shapeOwners(admin, [], (data ?? []) as Parameters<typeof shapeOwners>[2]);
  }

  const placeIds = [...new Set(result.pending.map((p) => p.place_id))];
  const names = new Map<string, string | null>();
  if (placeIds.length > 0) {
    const { data, error } = await admin.from("profiles").select("id, name").in("id", placeIds);
    if (error) console.error("[business-web-list-verifications] place names:", error.message);
    for (const r of (data ?? []) as Array<{ id: string; name: string | null }>) names.set(r.id, r.name);
  }

  return json({
    ok: true,
    owners: result.owners,
    pending: result.pending.map((p) => ({ ...p, place_name: names.get(p.place_id) ?? null })),
  });
});
