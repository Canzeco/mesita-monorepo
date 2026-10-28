// Supabase Edge Function — consumer-web-get-place
//
// Public. Returns a single place by id (uuid) or slug, plus the business
// authority info needed for the detail page (channels / hours / etc.).
// Anon-readable but the places RLS policy still gates which rows ship.
//
// Caller: consumer. Verb: get. Noun: place. (Per the new <caller>-<verb>-<noun>
// naming convention.)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import {
  adminClient,
  anonClient,
  getOptionalAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Reviews tab's "Leave a review on Google" button (MESITA-2916) needs
// Google's place id: the write-review form takes no `?cid=`. This EF only;
// PLACE_PUBLIC_COLUMNS stays as it is.
const GOOGLE_REVIEW_FORM_COLUMN = ", google_place_id";

type Body = { id?: string; slug?: string };

serveJson("consumer-web-get-place", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  // Service role is required for the place_requests and threshold reads;
  // place browse still goes through the anon client + profiles RLS.
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
    .select(PLACE_PROFILE_COLUMNS + GOOGLE_REVIEW_FORM_COLUMN)
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

  // `name` is the Mesita name (MESITA-2828); google_name rides along as
  // Google's own label, Search's alias.
  // family_keys (MESITA-679): stored Families, else Atlas / Google.
  const row = withFamilyKeys(data as unknown as Record<string, unknown>);
  // Overview's Stats box (MESITA-2866): unique members who viewed / liked.
  // Counts only; best-effort, a failed read is 0.
  const profileStatsP = fetchPlaceProfileStats(admin, placeId);
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
    contentState: row.content_state,
    enrichedAt: row.enriched_at,
  });
  const place = {
    ...row,
    google_reviews: anonymousReviews(row.google_reviews),
    ...request,
    profile_stats: await profileStatsP,
    // Overview's Mesita Families box (MESITA-2924): the keys, named.
    families: familyChips(row.family_keys),
  };

  return json({ ok: true, place, tags });
});
