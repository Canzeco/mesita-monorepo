// Supabase Edge Function — consumer-web-list-credit-places
//
// Naming: caller-verb-words. Caller = consumer, verb = list, words =
// credit-places.
//
// The Buy Credits sheet's "Where" picker needs a real list — the mock ladder
// it shipped against (CREDIT_PLACES) is invented. Returns the places a guest
// could buy Mesita Credits at TODAY: credits_enabled ∧ payCredits ∧ the
// place's own Connect account is charge-ready — the exact chain
// resolveChargeablePlaceForCredits computes for one placeId at charge time,
// computed here for a LIST instead (MESITA-1676). Both read through the same
// table shape on purpose: a place that appears in this list and then 409s at
// Buy would be the unenforced-config bug in a new outfit.
//
// THE PICKER AND THE LOT NAME THE SAME THING NOW. Until MESITA-1892 this had
// to hop place → organization → account and hand the client an
// `organizationId` alongside each place, because the lot the purchase would
// write was the ORGANIZATION's. The place is the sole tenant boundary now:
// the account hangs off the place, the lot hangs off the place, and a row
// here is just `{ id, name }`.
//
// The catalog is empty as of 2026-09-06 (no place holds a connected account
// yet), so this returns [] in every environment until an operator completes
// Connect onboarding for at least one place — the correct empty state, not a
// bug.
//
// Body:     {}
// Response: { ok: true, places: [{ id, name }] }

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

  const accounts = await admin
    .from("place_payment_accounts")
    .select("place_id, stripe_account_id, charges_enabled, details_submitted")
    .in("place_id", candidates.map((c) => c.id));
  if (accounts.error) {
    return json(
      { ok: false, error: `credit_places_accounts: ${accounts.error.message}` },
      500,
    );
  }
  const readyPlaces = new Set(
    ((accounts.data ?? []) as {
      place_id: string;
      charges_enabled: boolean;
      details_submitted: boolean;
    }[])
      .filter((row) => isConnectChargeReady(row))
      .map((row) => row.place_id),
  );

  const places = candidates
    .filter((c) => readyPlaces.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  return json({ ok: true, places });
});
