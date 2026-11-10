// Supabase Edge Function — admin-web-get-identity (product caller)
//
// Tiny session-check called by the admin app shell. Split from the old
// multi-caller auth-get-identity EF (MESITA-54; the endpoint name IS the ACL).
//
// Returns the caller's email + whether their email is in
// public.super_admins. The shell uses it to either render the admin surface
// or a friendly "your account isn't on the super-admin list" empty state.
//
// This door only authenticates — it doesn't authorize. A non-allowlisted
// caller still gets a 200 with `isSuperAdmin: false`; the shell handles the
// rendering. The privileged EFs are the real auth gate.
//
// Local:  supabase functions serve admin-web-get-identity
// Deploy: supabase functions deploy admin-web-get-identity

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonOk, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { checkSuperAdmin, getAuthedUser } from "../_shared/auth.ts";

serveJson("admin-web-get-identity", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;

  const isSuperAdmin = await checkSuperAdmin(admin, authRes.user);

  return jsonOk({ email: authRes.user.email, isSuperAdmin });
});
