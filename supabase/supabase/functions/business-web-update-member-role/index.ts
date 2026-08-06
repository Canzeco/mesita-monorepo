// Supabase Edge Function — business-web-update-member-role
//
// Promote / demote a place member. Owners only.
//
// Exactly one owner per place (MESITA-919):
//   • role → owner  = transfer ownership (previous owner becomes editor)
//   • demoting the sole owner without a transfer → 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireOwner,
} from "../_shared/auth.ts";
import { isMemberRole, type MemberRole } from "../_shared/roles.ts";
import {
  isLastOwnerOfPlace,
  transferPlaceOwnership,
} from "../_shared/place-ownership.ts";

type Body = {
  memberId?: string;
  role?: MemberRole;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const memberId = (body.memberId ?? "").trim();
  const role = body.role;
  if (!memberId) return json({ ok: false, error: "memberId is required" }, 400);
  if (!isMemberRole(role)) {
    return json({ ok: false, error: "role must be owner | editor | viewer" }, 400);
  }

  const admin = adminClient(envRes.env);

  const target = await admin
    .from("project_members")
    .select("id, project_id, business_id, role")
    .eq("id", memberId)
    .maybeSingle();
  if (target.error) {
    return json({ ok: false, error: `member_read: ${target.error.message}` }, 500);
  }
  if (!target.data) {
    return json({ ok: false, error: "Member not found." }, 404);
  }

  const owner = await requireOwner(
    admin,
    authRes.user,
    target.data.project_id,
    "Only owners can change roles.",
  );
  if (!owner.ok) return owner.response;

  if (target.data.role === role) {
    return json({ ok: true, memberId: target.data.id, role: target.data.role });
  }

  // Transfer ownership — demote any other owners, then promote this member.
  if (role === "owner") {
    const xfer = await transferPlaceOwnership(
      admin,
      target.data.project_id,
      memberId,
    );
    if (!xfer.ok) {
      return json({ ok: false, error: xfer.error }, 500);
    }
    return json({ ok: true, memberId, role: "owner", transferred: true });
  }

  // Demoting the sole owner leaves the place without an owner — blocked.
  if (target.data.role === "owner") {
    if (await isLastOwnerOfPlace(admin, target.data.project_id)) {
      return json(
        {
          ok: false,
          code: "last_owner",
          error: "Transfer ownership to another member first.",
        },
        409,
      );
    }
  }

  const upd = await admin
    .from("project_members")
    .update({ role })
    .eq("id", memberId)
    .select("id, role")
    .single();
  if (upd.error) {
    return json({ ok: false, error: `member_update: ${upd.error.message}` }, 500);
  }

  return json({ ok: true, memberId: upd.data.id, role: upd.data.role });
});
