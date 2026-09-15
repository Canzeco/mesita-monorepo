// Supabase Edge Function — business-web-create-organization
//
// Creates an organization and makes the caller its owner, in that order.
// An account may hold several organizations; there is no uniqueness on
// name because two real businesses can share one.
//
// THE RFC IS THE EXCEPTION (MESITA-1880). One organization = one RFC = one
// merchant, and this endpoint used to write `body.rfc ?? null` raw — no trim,
// no uppercase, no shape, no twin check. A duplicate meant two permanent
// Stripe connected accounts for one legal person and a guest's credits split
// across two balances Stripe cannot merge. The guarantee is the partial
// unique index; this is the sentence the owner reads instead of a 23505.
//
// Auth: a signed-in account carrying the business role. Deliberately NOT
// bare-authed: organizations are the thing places get claimed into, so
// letting any session mint one hands the claim path to every visitor.
// That test lives in session-gate.ts, and it reads the ROLE — the managers
// row it used to read was never a role, and refusing on a missing one
// stranded every session that outlived a database reset (MESITA-1623).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { mayCreateOrganization } from "./session-gate.ts";
import {
  isDuplicateRfcError,
  readRfc,
  RFC_SHAPE_ERROR,
  RFC_TAKEN_ERROR,
} from "../_shared/org-rfc.ts";

type Body = {
  name?: string;
  legalName?: string | null;
  rfc?: string | null;
  currency?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  if (!mayCreateOrganization(authRes.user)) {
    return json(
      { ok: false, error: "This account can't create organizations" },
      403,
    );
  }

  const body = await readJsonOr<Body>(req, {});
  const name = (body.name ?? "").trim();
  if (!name) return json({ ok: false, error: "name is required" }, 400);
  if (name.length > 120) {
    return json({ ok: false, error: "name is too long" }, 400);
  }

  // Normalized and shape-checked BEFORE the manager upsert below, so a
  // malformed RFC costs nothing and the 400 names the real problem.
  const rfcRead = readRfc(body.rfc);
  if (!rfcRead.ok) {
    return json({ ok: false, code: "rfc_shape", error: RFC_SHAPE_ERROR }, 400);
  }

  const admin = adminClient(envRes.env);

  // The manager row is the Account, and the FK target of the membership
  // insert below. ENSURE it, never refuse on it: the row is lazy-created at
  // sign-in (business-web-signin-email) and nowhere else, so a caller who
  // cleared the gate above and still has no row is a reset artifact, not an
  // intruder. Same upsert business-web-create-place does for the same reason.
  const { error: managerErr } = await admin
    .from("managers")
    .upsert(
      { id: authRes.user.id, email: authRes.user.email },
      { onConflict: "id" },
    );
  if (managerErr) {
    return json({ ok: false, error: `manager_upsert: ${managerErr.message}` }, 500);
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name,
      legal_name: body.legalName ?? null,
      rfc: rfcRead.rfc,
      currency: (body.currency ?? "MXN").toUpperCase(),
    })
    .select("id, name, legal_name, rfc, currency")
    .single();
  if (orgErr || !org) {
    if (isDuplicateRfcError(orgErr)) {
      return json({ ok: false, code: "rfc_taken", error: RFC_TAKEN_ERROR }, 409);
    }
    return json({ ok: false, error: orgErr?.message ?? "Create failed" }, 500);
  }

  const { error: memberErr } = await admin
    .from("organization_members")
    .insert({
      organization_id: org.id,
      manager_id: authRes.user.id,
      role: "owner",
    });
  if (memberErr) {
    // Never leave an organization nobody belongs to: it would be
    // invisible in every list and unclaimable-from forever.
    await admin.from("organizations").delete().eq("id", org.id);
    return json({ ok: false, error: memberErr.message }, 500);
  }

  return json({ ok: true, organization: { ...org, myRole: "owner", placeCount: 0 } });
});
