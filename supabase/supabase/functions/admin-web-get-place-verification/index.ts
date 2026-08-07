// Supabase Edge Function — admin-web-get-place-verification
//
// Read-only ownership-verification glance for Manage Single → Admin →
// Verification. Returns the immutable requester_email from the latest
// approved project_verifications row for this place (who completed
// ownership proof — distinct from current project_members owners).
//
// Auth: super-admin only.
// Deploy: supabase functions deploy admin-web-get-place-verification

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { projectId?: string; placeId?: string };

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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  // Latest approved ownership proof — requester_email is immutable on the row.
  const { data, error } = await admin
    .from("project_verifications")
    .select("requester_email, decided_at, method, decided_via")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .order("decided_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonError(`verification_lookup: ${error.message}`, 500);
  }

  const email =
    typeof data?.requester_email === "string" && data.requester_email.trim()
      ? data.requester_email.trim().toLowerCase()
      : null;

  return jsonOk({
    verifiedByEmail: email,
    decidedAt: data?.decided_at ?? null,
    method: data?.method ?? null,
    decidedVia: data?.decided_via ?? null,
  });
});
