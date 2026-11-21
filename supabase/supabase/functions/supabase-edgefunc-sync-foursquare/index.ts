// Supabase Edge Function — supabase-edgefunc-sync-foursquare (internal caller)
//
// MESITA-4544: link places to their Foursquare venue, or refresh a linked
// venue's popularity, through the same `syncFoursquare` a create and a deep
// update run (match on name, 150 m and the street number; a linked place
// reads popularity only; a failed read keeps the stored score). Built to
// backfill the places created while the secret was read under the wrong
// name, and reusable for a later refresh. Calls only Foursquare; never
// Google, Firecrawl or a model.
//
// Request: POST { placeId: uuid, dryRun?: bool }  one place, answering
//   { status, trace } (queries, every candidate with its verdict, the pick
//   and who made it, the details read; MESITA-4552)
// or POST { after?: uuid, limit?: 1..60 (default 25), linked?: bool }
//   after   walk place ids greater than this (keyset; send back `next`)
//   linked  false (default): places with no Foursquare link; true: every
//           place (refreshes linked ones)
// Response: { ok, done, next, asked, saved, unmatched, preserved, skipped }
//   `skipped` > 0 means the Foursquare secret is unset.
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · sync · foursquare.
// Auth: verify_jwt = true + requireInternalRequest (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { type FoursquareTrace, syncFoursquare } from "../_shared/foursquare-places.ts";
import { isUuid } from "../_shared/place-id.ts";

const LIMIT_DEFAULT = 25;
const LIMIT_MAX = 60;
const PARALLEL = 4;

serveJson("supabase-edgefunc-sync-foursquare", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, callerName } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  // One place, with what each step saw (MESITA-4552). `dryRun` writes nothing.
  if (body.placeId !== undefined) {
    if (!isUuid(body.placeId)) return json({ ok: false, code: "bad_request", error: "placeId is a place id" }, 400);
    const trace: FoursquareTrace = { queries: [], candidates: [], picked: null };
    const result = await syncFoursquare(admin, body.placeId as string, { trace, dryRun: body.dryRun === true });
    console.log(JSON.stringify({ fn: "supabase-edgefunc-sync-foursquare", event: "one", callerName, placeId: body.placeId, ...result }));
    return json({ ok: true, placeId: body.placeId, dryRun: body.dryRun === true, ...result, trace });
  }
  const after = body.after === undefined || body.after === null ? null : body.after;
  if (after !== null && !isUuid(after)) {
    return json({ ok: false, code: "bad_request", error: "after is a place id" }, 400);
  }
  const rawLimit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.floor(body.limit) : LIMIT_DEFAULT;
  const limit = Math.min(LIMIT_MAX, Math.max(1, rawLimit));
  const linked = body.linked === true;

  let q = admin.from("place_profiles").select("id").order("id", { ascending: true }).limit(limit);
  if (after !== null) q = q.gt("id", after as string);
  if (!linked) q = q.is("foursquare_place_id", null).is("foursquare_url", null);
  const { data, error } = await q;
  if (error) {
    console.error(JSON.stringify({ fn: "supabase-edgefunc-sync-foursquare", event: "read_failed", message: error.message }));
    return json({ ok: false, code: "read_failed", error: "place read failed" }, 502);
  }
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  const counts = { saved: 0, unmatched: 0, preserved: 0, skipped: 0 };
  for (let i = 0; i < ids.length; i += PARALLEL) {
    const results = await Promise.all(ids.slice(i, i + PARALLEL).map((id) => syncFoursquare(admin, id)));
    for (const r of results) counts[r.status]++;
  }
  const next = ids.length > 0 ? ids[ids.length - 1] : null;
  const done = ids.length < limit;
  console.log(JSON.stringify({
    fn: "supabase-edgefunc-sync-foursquare",
    event: "batch",
    callerName,
    after,
    linked,
    asked: ids.length,
    ...counts,
    done,
  }));
  return json({ ok: true, done, next, asked: ids.length, ...counts });
});
