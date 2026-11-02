// Supabase Edge Function — business-web-find-place
//
// MESITA-3103. The Claim screen's search: Mesita places by name (the Mesita
// name or Google's), at most 20, each with its listing phone masked so the
// owner knows which number proves it, and the caller's own state on it.
// Archived places never show. With `place_id` it returns that one place (the
// consumer app's "Is this your business?" deep link).
//
// Body: { q?: string, place_id?: uuid }
// Response: { ok: true, places: [{ id, name, address, photo, masked_phone, phone_on_listing, mine }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { maskPhone } from "../_shared/place-verification.ts";
import { isLiveManager, MANAGER_COLUMNS, type ManagerRow } from "../_shared/place-access.ts";

type Row = {
  id: string;
  name: string | null;
  google_name: string | null;
  address: string | null;
  photos: string[] | null;
  phone: string | null;
};

const SELECT = "id, name, google_name, address, photos, phone";

serveJson("business-web-find-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const body = await readJsonOr<{ q?: unknown; place_id?: unknown }>(req, {});
  let query = admin.from("profiles").select(SELECT).in("state", ["active", "paused"]);
  if (isUuid(body.place_id)) {
    query = query.eq("id", body.place_id);
  } else {
    const q = typeof body.q === "string" ? body.q.trim().replace(/[%,()*\\]/g, " ").slice(0, 80) : "";
    if (q.length < 2) return json({ ok: true, places: [] });
    query = query.or(`name.ilike.%${q}%,google_name.ilike.%${q}%`).order("name", { ascending: true });
  }
  const { data, error } = await query.limit(20);
  if (error) return json({ ok: false, error: error.message }, 500);
  const rows = (data ?? []) as Row[];

  const mine = new Map<string, string>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const [managers, reqs] = await Promise.all([
      admin.from("place_managers").select(MANAGER_COLUMNS).eq("consumer_id", user.id).is("revoked_at", null).in("place_id", ids),
      admin.from("place_verification_requests").select("place_id").eq("consumer_id", user.id).eq("status", "pending").in("place_id", ids),
    ]);
    for (const r of (reqs.data ?? []) as Array<{ place_id: string }>) mine.set(r.place_id, "pending");
    for (const r of (managers.data ?? []) as ManagerRow[]) mine.set(r.place_id, isLiveManager(r) ? "owner" : "expired");
  }

  return json({
    ok: true,
    places: rows.map((r) => ({
      id: r.id,
      name: r.name ?? r.google_name,
      address: r.address,
      photo: r.photos?.[0] ?? null,
      masked_phone: maskPhone(r.phone),
      phone_on_listing: !!r.phone,
      mine: mine.get(r.id) ?? null,
    })),
  });
});
