// Supabase Edge Function — business-web-list-org-members
//
// Who is in the organization, with what role. Any member may read the list
// (viewers included — seeing your own team is not a privilege); writes stay
// on business-web-add-org-member (owner-only).
//
// Also returns pendingInvites (MESITA-1550) — unclaimed, unexpired
// organization_invites rows, mirroring business-web-list-members'
// pendingBusinessInvites. Readable by any member for the same reason the
// member list is: seeing who's been invited isn't a privilege, only
// revoking is (business-web-remove-org-member, owner-only).
//
// A foreign or nonexistent org id answers the same opaque 403 as every org
// surface — membership checks never become an existence oracle.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";

type Body = { orgId?: string };

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
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);

  const admin = adminClient(envRes.env);
  const roleRes = await requireOrgRole(admin, authRes.user, orgId, [
    "owner",
    "editor",
    "viewer",
  ]);
  if (!roleRes.ok) return roleRes.response;

  const { data, error } = await admin
    .from("organization_members")
    .select("role, created_at, managers!inner(id, full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    role: string;
    managers: { id: string; full_name: string | null; email: string | null };
  };
  const members = ((data ?? []) as unknown as Row[]).map((r) => ({
    managerId: r.managers.id,
    name: r.managers.full_name,
    email: r.managers.email,
    role: r.role,
  }));

  const invitesRes = await admin
    .from("organization_invites")
    .select("id, email, role, created_at, expires_at")
    .eq("organization_id", orgId)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (invitesRes.error) {
    return json({ ok: false, error: invitesRes.error.message }, 500);
  }

  return json({
    ok: true,
    members,
    pendingInvites: invitesRes.data ?? [],
    myRole: roleRes.role,
  });
});
