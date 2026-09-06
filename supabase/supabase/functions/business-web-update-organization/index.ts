// Supabase Edge Function — business-web-update-organization
//
// Owner-only write of an organization's legal identity: legal name and RFC.
// These are deliberately NOT asked at creation (an organization with neither
// can still hold places) — they become required the day the organization
// partners a place or gets paid, and this endpoint is where they land.
//
// Auth: signed-in business account holding the owner role in the org.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";

type Body = {
  orgId?: string;
  legalName?: string | null;
  rfc?: string | null;
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
  const orgId = (body.orgId ?? "").trim();
  if (!orgId) return json({ ok: false, error: "orgId is required" }, 400);

  const legalName = typeof body.legalName === "string"
    ? body.legalName.trim() || null
    : null;
  if (legalName && legalName.length > 200) {
    return json({ ok: false, error: "legal name is too long" }, 400);
  }
  const rfc = typeof body.rfc === "string"
    ? body.rfc.trim().toUpperCase() || null
    : null;
  if (rfc && rfc.length > 20) {
    return json({ ok: false, error: "RFC is too long" }, 400);
  }

  const admin = adminClient(envRes.env);
  const roleRes = await requireOrgRole(admin, authRes.user, orgId, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const { data: org, error: updErr } = await admin
    .from("organizations")
    .update({ legal_name: legalName, rfc })
    .eq("id", orgId)
    .select("id, name, legal_name, rfc, currency")
    .single();
  if (updErr || !org) {
    return json({ ok: false, error: updErr?.message ?? "Update failed" }, 500);
  }

  return json({
    ok: true,
    organization: {
      id: org.id,
      name: org.name,
      legalName: org.legal_name,
      rfc: org.rfc,
      currency: org.currency,
    },
  });
});
