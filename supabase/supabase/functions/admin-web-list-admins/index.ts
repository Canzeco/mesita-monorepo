// Supabase Edge Function — admin-web-list-admins
//
// Lists the super-admin allowlist (public.super_admins). Read-only.
// Caller must already be a super-admin. Powers the "Add/remove admins"
// card in the admin app's Admin Configuration page.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";

serveJson("admin-web-list-admins", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const { data, error } = await admin
    .from("super_admins")
    .select("email, note, created_at, added_by")
    .order("created_at", { ascending: true });
  if (error) {
    return json({ ok: false, error: `list_failed: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    admins: data ?? [],
    self: user.emailLower,
  });
});
