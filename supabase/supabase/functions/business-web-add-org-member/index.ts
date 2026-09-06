// Supabase Edge Function — business-web-add-org-member
//
// Owner-only. Two paths (MESITA-1550, mirroring business-web-invite-member):
//
//   1. Email matches an existing managers row → link directly: insert
//      organization_members at the requested role. No email goes out.
//
//   2. Email is unknown → create an organization_invites row with a fresh
//      token AND ask Supabase Auth to send the standard invite email
//      (auth.admin.inviteUserByEmail). The redirect URL embeds the token
//      so business-web-accept-org-invite can claim it once the new user
//      signs in.
//
// Owner is now an addable role: unlike the place model, organizations
// allow several owners (organization_members' own migration comment), and
// the ≥1-owner backstop (a DB constraint trigger, not a racy app-level
// count) means an owner grant here carries no ownership-transfer hazard —
// there is nothing to protect against by refusing it.
//
// Errors carry MACHINE CODES (`not_owner` · `already_member` ·
// `invite_pending`) so the console maps code→copy instead of string-matching.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgRoleFor } from "../_shared/org-membership.ts";
import { isEmailish } from "../_shared/input.ts";
import { isMemberRole, type MemberRole } from "../_shared/roles.ts";
import { newInviteToken } from "../_shared/tokens.ts";

type Body = { orgId?: string; email?: string; role?: MemberRole; redirectBase?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const orgId = (body.orgId ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role ?? "editor";
  const redirectBase = (body.redirectBase ?? "").trim().replace(/\/$/, "");
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);
  if (!isEmailish(email)) {
    return json({ ok: false, error: "A valid email is required" }, 400);
  }
  if (!isMemberRole(role)) {
    return json({ ok: false, error: "role must be owner | editor | viewer" }, 400);
  }

  const admin = adminClient(envRes.env);

  // Owner-only, with the same opaque shape for non-members and nonexistent
  // orgs — this check never reveals whether an organization id exists.
  const callerRole = await orgRoleFor(admin, authRes.user, orgId);
  if (callerRole !== "owner") {
    return json(
      { ok: false, error: "Only owners can add members", code: "not_owner" },
      403,
    );
  }

  // ilike + limit(1): emails are stored as typed at signup; the lookup is
  // case-insensitive and never throws on unexpected duplicates.
  const { data: found, error: findErr } = await admin
    .from("managers")
    .select("id, full_name, email")
    .ilike("email", email)
    .limit(1);
  if (findErr) {
    return json({ ok: false, error: `manager_read: ${findErr.message}` }, 500);
  }
  const manager =
    (found?.[0] as { id: string; full_name: string | null; email: string | null } | undefined) ??
      null;

  if (manager) {
    const { data: existingMember } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("manager_id", manager.id)
      .maybeSingle();
    if (existingMember) {
      return json(
        { ok: false, error: "Already a member", code: "already_member" },
        409,
      );
    }
    const { error: insErr } = await admin
      .from("organization_members")
      .insert({ organization_id: orgId, manager_id: manager.id, role });
    if (insErr) {
      if (insErr.code === "23505") {
        return json(
          { ok: false, error: "Already a member", code: "already_member" },
          409,
        );
      }
      return json({ ok: false, error: insErr.message }, 500);
    }
    return json({
      ok: true,
      mode: "linked",
      member: { managerId: manager.id, name: manager.full_name, email: manager.email, role },
    });
  }

  // Unknown email — send an invite (mirrors business-web-invite-member).
  const existingInvite = await admin
    .from("organization_invites")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existingInvite.data) {
    return json(
      { ok: false, code: "invite_pending", error: "An invite for that email is already pending." },
      409,
    );
  }

  const token = newInviteToken();
  const invite = await admin
    .from("organization_invites")
    .insert({ organization_id: orgId, email, role, token, created_by: authRes.user.id })
    .select("id, token, expires_at")
    .single();
  if (invite.error) {
    return json({ ok: false, error: `invite_insert: ${invite.error.message}` }, 500);
  }

  const redirectTo = redirectBase
    ? `${redirectBase}/accept-org-invite?token=${encodeURIComponent(token)}&organizationId=${encodeURIComponent(orgId)}`
    : undefined;
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
      data: { organizationId: orgId, role, orgInviteToken: token },
      redirectTo,
    });
    if (inviteRes.error) {
      // "User already registered" is fine: the organization_invites row is
      // still good and the recipient can use the link directly.
      emailError = inviteRes.error.message;
    } else {
      emailSent = true;
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : "invite_email_failed";
  }

  return json({
    ok: true,
    mode: "invited",
    inviteId: invite.data.id,
    token: invite.data.token,
    expiresAt: invite.data.expires_at,
    email,
    role,
    emailSent,
    emailError,
  });
});
