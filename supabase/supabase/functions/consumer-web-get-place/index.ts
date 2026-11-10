// Supabase Edge Function — consumer-web-get-place
//
// Public. Returns a single place by id (uuid) or slug, plus the business
// authority info needed for the detail page (channels / hours / etc.).
// Anon-readable but the places RLS policy still gates which rows ship.
//
// Caller: consumer. Verb: get. Noun: place. (Per the new <caller>-<verb>-<noun>
// naming convention.)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { anonClient, getOptionalAuthedUser } from "../_shared/auth.ts";
import { PLACE_PUBLIC_COLUMNS as PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeys } from "../_shared/place-family-keys.ts";
import { familyChips } from "../_shared/catalog-families.ts";
import { anonymousReviews } from "../_shared/anonymous-reviews.ts";
import { resolvePlaceTags } from "../_shared/tags.ts";
import { fetchPlaceProfileStats } from "../_shared/place-activity-stats.ts";
import {
  loadRequestThreshold,
  placeRequestState,
} from "../_shared/place-requests.ts";
import { isUuid } from "../_shared/place-id.ts";
import { voucherOffer } from "../_shared/vouchers.ts";
import { paymentsLivemode } from "../_shared/boost.ts";

// The Reviews tab's "Leave a review on Google" button (MESITA-2916) needs
// Google's place id: the write-review form takes no `?cid=`. This EF only;
// PLACE_PUBLIC_COLUMNS stays as it is.
const GOOGLE_REVIEW_FORM_COLUMN = ", google_place_id";

type Body = { id?: string; slug?: string };

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

serveJson("consumer-web-get-place", async (req) => {
  // Service role is required for the place_requests and threshold reads;
  // place browse still goes through the anon client + profiles RLS.
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const idOrSlug = (body.id ?? body.slug ?? "").toString().trim();
  if (!idOrSlug) {
    return json({ ok: false, error: "id or slug is required" }, 400);
  }

  const supabase = anonClient(env);
  const column = isUuid(idOrSlug) ? "id" : "slug";

  // TWO ROUNDS, NOT SIX (MESITA-3029). The place screen waits on this read
  // before it paints, and every step used to wait on the one before: the
  // row, its tags, the caller, their request, the threshold, the stats.
  // get-place took 1.46 s at the median (function_edge_logs, 2026-10-28).
  // Round one asks what needs nothing: the row, the caller, the threshold.
  // Round two asks what needs the row's id.
  const [rowRes, { user }, threshold] = await Promise.all([
    supabase
      .from("profiles")
      .select(PLACE_PROFILE_COLUMNS + GOOGLE_REVIEW_FORM_COLUMN)
      .eq(column, idOrSlug)
      .maybeSingle(),
    getOptionalAuthedUser(req, env),
    loadRequestThreshold(admin),
  ]);
  const { data, error } = rowRes;

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: "Place not found" }, 404);

  // via unknown: the nested-embed select widens `data` to supabase-js's
  // GenericStringError union, which doesn't overlap the row shape enough for a
  // direct assertion.
  const placeId = (data as unknown as { id: string }).id;

  // `name` is the Mesita name (MESITA-2828); google_name rides along as
  // Google's own label, Search's alias.
  // family_keys (MESITA-679): stored Families, else Atlas / Google.
  const row = withFamilyKeys(data as unknown as Record<string, unknown>);

  const [tags, profileStats, requested, money] = await Promise.all([
    // The place's tag slugs (places.tags) as ordered, labelled catalog
    // entries, so the detail renders chips without a second round-trip or a
    // client-side tag dictionary. Unknown slugs are dropped. Clients display
    // label_en (MESITA-963); label_es is dormant until a TMS.
    resolvePlaceTags(supabase, (data as { tags?: string[] | null }).tags),
    // Overview's Stats box (MESITA-2866): unique members who viewed / liked.
    // Counts only; best-effort, a failed read is 0.
    fetchPlaceProfileStats(admin, placeId),
    user
      ? admin
          .from("place_requests")
          .select("consumer_id")
          .eq("consumer_id", user.id)
          .eq("place_id", placeId)
          .maybeSingle()
          .then((mine) => !mine.error && mine.data != null)
      : Promise.resolve(false),
    // The Vouchers tab (MESITA-3299, selling since MESITA-3303): the owner's
    // switches, what is for sale and why the rest is not, the catalog, and
    // the caller's credit here; never the account itself.
    voucherOffer(
      admin,
      { id: placeId, name: text(row.name), state: text(row.state), currency: text(row.currency) },
      user?.id ?? null,
      paymentsLivemode(),
    ),
  ]);
  const request = placeRequestState({
    requestCount: Number(row.request_count) || 0,
    threshold,
    requested,
    contentState: row.content_state,
    enrichedAt: row.enriched_at,
  });
  const place = {
    ...row,
    google_reviews: anonymousReviews(row.google_reviews),
    ...request,
    profile_stats: profileStats,
    // Overview's Mesita Families box (MESITA-2924): the keys, named.
    families: familyChips(row.family_keys),
    money,
  };

  return json({ ok: true, place, tags });
});
