// Supabase Edge Function — consumer-web-create-place (LIVE consumer create path)
//
// The signed-in consumer passes a Google Places `googlePlaceId` (from the
// Search → Add flow). Create is awaited in this request — same shared
// core as admin and business — and returns the ugly profile:
//   1. authenticate the consumer,
//   2. createMinimalPlace (_shared/create-place.ts): dedupe → Google spine →
//      save ready + enriched_at null. Does NOT seed Intaker. Guests vote
//      on the Enrich tab; the Intake threshold queues Intaker 1–10.
//
// Local:  supabase functions serve consumer-web-create-place
// Deploy: supabase functions deploy consumer-web-create-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { createMinimalPlace } from "../_shared/create-place.ts";
import { consumeConsumerCreateQuota } from "../_shared/create-quota.ts";

// `googlePlaceId` is the canonical key; legacy `placeId` accepted until every
// client sends the new key (same contract as business-web-create-project).
type Body = { googlePlaceId?: string; placeId?: string };

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
  const googlePlaceId = (bodyRes.body.googlePlaceId ?? bodyRes.body.placeId ?? "")
    .toString()
    .trim();
  if (!googlePlaceId) {
    return json({ ok: false, error: "googlePlaceId is required" }, 400);
  }

  const admin = adminClient(env);

  // Per-consumer rolling 24 h quota — every attempt is metered BEFORE any
  // Google spend (create-quota.ts has the abuse rationale).
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
    dedupeError: "This place is already on Mesita.",
    queueEnrich: false,
  });
  if (!created.ok) return json(created.body, created.status);

  return json({ ok: true, place: created.place, enrichment: created.enrichment }, 201);
});
