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
import { corsPreflight, jsonOk, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, checkSuperAdmin, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

serveJson("admin-web-get-identity", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const isSuperAdmin = await checkSuperAdmin(admin, authRes.user);

  return jsonOk({ email: authRes.user.email, isSuperAdmin });
});
