// Supabase Edge Function — business-web-remove-member
//
// Removes one team artefact from a place. The `kind` discriminates:
//
//   editor       → project_members row (cannot remove last owner)
//   waiter       → project_roles row
//   editorInvite → account_invites row (revoke pending email invite)
//   waiterInvite → staff_invites row (revoke pending waiter invite)
//
// Owners (and super-admins) can remove anyone. Editors and viewers
// cannot remove other members but may remove themselves (handy "leave
// place" affordance) — except the last owner, who is pinned.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import {
  adminClient,
  checkMembership,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { isLastOwnerOfPlace } from "../_shared/place-ownership.ts";
import { deleteTarget, loadTarget, type Kind } from "./member-target.ts";

const KINDS = ["editor", "waiter", "editorInvite", "waiterInvite"] as const;
type Body = { id?: string; kind?: Kind };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const id = (body.id ?? "").trim();
  const kind = body.kind;
  if (!id) return json({ ok: false, error: "id is required" }, 400);
  if (!kind || !(KINDS as readonly string[]).includes(kind)) {
    return json({ ok: false, error: "kind must be editor | waiter | editorInvite | waiterInvite" }, 400);
  }

  const admin = adminClient(envRes.env);
  const target = await loadTarget(admin, kind, id, authRes.user.id);
  if (!target.ok) return target.response;

  // Authorization: self-removal is fine regardless of role; otherwise
  // the caller must be an owner of the same place (or super-admin).
  if (!target.isSelfRemoval) {
    const m = await checkMembership(admin, authRes.user, target.projectId);
    if (!m.isSuperAdmin && m.role !== "owner") {
      return json({ ok: false, error: "Not allowed to remove this member." }, 403);
    }
  }

  if (kind === "editor" && target.targetIsOwner) {
    if (await isLastOwnerOfPlace(admin, target.projectId)) {
      return json(
        { ok: false, code: "last_owner", error: "Promote another owner first." },
        409,
      );
    }
  }

  const del = await deleteTarget(admin, kind, id);
  if (del?.error) {
    return json({ ok: false, error: `delete: ${del.error.message}` }, 500);
  }

  return json({ ok: true, id, kind });
});
