// Supabase Edge Function — business-web-remove-org-member
//
// Removes one org-membership artefact (MESITA-1550). The `kind`
// discriminates, mirroring business-web-remove-member's member-target
// pattern:
//
//   member  → organization_members row
//   invite  → organization_invites row (revoke a pending email invite)
//
// Owners can remove anyone; a non-owner may only remove themselves ("leave
// organization"). Removing the last owner is NOT pre-checked here — the
// delete is attempted directly, and the DB-side constraint trigger
// (organization_members_owner_backstop) is the single source of truth. A
// raised exception with hint=last_owner is caught and translated to the
// same machine code place-level EFs use. This closes the TOCTOU race an
// application-level count-then-act check cannot: two concurrent removals of
// the two owners in a two-owner org can no longer both succeed.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgRoleFor } from "../_shared/org-membership.ts";

const KINDS = ["member", "invite"] as const;
type Kind = (typeof KINDS)[number];
type Body = { orgId?: string; id?: string; kind?: Kind };

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
  const id = (body.id ?? "").trim();
  const kind = body.kind;
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);
  if (!id) return json({ ok: false, error: "id is required" }, 400);
  if (!kind || !(KINDS as readonly string[]).includes(kind)) {
    return json({ ok: false, error: "kind must be member | invite" }, 400);
  }

  const admin = adminClient(envRes.env);
  const callerRole = await orgRoleFor(admin, authRes.user, orgId);

  if (kind === "invite") {
    if (callerRole !== "owner") {
      return json({ ok: false, error: "Only owners can revoke invites." }, 403);
    }
    const del = await admin
      .from("organization_invites")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);
    if (del.error) {
      return json({ ok: false, error: `invite_delete: ${del.error.message}` }, 500);
    }
    return json({ ok: true, id, kind });
  }

  // kind === "member"
  const target = await admin
    .from("organization_members")
    .select("id, manager_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (target.error) {
    return json({ ok: false, error: `member_read: ${target.error.message}` }, 500);
  }
  if (!target.data) {
    return json({ ok: false, error: "Member not found." }, 404);
  }
  const isSelfRemoval = target.data.manager_id === authRes.user.id;
  if (!isSelfRemoval && callerRole !== "owner") {
    return json({ ok: false, error: "Not allowed to remove this member." }, 403);
  }

  const del = await admin
    .from("organization_members")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (del.error) {
    if (isLastOwnerError(del.error)) {
      return json(
        {
          ok: false,
          code: "last_owner",
          error: "The organization must keep at least one owner.",
        },
        409,
      );
    }
    return json({ ok: false, error: `member_delete: ${del.error.message}` }, 500);
  }

  return json({ ok: true, id, kind });
});
