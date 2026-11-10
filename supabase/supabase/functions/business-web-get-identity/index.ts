// Supabase Edge Function — business-web-get-identity
//
// MESITA-3103. Who the signed-in caller is to the Business app: email, phone,
// whether they are a super-admin, and every place they run or asked to run.
// First call creates their consumers row (an owner is a guest with a phone),
// exactly as consumer-web-signin-phone does.
//
// Body: {}
// Response: { ok: true, email, phone, isSuperAdmin, hasAccount,
//             places: [{ place_id, name, photo, state, role, method, expires_at, decision_note }] }
//   state: owner | expired | pending | rejected  ("owner" = runs it, live)
//   role:  owner | editor | null  (MESITA-3120; null for a request)
//
// Every call first takes the caller's open team invites (place_invite_accept,
// MESITA-3120): an email the owner invited lands as an editor on sign-in.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { checkSuperAdmin } from "../_shared/auth-super-admin.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import { isLiveManager, MANAGER_COLUMNS, type ManagerRow } from "../_shared/place-access.ts";

type PlaceState = "owner" | "expired" | "pending" | "rejected";

serveJson("business-web-get-identity", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const [isSuperAdmin, consumer] = await Promise.all([checkSuperAdmin(admin, user), ensureConsumer(admin, user)]);
  if (!consumer.ok) return json({ ok: false, error: consumer.error, code: consumer.code ?? null }, consumer.status);

  const places: Array<{
    place_id: string;
    state: PlaceState;
    role: "owner" | "editor" | null;
    method: string | null;
    expires_at: string | null;
    decision_note: string | null;
    at: string;
  }> = [];

  if (consumer.consumerId && user.emailLower) {
    const accepted = await admin.rpc("place_invite_accept", { p_email: user.emailLower, p_consumer_id: consumer.consumerId });
    if (accepted.error) console.error("[business-web-get-identity] place_invite_accept:", accepted.error.message);
  }

  if (consumer.consumerId) {
    const [rows, reqs] = await Promise.all([
      admin.from("place_managers").select(MANAGER_COLUMNS).eq("consumer_id", user.id).is("revoked_at", null),
      admin.from("place_verification_requests")
        .select("place_id, status, decision_note, created_at, decided_at")
        .eq("consumer_id", user.id)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (rows.error) return json({ ok: false, error: rows.error.message }, 500);
    if (reqs.error) return json({ ok: false, error: reqs.error.message }, 500);
    const seen = new Set<string>();
    for (const r of (rows.data ?? []) as ManagerRow[]) {
      seen.add(r.place_id);
      places.push({
        place_id: r.place_id,
        state: isLiveManager(r) ? "owner" : "expired",
        role: r.role,
        method: r.method,
        expires_at: r.expires_at,
        decision_note: null,
        at: r.verified_at,
      });
    }
    for (const r of (reqs.data ?? []) as Array<{ place_id: string; status: string; decision_note: string | null; created_at: string; decided_at: string | null }>) {
      if (seen.has(r.place_id)) continue;
      seen.add(r.place_id);
      places.push({
        place_id: r.place_id,
        state: r.status === "pending" ? "pending" : "rejected",
        role: null,
        method: null,
        expires_at: null,
        decision_note: r.decision_note,
        at: r.decided_at ?? r.created_at,
      });
    }
  }

  const names = new Map<string, { name: string | null; photo: string | null }>();
  if (places.length > 0) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, name, photos")
      .in("id", places.map((p) => p.place_id));
    if (error) return json({ ok: false, error: error.message }, 500);
    for (const row of (data ?? []) as Array<{ id: string; name: string | null; photos: string[] | null }>) {
      names.set(row.id, { name: row.name, photo: row.photos?.[0] ?? null });
    }
  }

  const rank: Record<PlaceState, number> = { owner: 0, pending: 1, expired: 2, rejected: 3 };
  places.sort((a, b) => rank[a.state] - rank[b.state] || Date.parse(b.at) - Date.parse(a.at));

  return json({
    ok: true,
    email: user.email,
    phone: user.phone,
    isSuperAdmin,
    hasAccount: consumer.consumerId !== null,
    places: places.map(({ at: _at, ...p }) => ({
      ...p,
      name: names.get(p.place_id)?.name ?? null,
      photo: names.get(p.place_id)?.photo ?? null,
    })),
  });
});
