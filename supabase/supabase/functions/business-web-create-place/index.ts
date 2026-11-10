// Supabase Edge Function — business-web-create-place
//
// MESITA-3112. Business › Claim your place › "Add and claim": an owner whose
// place Mesita doesn't hold yet adds it from its Google listing, exactly as
// the consumer app's Add a place does (consumer-web-create-place):
//   1. a Google account (requireBusinessRequest),
//   2. GET: a google_place_id Mesita holds answers 200 `created: false`,
//      before the quota and any Google spend,
//   3. the caller's consumers row (ensureConsumer), then the per-person
//      rolling 24 h create quota — metered BEFORE any Google spend,
//   4. createMinimalPlace (dedupe → Google spine → ready), 201
//      `created: true`; a lost unique-index race answers like step 2.
// Every outcome leaves one place_open_events row.
//
// The consumer app's "Create the profile on open" switch does not gate this
// door: putting its own place on Mesita is what the Business app is for; the
// quota is the abuse budget. (Pato's live instruction, 2026-11-02, reverses
// MESITA-1632's "a business account must never create a place".)
//
// CREATED ≠ OWNED: this writes no place_managers row. The owner goes on to
// the claim form and Mesita reviews the request as for any place.
//
// ENRICH ON ADD (MESITA-3140, as a guest's first view after Generate,
// MESITA-2952): a fresh create counts the adder as the place's first request
// (`applyPlaceRequest`), so with "Enrich after N views" at 1 the same Render
// run starts and the place wears Enriching. A failed count never fails the add.
//
// Body: { googlePlaceId: string }
// Response: { ok: true, created: boolean, enriching?: boolean, place: { id, ... } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import {
  createMinimalPlace,
  existingFromDuplicate,
  findPlaceByGooglePlaceId,
  openedExistingPlace,
} from "../_shared/create-place.ts";
import { consumeConsumerCreateQuota } from "../_shared/create-quota.ts";
import { type PlaceOpenRecord, recordPlaceOpen } from "../_shared/place-open-events.ts";
import { normalizeEnrichmentConfig } from "../_shared/enrichment-config.ts";
import { readAppConfig } from "../_shared/write-config.ts";
import { applyPlaceRequest } from "../_shared/place-requests.ts";

const CALLER = "business-web-create-place";

serveJson("business-web-create-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const body = await readJsonOr<{ googlePlaceId?: unknown }>(req, {});
  const googlePlaceId = typeof body.googlePlaceId === "string" ? body.googlePlaceId.trim() : "";
  if (!googlePlaceId || googlePlaceId.length > 300) {
    return json({ ok: false, error: "googlePlaceId is required" }, 400);
  }

  const log = (rec: Omit<PlaceOpenRecord, "googlePlaceId" | "consumerId" | "caller">) =>
    recordPlaceOpen(admin, { googlePlaceId, consumerId: user.id, caller: CALLER, ...rec });
  const idOf = (row: unknown): string | null => {
    const id = (row as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : null;
  };

  // Get: a place Mesita holds is the answer; no quota, no Google spend.
  const existing = await findPlaceByGooglePlaceId(admin, googlePlaceId);
  if (existing) {
    await log({ outcome: "existing", placeId: idOf(existing) });
    return json(openedExistingPlace(existing), 200);
  }

  // The quota counts per consumers row (an owner is a guest account).
  const consumer = await ensureConsumer(admin, user);
  if (!consumer.ok) {
    await log({ outcome: "refused", code: consumer.code ?? `status_${consumer.status}` });
    return json({ ok: false, code: consumer.code, error: consumer.error }, consumer.status);
  }

  const creation = await readAppConfig(admin, "enrichment_config", "enrichment_config_read");
  if (!creation.ok) return creation.response;
  const perDay = normalizeEnrichmentConfig(creation.row?.enrichment_config).enrichConsumerCreatesPerDay;

  // Metered BEFORE any Google spend (create-quota.ts has the rationale).
  const quota = await consumeConsumerCreateQuota(admin, user.id, googlePlaceId, CALLER, perDay);
  if (!quota.ok) {
    await log({ outcome: "refused", code: "quota" });
    return quota.response;
  }

  const created = await createMinimalPlace({ admin, callerName: CALLER, googlePlaceId });
  if (!created.ok) {
    const raced = existingFromDuplicate(created);
    if (raced) {
      await log({ outcome: "existing", placeId: idOf(raced), code: "raced" });
      return json(openedExistingPlace(raced), 200);
    }
    await log({ outcome: "failed", code: `status_${created.status}` });
    return json(created.body, created.status);
  }

  await log({ outcome: "created", placeId: idOf(created.place) });
  let enriching = false;
  const placeId = idOf(created.place);
  if (placeId && consumer.consumerId) {
    const counted = await applyPlaceRequest(admin, { consumerId: consumer.consumerId, placeId, callerName: CALLER });
    if (counted.ok) enriching = counted.enriching;
    else console.error(`[${CALLER}] the add did not count toward Enrich: ${counted.error}`);
  }
  return json({ ok: true, created: true, enriching, place: created.place }, 201);
});
