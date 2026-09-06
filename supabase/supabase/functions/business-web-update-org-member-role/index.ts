// Supabase Edge Function — business-web-update-org-member-role
//
// Promote / demote an organization member. Owners only (MESITA-1550).
//
// Unlike the place model, organizations allow SEVERAL owners
// (organization_members' own migration comment) — promoting someone to
// owner is a plain role update, no demotion of anyone else required (no
// transferPlaceOwnership equivalent needed). Demoting the sole owner is
// caught by the DB-side constraint trigger (organization_members_owner_
// backstop): the update is attempted directly and a raised
// hint=last_owner exception is translated to the same machine code
// place-level EFs use.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgRoleFor } from "../_shared/org-membership.ts";
import { isMemberRole, type MemberRole } from "../_shared/roles.ts";

type Body = { orgId?: string; memberId?: string; role?: MemberRole };

function isLastOwnerError(error: { code?: string; hint?: string } | null): boolean {
  return error?.hint === "last_owner";
}

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
  const memberId = (body.memberId ?? "").trim();
  const role = body.role;
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);
  if (!memberId) return json({ ok: false, error: "memberId is required" }, 400);
  if (!isMemberRole(role)) {
    return json({ ok: false, error: "role must be owner | editor | viewer" }, 400);
  }

  const admin = adminClient(envRes.env);

  const callerRole = await orgRoleFor(admin, authRes.user, orgId);
  if (callerRole !== "owner") {
    return json({ ok: false, error: "Only owners can change roles." }, 403);
  }

  const target = await admin
    .from("organization_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (target.error) {
    return json({ ok: false, error: `member_read: ${target.error.message}` }, 500);
  }
  if (!target.data) {
    return json({ ok: false, error: "Member not found." }, 404);
  }
  if (target.data.role === role) {
    return json({ ok: true, memberId, role: target.data.role });
  }

  const upd = await admin
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", orgId)
    .select("id, role")
    .single();
  if (upd.error) {
    if (isLastOwnerError(upd.error)) {
      return json(
        {
          ok: false,
          code: "last_owner",
          error: "The organization must keep at least one owner.",
        },
        409,
      );
    }
    return json({ ok: false, error: `member_update: ${upd.error.message}` }, 500);
  }

  return json({ ok: true, memberId: upd.data.id, role: upd.data.role });
});
