// Supabase Edge Function — admin-web-grant-admin
//
// Adds an email to the super-admin allowlist (public.super_admins).
// Caller must already be a super-admin. Idempotent: re-granting an
// existing email refreshes its note rather than erroring. The email is
// the allowlist key (an auth account isn't required to exist yet — the
// user_id backfills on that person's first authed call, see
// _shared/auth.ts checkSuperAdmin).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";

type Body = { email?: string; note?: string };

// Pragmatic email shape check — the same lenient pattern used elsewhere.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serveJson("admin-web-grant-admin", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const email = (bodyRes.body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "A valid email is required" }, 400);
  }
  const note = (bodyRes.body.note ?? "").trim().slice(0, 280) || null;

  const { data, error } = await admin
    .from("super_admins")
    .upsert(
      { email, note, added_by: user.id },
      { onConflict: "email" },
    )
    .select("email, note, created_at, added_by")
    .single();
  if (error) {
    return json({ ok: false, error: `grant_failed: ${error.message}` }, 500);
  }

  return json({ ok: true, admin: data });
});
