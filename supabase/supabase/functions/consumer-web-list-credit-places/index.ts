// Supabase Edge Function — consumer-web-list-credit-places
//
// Naming: caller-verb-words. Caller = consumer, verb = list, words =
// credit-places.
//
// The Buy Credits sheet's "Where" picker needs a real list — the mock ladder
// it shipped against (CREDIT_PLACES) is invented. Returns the places a guest
// could buy Mesita Credits at TODAY: credits_enabled ∧ payCredits ∧ the
// place's organization is Connect charge-ready — the exact chain
// resolveChargeableOrganizationForCredits computes per-place at charge time,
// computed here for a LIST instead of one placeId (MESITA-1676). Both read
// through the same table shape on purpose: a place that appears in this list
// and then 409s at Buy would be the unenforced-config bug in a new outfit.
//
// The catalog is empty as of 2026-09-06 (0 organizations hold a connected
// account yet), so this returns [] in every environment until an operator
// completes Connect onboarding for at least one organization — the correct
// empty state, not a bug.
//
// Body:     {}
// Response: { ok: true, places: [{ id, name, organizationId }] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { loadVisitsConfig } from "../_shared/visits-config.ts";
import { isConnectChargeReady } from "../_shared/payment-account-doc.ts";

// A page's worth. This is a picker list on a phone screen, not a directory —
// nothing today needs pagination, and the catalog is empty regardless.
const MAX_PLACES = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  const visitsConfig = await loadVisitsConfig(admin);
  if (!visitsConfig.payCredits) {
    return json({ ok: true, places: [] });
  }

  const acceptors = await admin
    .from("place_profiles")
    .select("id, name")
    .eq("credits_enabled", true)
    .order("name", { ascending: true })
    .limit(MAX_PLACES);
  if (acceptors.error) {
    return json(
      { ok: false, error: `credit_places_lookup: ${acceptors.error.message}` },
      500,
    );
  }
  const candidates = (acceptors.data ?? []) as { id: string; name: string }[];
  if (candidates.length === 0) return json({ ok: true, places: [] });

  const orgLookup = await admin
    .from("places")
    .select("id, organization_id")
    .in("id", candidates.map((c) => c.id));
  if (orgLookup.error) {
    return json(
      { ok: false, error: `credit_places_org: ${orgLookup.error.message}` },
      500,
    );
  }
  const orgByPlace = new Map<string, string>();
  for (
    const row of (orgLookup.data ?? []) as {
      id: string;
      organization_id: string | null;
    }[]
  ) {
    if (row.organization_id) orgByPlace.set(row.id, row.organization_id);
  }
  const organizationIds = [...new Set(orgByPlace.values())];
  if (organizationIds.length === 0) return json({ ok: true, places: [] });

  const accounts = await admin
    .from("organization_payment_accounts")
    .select("organization_id, stripe_account_id, charges_enabled, details_submitted")
    .in("organization_id", organizationIds);
  if (accounts.error) {
    return json(
      { ok: false, error: `credit_places_accounts: ${accounts.error.message}` },
      500,
    );
  }
  const readyOrgs = new Set(
    ((accounts.data ?? []) as {
      organization_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }[])
      .filter((row) => isConnectChargeReady(row))
      .map((row) => row.organization_id),
  );

  const places = candidates
    .map((c) => ({ id: c.id, name: c.name, organizationId: orgByPlace.get(c.id) ?? null }))
    .filter((p): p is { id: string; name: string; organizationId: string } =>
      p.organizationId !== null && readyOrgs.has(p.organizationId)
    );

  return json({ ok: true, places });
});
