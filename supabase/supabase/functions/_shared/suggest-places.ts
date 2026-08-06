// Shared suggest-places engine (Google + Mesita merge).
//
// Formerly the enricher suggest-places internal EF. It was only
// ever invoked by the three thin suggest facades (consumer-web-,
// business-web-, admin-web-suggest-places), so per the caller-nomenclature
// grammar (one endpoint = one caller) the HTTP hop didn't earn its cost on
// this latency-sensitive autocomplete path — the merge now runs in-process
// inside each facade (MESITA-55, mirroring the recommender absorb in
// MESITA-54). The old `enricher-suggest-places` cloud slug and the old-name
// facades (admin-/business-/consumer-suggest-places) were deleted from cloud
// on 2026-07-05 (MESITA-59 suggest cleanup); only the *-web- facades remain.
//
// Proxies Google Places (New) Autocomplete + a Mesita-side name ILIKE
// fallback in parallel, merges the two, and returns predictions tagged
// with per-row status (`not_in_mesita`, `web_listed`,
// `verified_partner_other`, `verified_partner_self`) so the UI can render
// the right badge. On-Mesita rows (any status other than `not_in_mesita`)
// additionally carry `mesitaId` + `mesitaSlug` (projects_view id + slug)
// so clients can navigate straight to the place row instead of
// re-matching predictions by name; Google-only predictions omit both.
//
// NOTE on `placeId`: in this response shape it is the GOOGLE Place ID
// (addendum 9 of MESITA-51 — the place-row UUID semantic lives in
// `mesitaId` here, so the two never collide in one key).
//
// The Google key never leaves Supabase — the facades resolve the caller's
// user id from the JWT and this module owns the rest.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { adminClient, type EFEnv } from "./auth.ts";
import {
  classifyGoogleError,
  escapeIlike,
  fetchPlaceSignals,
  friendlyGoogleError,
  GOOGLE_PLACES_AUTOCOMPLETE_URL,
  readGooglePlacesKey,
} from "./google-places.ts";
import {
  type ChannelKey,
  type ChannelPolicy,
  evaluatePlaceForChannel,
  readChannelPolicy,
} from "./sourcing.ts";
import {
  type GoogleTypeFilter,
  googleTypeFilterForPolicy,
  mergePredictionsByPlaceId,
  type Prediction,
  sortMesitaPredictionsFirst,
} from "./suggest-places-helpers.ts";
import { statusesForPlaces } from "./suggest-place-status.ts";
import { displayName } from "./place-display-name.ts";

export type SuggestPlacesArgs = {
  input?: string;
  sessionToken?: string;
  // Caller user id resolved from the end-user JWT by the facade. When
  // null, we can't flag verified_partner_self — only _other for any
  // owned row.
  callerUserId?: string | null;
  // When set, Google-only ("not_in_mesita") predictions are filtered against
  // app_settings.sourcing_config[sourcingChannel]. On-Mesita rows always
  // pass — they're already onboarded.
  sourcingChannel?: ChannelKey;
};

// Runs the merge and returns the full HTTP response for the facade to
// send verbatim. `callerName` is echoed in the success envelope exactly
// like the old internal caller did, so the client-visible shape is
// unchanged.
export async function suggestPlaces(
  env: EFEnv,
  callerName: string,
  args: SuggestPlacesArgs,
): Promise<Response> {
  const keyRes = readGooglePlacesKey();
  if (!keyRes.ok) return keyRes.response;
  const apiKey = keyRes.key;

  const input = (args.input ?? "").toString().trim();
  const sessionToken = (args.sessionToken ?? "").toString();
  const callerUserId = args.callerUserId ?? null;

  if (input.length < 2) return json({ ok: true, predictions: [] });
  if (!sessionToken) return json({ ok: false, error: "Missing sessionToken" });

  const admin = adminClient(env);

  const sourcingPolicy = args.sourcingChannel
    ? await readChannelPolicy(admin, args.sourcingChannel)
    : null;
  // Sourced search: do NOT pre-filter Google Autocomplete by broad
  // primary types. Google matches includedPrimaryTypes exactly
  // (`bar` ≠ `night_club`, `cafe` ≠ `cake_shop`), and the API caps the
  // list at 5 — so a one-type-per-family map silently drops eligible
  // places before the rating/review post-filter can run. Family + floors
  // are enforced after merge via filterPredictionsBySourcing.
  // Skip the Google leg only when the channel is off or has no families.
  const googleTypeFilter = googleTypeFilterForPolicy(sourcingPolicy);

  // Fire Google + Mesita searches in parallel. Either can fail
  // independently; we merge whatever comes back.
  const [googleResult, mesitaResult] = await Promise.allSettled([
    fetchGooglePredictions(input, sessionToken, apiKey, googleTypeFilter),
    fetchMesitaPredictions(admin, input, callerUserId),
  ]);

  if (
    googleResult.status === "rejected" && mesitaResult.status === "rejected"
  ) {
    return json({
      ok: false,
      code: "network_error",
      error: googleResult.reason instanceof Error
        ? googleResult.reason.message
        : "Search failed.",
    });
  }
  if (googleResult.status === "fulfilled" && googleResult.value.errorEnvelope) {
    return json(googleResult.value.errorEnvelope);
  }

  const googlePreds = googleResult.status === "fulfilled"
    ? googleResult.value.predictions
    : [];
  const mesitaPreds = mesitaResult.status === "fulfilled"
    ? mesitaResult.value
    : [];

  // Merge: Mesita-side hits take precedence (status wins for matching
  // placeId), then any remaining Google entries follow. Google's
  // structured text is nicer, so we keep its mainText/secondaryText but
  // graft Mesita's status (+ mesitaId/mesitaSlug) on top when the
  // placeId is in both sources.
  const byPlaceId = mergePredictionsByPlaceId(googlePreds, mesitaPreds);

  // Backfill status for predictions Google returned but the ILIKE
  // fallback missed (e.g., "Strana San Pedro" vs the place named just
  // "Strana"). Keys off placeId directly so the substring miss doesn't
  // matter.
  const orphanPlaceIds = Array.from(byPlaceId.values())
    .filter((p) => p.status === "not_in_mesita")
    .map((p) => p.placeId);
  if (orphanPlaceIds.length > 0) {
    const mesitaByPlaceId = await enrichByPlaceIds(
      admin,
      orphanPlaceIds,
      callerUserId,
    );
    for (const [placeId, mesita] of mesitaByPlaceId) {
      const existing = byPlaceId.get(placeId);
      if (!existing) continue;
      byPlaceId.set(placeId, { ...existing, ...mesita });
    }
  }

  const predictions = sortMesitaPredictionsFirst(
    Array.from(byPlaceId.values()),
  );

  const filtered = sourcingPolicy
    ? await filterPredictionsBySourcing(predictions, sourcingPolicy, apiKey)
    : predictions;

  return json({ ok: true, predictions: filtered, caller: callerName });
}

// ── Google ────────────────────────────────────────────────────────────

async function fetchGooglePredictions(
  input: string,
  sessionToken: string,
  apiKey: string,
  typeFilter: GoogleTypeFilter,
): Promise<{
  predictions: Prediction[];
  errorEnvelope?: Record<string, unknown>;
}> {
  if (typeFilter === "skip") {
    return { predictions: [] };
  }

  const body: Record<string, unknown> = { input, sessionToken };
  if (typeFilter === "legacy") {
    // Legacy path (no sourcing channel): broad static hospitality filter.
    body.includedPrimaryTypes = [
      "restaurant",
      "bar",
      "cafe",
      "night_club",
      "bakery",
    ];
  }
  // "open": omit includedPrimaryTypes so night_club / cake_shop / bakery /
  // museum / etc. can surface; filterPredictionsBySourcing drops the rest.

  const r = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    const code = classifyGoogleError(r.status, text);
    return {
      predictions: [],
      errorEnvelope: {
        ok: false,
        code,
        error: friendlyGoogleError(code, r.status, text),
        httpStatus: r.status,
      },
    };
  }

  const data = (await r.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
      };
    }>;
  };

  const predictions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map<Prediction>((p) => ({
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      status: "not_in_mesita",
    }))
    .filter((p) => p.placeId && p.mainText);
  return { predictions };
}

// ── Mesita-side fallback ──────────────────────────────────────────────

async function fetchMesitaPredictions(
  admin: SupabaseClient,
  input: string,
  callerId: string | null,
): Promise<Prediction[]> {
  // ILIKE prefix-and-contains so "strana" finds both "Strana" and "Casa
  // Strana, Monterrey". Match Mesita name OR google_name (MESITA-917);
  // one row per place id. Limit small — Google is the primary surface; this
  // is a fallback for the long-tail case where Google misses.
  // Quote the pattern like admin-web-search-places — unquoted `%…%` breaks
  // the PostgREST or() grammar.
  const pattern = `%${escapeIlike(input)}%`;
  const { data, error } = await admin
    .from("projects_view")
    .select("id, slug, google_place_id, name, google_name, address")
    .or(`name.ilike."${pattern}",google_name.ilike."${pattern}"`)
    .not("google_place_id", "is", null)
    .limit(8);
  if (error) {
    console.error("[suggest-places] mesita search:", error.message);
    return [];
  }
  type Row = {
    id: string;
    slug: string;
    google_place_id: string;
    name: string | null;
    google_name: string | null;
    address: string | null;
  };
  let rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // Prefer Mesita-name hits ahead of google-only matches.
  const qLower = input.toLowerCase();
  rows = [...rows].sort((a, b) => {
    const aMesita = (a.name ?? "").toLowerCase().includes(qLower);
    const bMesita = (b.name ?? "").toLowerCase().includes(qLower);
    if (aMesita !== bMesita) return aMesita ? -1 : 1;
    return 0;
  });

  const statuses = await statusesForPlaces(admin, rows, callerId);
  return rows.map<Prediction>((v) => ({
    placeId: v.google_place_id,
    mainText: displayName(v),
    secondaryText: v.address ?? "Already on Mesita",
    status: statuses.get(v.google_place_id) ?? "web_listed",
    mesitaId: v.id,
    mesitaSlug: v.slug,
  }));
}

async function enrichByPlaceIds(
  admin: SupabaseClient,
  placeIds: string[],
  callerId: string | null,
): Promise<
  Map<string, Pick<Prediction, "status" | "mesitaId" | "mesitaSlug">>
> {
  const { data, error } = await admin
    .from("projects_view")
    .select("id, slug, google_place_id")
    .in("google_place_id", placeIds);
  if (error) {
    console.error("[suggest-places] placeId enrichment:", error.message);
    return new Map();
  }
  type Row = { id: string; slug: string; google_place_id: string };
  const rows = (data ?? []) as Row[];
  const statuses = await statusesForPlaces(admin, rows, callerId);
  const out = new Map<
    string,
    Pick<Prediction, "status" | "mesitaId" | "mesitaSlug">
  >();
  for (const r of rows) {
    out.set(r.google_place_id, {
      status: statuses.get(r.google_place_id) ?? "web_listed",
      mesitaId: r.id,
      mesitaSlug: r.slug,
    });
  }
  return out;
}

// Apply the sourcing channel policy to Google-only predictions. On-Mesita
// rows always pass — they're already onboarded. For not_in_mesita rows,
// batch-fetch primaryType + rating + reviewCount (Autocomplete omits them)
// and drop any that fail evaluatePlaceForChannel.
async function filterPredictionsBySourcing(
  predictions: Prediction[],
  policy: ChannelPolicy,
  apiKey: string,
): Promise<Prediction[]> {
  const googleOnly = predictions.filter((p) => p.status === "not_in_mesita");
  if (googleOnly.length === 0) return predictions;

  const signalsByPlaceId = new Map<
    string,
    {
      primaryType: string | null;
      rating: number | null;
      reviewCount: number | null;
    }
  >();
  await Promise.all(
    googleOnly.map(async (p) => {
      const sig = await fetchPlaceSignals(p.placeId, apiKey);
      if (sig) signalsByPlaceId.set(p.placeId, sig);
    }),
  );

  return predictions.filter((p) => {
    if (p.status !== "not_in_mesita") return true;
    const sig = signalsByPlaceId.get(p.placeId);
    if (!sig) return false;
    return evaluatePlaceForChannel(policy, sig).eligible;
  });
}
