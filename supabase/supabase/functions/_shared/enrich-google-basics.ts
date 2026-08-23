// Shared — Google Places "basics" fetch.
//
// Extracted from the old atlas-seed-place so the create pipeline
// can build the identity spine in-memory without a
// DB seed. Fetches Google Places BASICS ONLY (name, address, geo, category,
// phone, hours, first photos, Google ratings/reviews, identity links) and
// returns them as a flat `places`-shaped object. NO Firecrawl/Perplexity/
// OpenAI/CSE/Instagram — that heavy work is the enrichment pipeline's job.
//
// Returns { ok:true, basics } or { ok:false, code, error, status } so callers
// can pass Google outages / spine-incomplete rejections straight through with
// the same status codes the old seed used (409/422/502/503).

import { classifyLinks } from "./channels.ts";
import { slugify } from "./place-slug.ts";
import { humanizeCategorySlug } from "./parse-utils.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { mapGoogleReviews } from "./enrich-google-review-snippets.ts";
import { GoogleReviewsSchema } from "./place-jsonb-schemas.ts";
import {
  closesAtFromHours,
  type GooglePeriod,
  weeklyHoursFromPeriods,
  type WeeklyHours,
} from "./enrich-google-hours.ts";
import {
  findAddressComponent,
  internationalPhone,
  priceLevelFromGoogle,
} from "./enrich-google-basics-normalizers.ts";

const GOOGLE_FIELD_MASK = [
  "id",
  "displayName",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "formattedAddress",
  "addressComponents",
  "location",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "websiteUri",
  "regularOpeningHours",
  "currentOpeningHours",
  "priceLevel",
  "businessStatus",
  "editorialSummary",
  "generativeSummary",
  "reviewSummary",
  "reviews",
  "photos",
].join(",");

// Candidate photo URLs collected from Google before any quality pass (Places
// only — no CSE/Firecrawl here). The enricher re-gathers + vision-ranks later.
const MAX_PHOTOS = 20;
const MAX_PHOTOS_TO_KEEP = 10;

type GoogleDetails = {
  id?: string;
  displayName?: { text?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  addressComponents?: { types?: string[]; longText?: string }[];
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: GooglePeriod[] };
  currentOpeningHours?: { weekdayDescriptions?: string[]; periods?: GooglePeriod[] };
  priceLevel?: string;
  businessStatus?: string;
  editorialSummary?: { text?: string };
  generativeSummary?: { overview?: { text?: string }; description?: { text?: string } };
  reviewSummary?: { text?: { text?: string } };
  reviews?: {
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }[];
  photos?: { name?: string; widthPx?: number; heightPx?: number }[];
};

// Flat, `places`-shaped identity spine. Project-level fields (slug, status,
// listing_type, content_status, plan…) are intentionally absent — the save step
// generates the unique slug and applies entity defaults.
export type GoogleBasics = {
  google_place_id: string;
  /**
   * Google Places displayName — a cached observation, not an identity spine
   * (google_place_id is). There is deliberately no `name` here: `places.name`
   * is a generated column and `mesita_name` belongs to the operator, so the
   * Enricher has nothing to say about either.
   */
  google_name: string;
  category: string | null;
  category_label: string | null;
  price_level: number | null;
  lat: number;
  lng: number;
  address: string;
  zone: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  closes_at: string | null;
  hours: WeeklyHours | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  photos: string[];
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  threads_url: string | null;
  reddit_url: string | null;
  whatsapp_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  didi_food_url: string | null;
  google_maps_url: string | null;
  email: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  google_reviews: { author: string; rating: number; quote: string; date: string }[] | null;
  editorial_summary: string | null;
};

export type GoogleBasicsResult =
  // `primaryType` is the raw Google Places (New) primary type (e.g.
  // "cocktail_bar"). Returned alongside `basics` — NOT inside it — because it's
  // a sourcing-gate signal (see _shared/sourcing.ts), not a persisted column.
  //
  // `businessStatus` rides alongside for the SAME reason, and the reason is
  // load-bearing rather than stylistic: the research stage does
  // `place = { ...basics }` and hands that object to a `places` UPDATE, so a
  // key in `basics` with no matching column fails the persist. It is Google's
  // verbatim UPPERCASE value — OPERATIONAL, CLOSED_TEMPORARILY,
  // CLOSED_PERMANENTLY — or null when Google does not say.
  //
  // It is the ONE fact function 1 (pulse) reads. Liveness is a question Google
  // answers directly; every other way of guessing it (no hours? no phone?) is a
  // fact about the LISTING, not about whether the place is open for business.
  | {
    ok: true;
    basics: GoogleBasics;
    primaryType: string | null;
    businessStatus: string | null;
  }
  | { ok: false; code: string; error: string; status: number };

// MESITA-1247: drop-on-failure shape guard for the google_reviews write —
// see the call site's comment for why this is defense in depth rather than
// a real malformation risk.
function validatedGoogleReviews(
  reviews: ReturnType<typeof mapGoogleReviews>,
): ReturnType<typeof mapGoogleReviews> {
  if (reviews === null) return null;
  const r = GoogleReviewsSchema.parse(reviews);
  return r.ok ? r.value : null;
}

// Fetch + assemble the Google identity spine for a placeId. Mirrors the old
// atlas-seed-place's pre-insert logic exactly (including the spine-incomplete
// rejection), minus any DB work.
export async function fetchGoogleBasics(
  placeId: string,
  googleKey: string,
): Promise<GoogleBasicsResult> {
  const details = await fetchGoogleDetails(placeId, googleKey);
  if ("error" in details) {
    return {
      ok: false,
      code: details.transient ? "google_unavailable" : "google_error",
      error: details.error,
      status: details.transient ? 503 : 502,
    };
  }

  // Google Business is the spine: no name / coords / address ⇒ not a real
  // listing. Reject rather than emit a half-null profile.
  const name = details.displayName?.text ?? "";
  if (!name) {
    return { ok: false, code: "google_spine_incomplete", status: 422, error: "Place has no display name on Google — can't list it." };
  }
  if (details.location?.latitude == null || details.location?.longitude == null) {
    return { ok: false, code: "google_spine_incomplete", status: 422, error: "Place has no coordinates on Google — can't list it." };
  }
  const address = details.formattedAddress ?? null;
  if (!address) {
    return { ok: false, code: "google_spine_incomplete", status: 422, error: "Place has no address on Google — can't list it." };
  }

  const city = findAddressComponent(details.addressComponents, ["locality", "administrative_area_level_2"]);
  const country = findAddressComponent(details.addressComponents, ["country"]);
  // Zone = the neighborhood / colonia. Google carries it as a sublocality or
  // neighborhood component when it has one (not every place does) — prefer the
  // colloquial `neighborhood`, then the administrative sublocality tiers. When
  // Google has none, synthesis fills zone downstream (fill-only-when-empty).
  const zone = findAddressComponent(details.addressComponents, [
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
  ]);

  const [photosResult, timezoneResult] = await Promise.allSettled([
    fetchGooglePhotos(details.photos ?? [], MAX_PHOTOS, googleKey),
    fetchTimezone(details.location?.latitude, details.location?.longitude, googleKey),
  ]);
  const placesPhotos = photosResult.status === "fulfilled" ? photosResult.value : [];
  const timezone = timezoneResult.status === "fulfilled" ? timezoneResult.value : null;
  const photos = placesPhotos.map((p) => p.photoUri).filter(Boolean).slice(0, MAX_PHOTOS_TO_KEEP);

  // Google-derived identity links: website via classifyLinks; Maps URL is
  // native-locked (MESITA-468) — prefer Google's googleMapsUri, else a
  // place-id deep link so create ALWAYS populates google_maps_url.
  const channels = classifyLinks([details.websiteUri]);
  const placeIdSpine = (details.id ?? placeId).trim();
  const mapsUrl =
    (details.googleMapsUri && details.googleMapsUri.trim()) ||
    `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeIdSpine)}`;

  // Cheap Google placeholder category; the enricher re-infers the real one.
  const categorySlug = slugify(details.primaryTypeDisplayName?.text ?? details.primaryType ?? "") || null;
  const categoryLabel = categorySlug ? humanizeCategorySlug(categorySlug) : null;

  const hours = weeklyHoursFromPeriods(details.regularOpeningHours?.periods);
  const closesAt = closesAtFromHours(details.regularOpeningHours?.weekdayDescriptions ?? []);

  const placeName = name.slice(0, ENRICH_FIELD_LIMITS.placeName.max);
  return {
    ok: true,
    primaryType: details.primaryType ?? null,
    businessStatus: details.businessStatus?.trim().toUpperCase() || null,
    basics: {
      google_place_id: placeIdSpine,
      // google_name is a CACHED OBSERVATION of Google's display name, not an
      // identity spine (google_place_id is). The Enricher never writes `name`
      // or `mesita_name`: `name` is a generated display column
      // (coalesce(mesita_name, google_name)) and `mesita_name` belongs to the
      // operator. Writing either would clobber an editorial label.
      google_name: placeName,
      category: categorySlug,
      category_label: categoryLabel ?? humanizeCategorySlug(categorySlug ?? ""),
      price_level: priceLevelFromGoogle(details.priceLevel),
      lat: details.location.latitude,
      lng: details.location.longitude,
      address,
      zone,
      city,
      country,
      timezone,
      closes_at: closesAt,
      hours,
      phone: internationalPhone(details, country),
      pitch: details.editorialSummary?.text ?? null,
      story: details.generativeSummary?.overview?.text ?? null,
      photos,
      website_url: channels.website_url,
      instagram_url: channels.instagram_url,
      facebook_url: channels.facebook_url,
      x_url: channels.x_url,
      threads_url: channels.threads_url,
      reddit_url: channels.reddit_url,
      whatsapp_url: channels.whatsapp_url,
      opentable_url: channels.opentable_url,
      resy_url: channels.resy_url,
      uber_eats_url: channels.uber_eats_url,
      didi_food_url: channels.didi_food_url,
      google_maps_url: mapsUrl,
      email: null,
      google_stars_overall: details.rating ?? null,
      google_review_count: details.userRatingCount ?? null,
      // MESITA-1247: mapGoogleReviews already hand-shapes this from Google's
      // structured API response (not LLM output), so this is defense in
      // depth rather than a real malformation risk — validated the same
      // drop-on-failure way as the LLM-sourced jsonb columns for consistency.
      google_reviews: validatedGoogleReviews(mapGoogleReviews(details.reviews)),
      editorial_summary: details.editorialSummary?.text ?? null,
    },
  };
}

// ── Google Places (New) ──────────────────────────────────────────────────────
async function fetchGoogleDetails(
  placeId: string,
  apiKey: string,
): Promise<GoogleDetails | { error: string; transient: boolean }> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es-MX&regionCode=MX`;
  const doFetch = () =>
    fetch(url, { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": GOOGLE_FIELD_MASK } });

  let r = await doFetch();
  if (r.status >= 500 && r.status < 600) {
    await new Promise((res) => setTimeout(res, 800));
    r = await doFetch();
  }
  if (!r.ok) {
    const text = await r.text();
    const transient = r.status >= 500 && r.status < 600;
    const friendly = transient
      ? "Google Places is temporarily unavailable. Try again in a few seconds."
      : r.status === 429
        ? "Google Places rate-limited the request. Try again in a moment."
        : r.status === 404
          ? "Google couldn't find that place. Try searching again."
          : `Google rejected the request (${r.status}). ${text.slice(0, 160)}`;
    return { error: friendly, transient };
  }
  return (await r.json()) as GoogleDetails;
}

async function fetchGooglePhotos(
  photos: NonNullable<GoogleDetails["photos"]>,
  max: number,
  apiKey: string,
): Promise<{ photoUri: string }[]> {
  if (!photos.length) return [];
  const settled = await Promise.allSettled(
    photos.slice(0, max).map(async (p) => {
      if (!p.name) throw new Error("photo missing name");
      const r = await fetch(
        `https://places.googleapis.com/v1/${p.name}/media?maxHeightPx=1600&skipHttpRedirect=true`,
        { headers: { "X-Goog-Api-Key": apiKey } },
      );
      if (!r.ok) throw new Error(`photo HTTP ${r.status}`);
      const d = (await r.json()) as { photoUri?: string };
      if (!d.photoUri) throw new Error("photo missing uri");
      return { photoUri: d.photoUri };
    }),
  );
  return settled
    .filter((s): s is PromiseFulfilledResult<{ photoUri: string }> => s.status === "fulfilled")
    .map((s) => s.value);
}

async function fetchTimezone(
  lat: number | undefined,
  lng: number | undefined,
  apiKey: string,
): Promise<string | null> {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  try {
    const ts = Math.floor(Date.now() / 1000);
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${ts}&key=${apiKey}`,
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { status?: string; timeZoneId?: string };
    return d.status === "OK" ? (d.timeZoneId ?? null) : null;
  } catch {
    return null;
  }
}
