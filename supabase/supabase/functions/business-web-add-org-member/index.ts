// Supabase Edge Function — business-web-add-org-member
//
// Owner-only direct add of an EXISTING business account to the organization.
// Deliberately minimal (the plan's N=1 slice): no invites table, no tokens,
// no email sends — an unknown address answers `unknown_manager` and the
// console tells the owner to have the person sign in first. The full invite
// lifecycle (with `expires_at`, per project_invites law) is a filed follow-up.
//
// Roles: editor | viewer ONLY. Owner grants are a distinct ceremony that
// lands together with remove/role-change and the ≥1-owner backstop — the
// same posture as the place-level invite_owner_forbidden rule: an owner
// grant with no in-product revocation is not a form field.
//
// Errors carry MACHINE CODES (`not_owner` · `unknown_manager` ·
// `already_member`) so the console maps code→copy instead of string-matching.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgRoleFor } from "../_shared/org-membership.ts";
import { isEmailish } from "../_shared/input.ts";

type Body = { orgId?: string; email?: string; role?: string };

const ADDABLE_ROLES = ["editor", "viewer"] as const;
type AddableRole = typeof ADDABLE_ROLES[number];

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
  const role = (body.role ?? "editor") as AddableRole;
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);
  if (!isEmailish(email)) {
    return json({ ok: false, error: "A valid email is required" }, 400);
  }
  if (!ADDABLE_ROLES.includes(role)) {
    return json({ ok: false, error: "role must be editor | viewer" }, 400);
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
  if (!manager) {
    return json(
      {
        ok: false,
        error: "No business account with that email",
        code: "unknown_manager",
      },
      404,
    );
  }

  const { error: insErr } = await admin
    .from("organization_members")
    .insert({ organization_id: orgId, manager_id: manager.id, role });
  if (insErr) {
    // unique (organization_id, manager_id) — the duplicate answers a code,
    // and the race between check-then-insert never existed to begin with.
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
    member: {
      managerId: manager.id,
      name: manager.full_name,
      email: manager.email,
      role,
    },
  });
});
