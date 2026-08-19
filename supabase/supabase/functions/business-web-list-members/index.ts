// Supabase Edge Function — business-web-list-members
//
// Returns the active team of a place in one round trip:
//   - members : project_members joined to managers (email-pool roles;
//     response key is `members`)
//   - pendingBusinessInvites
//   - myRole : caller's role on this place (or "super_admin"), so the
//     UI doesn't have to derive owner-ness from the member list and
//     gets the right answer for super-admins who skipped project_members
//
// The team is the BUSINESS team only. Waiters were retired (MESITA-833):
// staff handle tickets on the public check page, where possession of the
// check_code is the authentication — there is no waiter account to list.
//
// Auth: any signed-in member of the place. Super-admins
// (public.super_admins) bypass the membership check.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";

type Body = { placeId?: string; projectId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  const nowIso = new Date().toISOString();

  // Two independent reads in parallel — no further fan-out.
  const [memberRows, pendingBusinessRows] = await Promise.all([
    admin
      .from("project_members")
      // manager_id → managers (the business-account table; no compat view).
      // Result stays aliased `business`.
      .select("id, role, created_at, business:managers(id, full_name, email)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    admin
      .from("project_invites")
      .select("id, email, role, token, created_at, expires_at")
      .eq("project_id", projectId)
      .is("claimed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
  ]);

  for (const r of [memberRows, pendingBusinessRows]) {
    if (r.error) {
      return json({ ok: false, error: `read: ${r.error.message}` }, 500);
    }
  }

  type BusinessJoin = {
    id: string;
    role: string;
    created_at: string;
    business: { id: string; full_name: string | null; email: string | null } | null;
  };
  const members = ((memberRows.data ?? []) as unknown as BusinessJoin[])
    .filter((r) => r.business != null)
    .map((r) => ({
      memberId: r.id,
      userId: r.business!.id,
      role: r.role,
      fullName: r.business!.full_name,
      email: r.business!.email,
      createdAt: r.created_at,
    }));

  const pendingBusinessInvites = (pendingBusinessRows.data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    token: r.token,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));

  // `myRole` lets the client gate UI without re-deriving from the
  // member list (super-admins aren't always in project_members).
  const myRole = memberRes.membership.isSuperAdmin
    ? "super_admin"
    : memberRes.membership.role;

  return json({
    ok: true,
    myRole,
    members,
    pendingBusinessInvites,
  });
});
