// Supabase Edge Function — business-web-get-identity (product caller)
//
// Tiny session-check called by the business console shell (drives the
// super-admin banner). Thin per-caller door over _shared/identity.ts —
// split from the old multi-caller auth-get-identity EF (MESITA-54; the
// endpoint name IS the ACL).
//
// Local:  supabase functions serve business-web-get-identity
// Deploy: supabase functions deploy business-web-get-identity

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, rejectUnlessMethods } from "../_shared/http.ts";
import { handleGetIdentity } from "../_shared/identity.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;
  return await handleGetIdentity(req);
});
