// Supabase Edge Function — consumer-web-create-place (LIVE consumer create path)
//
// The signed-in consumer opens a Google-only result's full profile and
// passes its `googlePlaceId`. This is GET-OR-CREATE (MESITA-2298): a
// google_place_id Mesita already holds answers 200 with that row and
// `created: false`, before the quota and before any Google spend; a new one
// runs the shared core and answers 201 with `created: true`:
//   1. authenticate the consumer,
//   2. look the id up; an existing row opens at once,
//   3. createMinimalPlace (_shared/create-place.ts): dedupe → Google spine →
//      save ready + enriched_at null. Does NOT seed Enricher. Guests vote
//      on the Enrich tab; the Crenup threshold queues Enricher 1–8.
//   A create that loses the unique-index race answers like step 2.
// Nothing here runs on a render, a prefetch or a pin tap: the client calls
// it only from the explicit open.
//
// Local:  supabase functions serve consumer-web-create-place
// Deploy: supabase functions deploy consumer-web-create-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  createMinimalPlace,
  existingFromDuplicate,
  openedExistingPlace,
} from "../_shared/create-place.ts";
import { consumeConsumerCreateQuota } from "../_shared/create-quota.ts";

type Body = { googlePlaceId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  // Authenticate the consumer.
  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;

  // Parse input.
  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const googlePlaceId = (bodyRes.body.googlePlaceId ?? "").toString().trim();
  if (!googlePlaceId) {
    return json({ ok: false, error: "googlePlaceId is required" }, 400);
  }

  const admin = adminClient(env);

  // Get: a place Mesita holds opens without spending quota or Google money.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, slug, name, state")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (existing) return json(openedExistingPlace(existing), 200);

  // Per-consumer rolling 24 h quota — every CREATE attempt is metered BEFORE
  // any Google spend (create-quota.ts has the abuse rationale).
  const quota = await consumeConsumerCreateQuota(
    admin,
    authRes.user.id,
    googlePlaceId,
    "consumer-web-create-place",
  );
  if (!quota.ok) return quota.response;

  const created = await createMinimalPlace({
    admin,
    callerName: "consumer-web-create-place",
    googlePlaceId,
  });
  if (!created.ok) {
    // Lost the unique-index race to a concurrent open: that row is the answer.
    const raced = existingFromDuplicate(created);
    if (raced) return json(openedExistingPlace(raced), 200);
    return json(created.body, created.status);
  }

  return json(
    {
      ok: true,
      created: true,
      place: created.place,
      enrichment: created.enrichment,
    },
    201,
  );
});
