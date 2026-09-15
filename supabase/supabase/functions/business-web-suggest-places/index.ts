// Supabase Edge Function — business-web-suggest-places (product caller)
//
// The Add place bar on the business console. Same Name Deep Search engine as
// consumer Search and the admin Manage Single name bar: `runConsumerSearchLane`
// in mode `deep` — Autocomplete + Text Search + Lineup Name, merged, overlaps
// dropped.
//
// ── WHY IT IS NOT `suggestPlaces` ANY MORE (MESITA-1874) ──────────────────
//
// Pato, on the bar returning ONE result — a bar in Toledo, Ohio — for the
// query `strana`: *"use autocomplete and text search from google … basically
// the word search mode but without showing the locations results."*
//
// This facade ran `suggestPlaces()`: Google AUTOCOMPLETE plus a Mesita name
// ILIKE, and nothing else. Autocomplete matches a prefix inside a billing
// session, so a partial name with no locality attached returns whatever one
// establishment Google is most confident about — anywhere on earth. The two
// other name bars in this product have run the deep lane for months, and the
// operator adding their own restaurant is the person who can least afford the
// narrower engine.
//
// LOCATIONS STAY OFF, AND THEY ALREADY WERE. `ConsumerSearchArgs.locations`
// defaults false and `keepWantedKinds()` drops `kind === "location"` rows
// BEFORE the stamp, so a picker never pays a Details call for a city it would
// discard — only the consumer searchbar opts in (MESITA-1402). Pato's "without
// showing the locations results" is this lane's default, not a new flag.
//
// NOTHING ON THE ROW REGRESSES. `suggestPlaces` resolved the caller's user id
// to mark `verified_partner_self` vs `_other` on a prediction, and the lane
// takes no such argument. That fact is unused here: `AddPlaceRow` renders the
// state the CLIENT computes from its own per-row `business-web-find-place`
// lookup (`rowStateForLookup`), and never reads `prediction.state`. With the
// caller id went the only reason this facade resolved a user at all, so the
// JWT is no longer read — the lane is the same for every signed-in operator.
//
// `suggestPlaces()` itself stays: `consumer-mcp` is still a caller.
//
// JWT-protected by the platform; the function reads no identity of its own.
//
// Local:  supabase functions serve business-web-suggest-places
// Deploy: supabase functions deploy business-web-suggest-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { readEFEnv } from "../_shared/auth.ts";
import { runConsumerSearchLane } from "../_shared/consumer-search-lane.ts";

type Body = { input?: string; sessionToken?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // `mode: "deep"` is stated rather than left to `resolveMode`'s default:
  // the default is `fast` (Autocomplete alone), which is the engine this
  // issue exists to leave behind. `locations` is omitted on purpose — false
  // is the default and the behaviour Pato asked for.
  return await runConsumerSearchLane(env, "business-web-suggest-places", {
    input: body.input,
    sessionToken: body.sessionToken,
    mode: "deep",
  });
});
