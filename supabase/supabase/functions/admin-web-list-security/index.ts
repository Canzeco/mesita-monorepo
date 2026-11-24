// Supabase Edge Function — admin-web-list-security
//
// MESITA-4899, Admin › Security: the suspended guests (newest first, reinstated
// ones after) and the last tickets three wrong waiter codes closed.
//
// Body: {}
// Response: { ok: true, suspensions: [{ id, guest, place, closures, suspended_at,
//             reinstated_at }], closures: [{ id, guest, place, created_at }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";

type Who = { consumers: { first_name: string | null; code: string | null } | null; places: { place_profiles: { name: string | null; google_name: string | null } | null } | null };
const names = (r: Who) => ({
  guest: `${r.consumers?.first_name?.trim() || "A guest"}${r.consumers?.code ? ` · #${r.consumers.code}` : ""}`,
  place: r.places?.place_profiles?.name ?? r.places?.place_profiles?.google_name ?? null,
});
const WHO = "consumers(first_name, code), places(place_profiles(name, google_name))";

serveJson("admin-web-list-security", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const [s, c] = await Promise.all([
    ctx.admin.from("guest_suspensions").select(`id, closures, suspended_at, reinstated_at, ${WHO}`).order("reinstated_at", { ascending: false, nullsFirst: true }).order("suspended_at", { ascending: false }).limit(100),
    ctx.admin.from("guest_ticket_closures").select(`id, created_at, ${WHO}`).order("created_at", { ascending: false }).limit(50),
  ]);
  const error = s.error ?? c.error;
  if (error) return json({ ok: false, error: `security: ${error.message}` }, 500);
  type S = Who & { id: string; closures: number; suspended_at: string; reinstated_at: string | null };
  type C = Who & { id: string; created_at: string };
  return json({
    ok: true,
    suspensions: ((s.data ?? []) as unknown as S[]).map((r) => ({ id: r.id, ...names(r), closures: r.closures, suspended_at: r.suspended_at, reinstated_at: r.reinstated_at })),
    closures: ((c.data ?? []) as unknown as C[]).map((r) => ({ id: r.id, ...names(r), created_at: r.created_at })),
  });
});
