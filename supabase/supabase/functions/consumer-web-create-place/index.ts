// Supabase Edge Function — consumer-web-create-place (LIVE consumer create path)
//
// The signed-in consumer opens a Google-only result's full profile and
// passes its `googlePlaceId`. This is GET-OR-CREATE (MESITA-2298): a
// google_place_id Mesita already holds answers 200 with that row and
// `created: false`, before the quota and before any Google spend; a new one
// runs the shared core and answers 201 with `created: true`:
//   1. authenticate the consumer,
//   2. look the id up; an existing row opens at once,
//   2b. Configurations › Creation › "Create the profile on open · consumer
//       app" must be on, else 403 `create_on_open_off` (no quota, no Google),
//   3. createMinimalPlace (_shared/create-place.ts): dedupe → Google spine →
//      save ready + enriched_at null. Does NOT seed Enricher. Guests vote
//      on the Enrich tab; the Crenup threshold queues Enricher 1–8.
//   A create that loses the unique-index race answers like step 2.
// Nothing here runs on a render, a prefetch or a pin tap: the client calls
// it only from the explicit open. Every open, whatever its outcome, leaves
// one place_open_events row (MESITA-2323), written after the outcome and
// never blocking the answer.
//
// Local:  supabase functions serve consumer-web-create-place
// Deploy: supabase functions deploy consumer-web-create-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runInBackground } from "../_shared/background.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
  serveJson,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  createMinimalPlace,
  existingFromDuplicate,
  findPlaceByGooglePlaceId,
  openedExistingPlace,
} from "../_shared/create-place.ts";
import { consumeConsumerCreateQuota } from "../_shared/create-quota.ts";
import {
  type PlaceOpenRecord,
  recordPlaceOpen,
} from "../_shared/place-open-events.ts";
import { normalizeEnrichmentConfig } from "../_shared/enrichment-config.ts";
import { readAppConfig } from "../_shared/write-config.ts";

type Body = { googlePlaceId?: string };

serveJson("consumer-web-create-place", async (req) => {
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
  const log = (rec: Omit<PlaceOpenRecord, "googlePlaceId" | "consumerId" | "caller">) =>
    recordPlaceOpen(admin, {
      googlePlaceId,
      consumerId: authRes.user.id,
      caller: "consumer-web-create-place",
      ...rec,
    });
  const placeIdOf = (row: unknown): string | null => {
    const id = (row as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : null;
  };

  // Get: a place Mesita holds opens without spending quota or Google money.
  const existing = await findPlaceByGooglePlaceId(admin, googlePlaceId);
  if (existing) {
    // The guest is waiting on this open; the audit line is written after
    // the answer leaves (MESITA-3029).
    runInBackground(log({ outcome: "existing", placeId: placeIdOf(existing) }));
    return json(openedExistingPlace(existing), 200);
  }

  // The operator's switch, read before any spend: off means a Google-only
  // result stays Google's when a guest opens it.
  const creation = await readAppConfig(
    admin,
    "enrichment_config",
    "enrichment_config_read",
  );
  if (!creation.ok) return creation.response;
  const creationConfig = normalizeEnrichmentConfig(
    creation.row?.enrichment_config,
  );
  const createOnOpen = creationConfig.enrichCreateOnOpenConsumer;
  if (!createOnOpen) {
    await log({ outcome: "refused", code: "create_on_open_off" });
    return json(
      {
        ok: false,
        code: "create_on_open_off",
        error: "This place isn't on Mesita yet.",
      },
      403,
    );
  }

  // Per-consumer rolling 24 h quota — every CREATE attempt is metered BEFORE
  // any Google spend (create-quota.ts has the abuse rationale).
  const quota = await consumeConsumerCreateQuota(
    admin,
    authRes.user.id,
    googlePlaceId,
    "consumer-web-create-place",
    creationConfig.enrichConsumerCreatesPerDay,
  );
  if (!quota.ok) {
    await log({ outcome: "refused", code: "quota" });
    return quota.response;
  }

  const created = await createMinimalPlace({
    admin,
    callerName: "consumer-web-create-place",
    googlePlaceId,
  });
  if (!created.ok) {
    // Lost the unique-index race to a concurrent open: that row is the answer.
    const raced = existingFromDuplicate(created);
    if (raced) {
      await log({ outcome: "existing", placeId: placeIdOf(raced), code: "raced" });
      return json(openedExistingPlace(raced), 200);
    }
    await log({ outcome: "failed", code: `status_${created.status}` });
    return json(created.body, created.status);
  }

  await log({ outcome: "created", placeId: placeIdOf(created.place) });

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
