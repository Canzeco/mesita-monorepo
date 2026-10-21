// Supabase Edge Function — admin-web-list-guests
//
// Manage › Guests (MESITA-2550). The 50 newest guests, or those whose name,
// member number or Instagram handle matches `q`, with their Diamond and plan.
// Closed accounts are left out. Read-only; super-admin only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  GUEST_LIST_LIMIT,
  GUEST_ROW_SELECT,
  guestSearchFilter,
  toGuestRow,
} from "../_shared/guest-standing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const body = await readJsonOr<{ q?: unknown }>(req, {});
  const filter = guestSearchFilter(body.q);

  let query = admin
    .from("consumers")
    .select(GUEST_ROW_SELECT)
    .is("deleted_at", null);
  if (filter) query = query.or(filter);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(GUEST_LIST_LIMIT);
  if (error) {
    return json({ ok: false, error: `list_failed: ${error.message}` }, 500);
  }

  return json({ ok: true, guests: (data ?? []).map(toGuestRow) });
});
