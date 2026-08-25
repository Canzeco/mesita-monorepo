// Supabase Edge Function — admin-web-set-place-verified
//
// Admin attestation of ownership proof. Verified is one-time, never lapses,
// grants nothing (no project_members write). Independent of Partner/plan.
//
// Body:     { placeId | projectId }
// Response: { ok: true, verified: true, alreadyVerified?: true }
// Auth:     super-admin only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { placeId?: unknown; projectId?: unknown };

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
  if (!projectId) return json({ ok: false, error: "Missing placeId" }, 400);

  const { data: place, error: placeErr } = await admin
    .from("places")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);
  if (!place) return json({ ok: false, error: "Place not found" }, 404);

  const { data: existing, error: existingErr } = await admin
    .from("project_verifications")
    .select("id")
    .eq("place_id", projectId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    return json({ ok: false, error: `verification_lookup: ${existingErr.message}` }, 500);
  }
  if (existing) {
    return json({ ok: true, verified: true, alreadyVerified: true });
  }

  const email = (authRes.user.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json(
      { ok: false, error: "Admin session has no email — cannot attest verification." },
      422,
    );
  }
  const now = new Date().toISOString();
  const { error: insertErr } = await admin.from("project_verifications").insert({
    place_id: projectId,
    requester_id: authRes.user.id,
    requester_email: email,
    method: "manual_contact",
    status: "approved",
    decided_at: now,
    decided_by: authRes.user.id,
    decided_via: "admin",
  });
  if (insertErr) {
    return json({ ok: false, error: `verification_insert: ${insertErr.message}` }, 500);
  }
  return json({ ok: true, verified: true, alreadyVerified: false });
});
