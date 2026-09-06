// Supabase Edge Function — business-web-accept-org-invite
//
// Called by a logged-in business to claim an organization invite. Mirrors
// business-web-accept-invite field-for-field (MESITA-1550) — kept as its
// own EF rather than merged into the place accept EF: the two invite
// tables key off different foreign keys (organization_id vs place_id) and
// the validation logic here is small enough that branching one endpoint on
// invite-kind would add complexity for no reuse (two call-sites doesn't
// clear the DRY bar).
//
//   1. Validate the invite token (exists, unexpired, unclaimed, addressed
//      to the caller's email).
//   2. Ensure a `managers` profile exists for the caller.
//   3. Upsert organization_members at the stored role (idempotent, so a
//      double-click is harmless).
//   4. Mark the invite claimed.
//   5. Stamp app_metadata.role = 'business' so future JWTs carry it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

type Body = { token?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const user = authRes.user;

  const body = await readJsonOr<Body>(req, {});
  const token = (body.token ?? "").toString().trim();
  if (!token) return json({ ok: false, error: "Missing invite token" }, 400);

  const admin = adminClient(envRes.env);

  const invite = await admin
    .from("organization_invites")
    .select("id, organization_id, email, role, claimed_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (invite.error) {
    return json({ ok: false, error: `invite_read: ${invite.error.message}` }, 500);
  }
  if (!invite.data) {
    return json({ ok: false, error: "Invite not found or already revoked." }, 404);
  }
  if (invite.data.claimed_at) {
    return json({ ok: false, error: "This invite was already claimed." }, 409);
  }
  if (new Date(invite.data.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "This invite has expired." }, 410);
  }
  if (user.emailLower && invite.data.email.toLowerCase() !== user.emailLower) {
    return json(
      { ok: false, error: "This invite was sent to a different email address." },
      403,
    );
  }

  const { data: existingBusiness } = await admin
    .from("managers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!existingBusiness) {
    const ins = await admin.from("managers").insert({
      id: user.id,
      email: user.emailLower,
      full_name: (user.raw?.user_metadata?.full_name as string | null) ?? null,
    });
    if (ins.error) {
      return json({ ok: false, error: `business_profile: ${ins.error.message}` }, 500);
    }
  }

  const upsert = await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: invite.data.organization_id,
        manager_id: user.id,
        role: invite.data.role,
      },
      { onConflict: "organization_id,manager_id", ignoreDuplicates: false },
    )
    .select("id, role")
    .single();
  if (upsert.error) {
    return json({ ok: false, error: `member_upsert: ${upsert.error.message}` }, 500);
  }

  const claim = await admin
    .from("organization_invites")
    .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
    .eq("id", invite.data.id)
    .is("claimed_at", null);
  if (claim.error) {
    return json({ ok: false, error: `invite_claim: ${claim.error.message}` }, 500);
  }

  if (user.appRole !== "business" && user.appRole !== "admin") {
    const stamp = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.raw?.app_metadata ?? {}), role: "business" },
    });
    if (stamp.error) {
      return json({ ok: false, error: `role_stamp: ${stamp.error.message}` }, 500);
    }
  }

  return json({
    ok: true,
    organizationId: invite.data.organization_id,
    role: upsert.data.role,
  });
});
