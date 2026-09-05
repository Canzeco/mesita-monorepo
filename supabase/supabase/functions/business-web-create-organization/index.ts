// Supabase Edge Function — business-web-create-organization
//
// Creates an organization and makes the caller its owner, in that order.
// An account may hold several organizations; there is no uniqueness on
// name because two real businesses can share one.
//
// Auth: a signed-in account carrying the business role. Deliberately NOT
// bare-authed: organizations are the thing places get claimed into, so
// letting any session mint one hands the claim path to every visitor.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

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

  const body = await readJsonOr<Body>(req, {});
  const name = (body.name ?? "").trim();
  if (!name) return json({ ok: false, error: "name is required" }, 400);
  if (name.length > 120) {
    return json({ ok: false, error: "name is too long" }, 400);
  }

  const admin = adminClient(envRes.env);

  // The manager row is the Account. It is lazy-created at sign-in
  // (business-web-signin-email); without it the FK below fails, and a
  // clearer error here beats a raw constraint violation.
  const { data: manager } = await admin
    .from("managers")
    .select("id")
    .eq("id", authRes.user.id)
    .maybeSingle();
  if (!manager) {
    return json({ ok: false, error: "No business account for this session" }, 403);
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name,
      legal_name: body.legalName ?? null,
      rfc: body.rfc ?? null,
      currency: (body.currency ?? "MXN").toUpperCase(),
    })
    .select("id, name, legal_name, rfc, currency")
    .single();
  if (orgErr || !org) {
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
