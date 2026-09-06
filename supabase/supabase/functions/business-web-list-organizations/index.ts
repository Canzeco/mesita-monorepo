// Supabase Edge Function — business-web-list-organizations
//
// The organizations the caller belongs to, with a place count each. One
// account may be in many organizations (organization_members is M:N), so
// the console needs this to render its switcher.
//
// Auth: any signed-in account. The list is scoped to the caller's own
// memberships, so there is nothing to gate beyond a session.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  // Deterministic order matters: the console's default org is list[0]
  // (resolveActiveOrg fallback), and the day someone else can add you to an
  // organization, Postgres row order would otherwise silently decide which
  // org your home screen — and its Stripe connect button — points at.
  const { data: rows, error } = await admin
    .from("organization_members")
    .select("role, organizations!inner(id, name, legal_name, rfc, currency)")
    .eq("manager_id", authRes.user.id)
    .order("created_at", { ascending: true });
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    role: string;
    organizations: {
      id: string;
      name: string;
      legal_name: string | null;
      rfc: string | null;
      currency: string;
    };
  };
  const list = (rows ?? []) as unknown as Row[];
  const ids = list.map((r) => r.organizations.id);

  // Place counts in one round trip, then tallied in memory — cheaper than
  // a count per organization.
  let counts = new Map<string, number>();
  if (ids.length) {
    const { data: places } = await admin
      .from("projects")
      .select("organization_id")
      .in("organization_id", ids);
    counts = ((places ?? []) as { organization_id: string }[]).reduce(
      (m, p) => m.set(p.organization_id, (m.get(p.organization_id) ?? 0) + 1),
      new Map<string, number>(),
    );
  }

  return json({
    ok: true,
    organizations: list.map((r) => ({
      id: r.organizations.id,
      name: r.organizations.name,
      legalName: r.organizations.legal_name,
      rfc: r.organizations.rfc,
      currency: r.organizations.currency,
      myRole: r.role,
      placeCount: counts.get(r.organizations.id) ?? 0,
    })),
  });
});
