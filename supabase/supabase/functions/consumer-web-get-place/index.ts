// Supabase Edge Function — consumer-web-get-place
//
// Public. Returns a single place by id (uuid) or slug, plus the business
// authority info needed for the detail page (vibe / channels / etc.).
// Anon-readable but the places RLS policy still gates which rows ship.
//
// Also attaches privacy-shaped Mesita review cards (`mesita_visitors`) so
// private accounts never leak a real name/handle to other guests
// (MESITA-913). Reviews are read via the service role because ticket_reviews
// RLS is own-row-only.
//
// Caller: consumer. Verb: get. Noun: place. (Per the new <caller>-<verb>-<noun>
// naming convention.)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  anonClient,
  getOptionalAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { PLACE_PUBLIC_COLUMNS as PLACE_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeys } from "../_shared/place-family-keys.ts";
import { resolvePlaceTags } from "../_shared/tags.ts";
import { mapTicketReviewsToVisitors } from "../_shared/mesita-review-visitors.ts";
import {
  loadRequestThreshold,
  placeRequestState,
} from "../_shared/place-requests.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESITA_REVIEW_LIMIT = 24;

type Body = { id?: string; slug?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  // Service role is required for the privacy-shaped review join; place browse
  // still goes through the anon client + profiles RLS.
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const idOrSlug = (body.id ?? body.slug ?? "").toString().trim();
  if (!idOrSlug) {
    return json({ ok: false, error: "id or slug is required" }, 400);
  }

  const supabase = anonClient(envRes.env);
  const column = UUID_RE.test(idOrSlug) ? "id" : "slug";

  const { data, error } = await supabase
    .from("profiles")
    .select(PLACE_COLUMNS)
    .eq(column, idOrSlug)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: "Place not found" }, 404);

  // Resolve the place's tag slugs (places.tags) into ordered, labelled catalog
  // entries so the detail modal can render chips without a second round-trip or
  // a client-side tag dictionary. Unknown slugs are dropped. Clients must
  // display label_en (MESITA-963); label_es is dormant until a TMS.
  const tags = await resolvePlaceTags(
    supabase,
    (data as { tags?: string[] | null }).tags,
  );

  // via unknown: the nested-embed select widens `data` to supabase-js's
  // GenericStringError union, which doesn't overlap the row shape enough for a
  // direct assertion.
  const placeId = (data as unknown as { id: string }).id;
  const admin = adminClient(envRes.env);
  const reviewsRes = await admin
    .from("ticket_reviews")
    .select(
      "food, service, ambience, value, comments, created_at, " +
        "consumer:consumers(first_name, last_name, full_name, instagram_handle, " +
        "privacy_public, class_key, instagram_followers_count)",
    )
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(MESITA_REVIEW_LIMIT);

  // Best-effort: a reviews lookup failure must not 500 the place detail —
  // the aggregates on the place row still render; the cards just stay empty.
  const mesita_visitors = reviewsRes.error
    ? []
    : mapTicketReviewsToVisitors(
      (reviewsRes.data ?? []) as unknown as Parameters<typeof mapTicketReviewsToVisitors>[0],
    );

  // `name` is the generated display column (mesita_name → google_name); raw
  // google_name and mesita_name stay on the payload for clients that need them.
  // family_keys (MESITA-679): stored Super Categories, else Atlas / Google.
  const row = withFamilyKeys(data as unknown as Record<string, unknown>);
  const { user } = await getOptionalAuthedUser(req, envRes.env);
  let requested = false;
  if (user) {
    const mine = await admin
      .from("place_requests")
      .select("consumer_id")
      .eq("consumer_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle();
    requested = !mine.error && mine.data != null;
  }
  const request = placeRequestState({
    requestCount: Number(row.request_count) || 0,
    threshold: await loadRequestThreshold(admin),
    requested,
    contentStatus: row.content_status,
    enrichedAt: row.enriched_at,
  });
  const place = {
    ...row,
    mesita_visitors,
    ...request,
  };

  return json({ ok: true, place, tags });
});
