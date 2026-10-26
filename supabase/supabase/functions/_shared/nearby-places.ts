// Google Nearby + the guest's scope words (MESITA-2298, MESITA-2302).
// TWO GUEST SCOPES over the three internal sets
// (Google Places ⊃ Mesita Places ⊃ Mesita Selected Places):
//   google    Google Places — what ONE Nearby Search (New) call returned
//             inside the operator's radius. A hit Mesita owns goes out as
//             that Mesita row (ready, Selected or not); the rest are stubs.
//             No Mesita backfill: a place Google did not return is absent.
//   selected  Mesita Selected — the ready Mesita rows the operator marked
//             (`places.selected`, MESITA-2707). No Google Nearby, no
//             review floor.
// `PlacesScope` has exactly those two words; the retired `enriched`,
// `mesita` and `partners` parse to `selected`, never to a paid call.
// ONE POST per ask (center · types · radius · rank): maxResultCount 20, the
// family-derived primary types, the ONE field mask. Nearby Search (New) has
// no pages, so each Google source is its own call, never a second page
// (MESITA-2379). Nothing is cached (MESITA-2765): every Supabase isolate
// shuts down when its request ends (`EarlyDrop`), so an in-memory cell never
// answered, and Google's terms keep the answer out of any store. Mesita wins
// its gid in the Area pipeline (`selectAreaPool`, area-pipeline.ts).

import {
  classifyGoogleError,
  GOOGLE_PLACES_DETAILS_BASE,
  GOOGLE_PLACES_NEARBY_URL,
  stripPlacesPrefix,
} from "./google-places.ts";
import { NEARBY_RADIUS_KM } from "./geo.ts";
import { EVERY_FAMILY_TYPES, GOOGLE_SEARCH_TYPES } from "./google-type-super.ts";

/** Nearby Search (New) caps one POST at maxResultCount 20 with no page
 *  token (MESITA-2298); more candidates take more, different calls. */
export const GOOGLE_NEARBY_MAX = 20;
/** The operator's circle, in metres, clamped to what Nearby accepts
 *  (50 m .. 50 km). `map.radiusKm` is 1..50; a bad value reads as 50 km. */
export function nearbyRadiusMetres(radiusKm?: number): number {
  const km = typeof radiusKm === "number" && Number.isFinite(radiusKm) &&
      radiusKm > 0
    ? radiusKm
    : NEARBY_RADIUS_KM;
  return Math.min(50_000, Math.max(50, Math.round(km * 1000)));
}
/** THE listing fields, one place's worth: everything a Google-only card and
 *  its opening profile show (MESITA-2313), nothing else. `rating` and
 *  `userRatingCount` already bill the Enterprise SKU, so the other
 *  Enterprise fields (price, open now, phone, website) and the Pro ones
 *  (readable type, short address, Maps link) add no spend. Never a photo
 *  field: an ephemeral Google card draws its family emoji (MESITA-2298 §6),
 *  and never an Atmosphere field (reviews, summaries), a dearer SKU. */
const LISTING_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "businessStatus",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "priceLevel",
  "googleMapsUri",
  "internationalPhoneNumber",
  "websiteUri",
];

/** THE ONE field mask for a list of places, Search and Feed alike: the
 *  listing fields, with open now as Google's one boolean. */
export const NEARBY_FIELD_MASK = [...LISTING_FIELDS, "currentOpeningHours.openNow"]
  .map((field) => `places.${field}`)
  .join(",");

/** The same listing for ONE place, a Place Details read (MESITA-2678).
 *  Opening hours go whole, the Details field the Enricher already asks
 *  (enrich-google-basics.ts); the parser reads `openNow` off it. Same
 *  Enterprise SKU. */
export const DETAILS_LISTING_FIELD_MASK = [...LISTING_FIELDS, "currentOpeningHours"].join(",");

export type NearbyHit = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  primaryType: string | null;
  /** Google's `types[]`: the place's other types, where its secondary
   *  families come from (MESITA-2438). Same Pro SKU as `primaryType`. */
  types?: string[];
  /** Google's own label. Feeds Discovery › General's post-Google wipe. */
  businessStatus: string | null;
  reviewCount: number | null;
  /** Google's `currentOpeningHours.openNow`; null when Google did not say. */
  openNow: boolean | null;
  /** Google's readable type (`primaryTypeDisplayName.text`), e.g. "Sports bar". */
  typeLabel?: string | null;
  /** Google's `priceLevel` enum (`PRICE_LEVEL_MODERATE`), raw. */
  priceLevel?: string | null;
  /** `shortFormattedAddress`: street and area, without city and country. */
  shortAddress?: string | null;
  mapsUri?: string | null;
  phone?: string | null;
  website?: string | null;
};

/** One place as the listing mask returns it, Nearby and Text Search alike. */
export type GooglePlaceListing = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  priceLevel?: string;
  shortFormattedAddress?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
};

/** THE parser for the listing mask (MESITA-2313, MESITA-2325): Nearby and
 *  Text Search both hand their places here, so a Google-only card carries
 *  the same facts whichever search found it. */
export function nearbyHitFromPlace(p: GooglePlaceListing): NearbyHit {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  return {
    placeId: stripPlacesPrefix(p.id ?? ""),
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    rating: typeof p.rating === "number" ? p.rating : null,
    primaryType: p.primaryType ?? null,
    types: Array.isArray(p.types) ? p.types.filter((t) => typeof t === "string") : [],
    businessStatus: typeof p.businessStatus === "string" ? p.businessStatus : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    openNow: typeof p.currentOpeningHours?.openNow === "boolean"
      ? p.currentOpeningHours.openNow
      : null,
    typeLabel: p.primaryTypeDisplayName?.text?.trim() || null,
    priceLevel: p.priceLevel ?? null,
    shortAddress: p.shortFormattedAddress?.trim() || null,
    mapsUri: p.googleMapsUri ?? null,
    phone: p.internationalPhoneNumber?.trim() || null,
    website: p.websiteUri ?? null,
  };
}

/** One Google place's listing, read by Place Details (MESITA-2678): the
 *  search lane's gate call for a Google-only Autocomplete row, whose answer
 *  is also the row's card, so a typed pick carries what Nearby and Text
 *  Search send. The id stays the one asked for, so the card, the dedupe key
 *  and the opening screen's stash agree. Null on any failure, and a refusal
 *  logs Google's body: a rejected mask empties every such row. */
export async function fetchPlaceListing(
  placeId: string,
  apiKey: string,
): Promise<NearbyHit | null> {
  try {
    const r = await fetch(`${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_LISTING_FIELD_MASK,
      },
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("[nearby] Google place details", r.status, text.slice(0, 300));
      return null;
    }
    return { ...nearbyHitFromPlace((await r.json()) as GooglePlaceListing), placeId };
  } catch (err) {
    console.error("[nearby] Google place details threw", String(err));
    return null;
  }
}

/** Nearby's two orders: nearest first, or Google's prominence. */
export type NearbyRank = "DISTANCE" | "POPULARITY";

type NearbyOnce =
  | { ok: true; hits: NearbyHit[] }
  | { ok: false };

/** One retry on a Google 5xx or a network throw (MESITA-2361): a single
 *  transient Google 500 hid the whole Google Places rail. The retry rides
 *  the one metered attempt for the cell; a 4xx is the request's fault and
 *  never retried. */
export const NEARBY_RETRY_DELAY_MS = 250;

async function searchNearbyOnce(
  apiKey: string,
  center: { lat: number; lng: number },
  radiusM: number,
  includedPrimaryTypes: string[],
  excludedPrimaryTypes: string[] = [],
  rankPreference: NearbyRank = "DISTANCE",
): Promise<NearbyOnce> {
  const post = () =>
    fetch(GOOGLE_PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": NEARBY_FIELD_MASK,
      },
      body: JSON.stringify({
        maxResultCount: GOOGLE_NEARBY_MAX,
        rankPreference,
        includedPrimaryTypes,
        ...(excludedPrimaryTypes.length > 0 ? { excludedPrimaryTypes } : null),
        locationRestriction: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: Math.min(50_000, Math.max(50, radiusM)),
          },
        },
      }),
    });
  let r: Response;
  try {
    r = await post();
  } catch (err) {
    console.error("[nearby] Google searchNearby threw; retrying once", String(err));
    await new Promise((res) => setTimeout(res, NEARBY_RETRY_DELAY_MS));
    r = await post();
  }
  if (r.status >= 500) {
    const text = await r.text();
    console.error(
      "[nearby] Google searchNearby 5xx; retrying once",
      r.status,
      text.slice(0, 300),
    );
    await new Promise((res) => setTimeout(res, NEARBY_RETRY_DELAY_MS));
    r = await post();
  }
  if (!r.ok) {
    const text = await r.text();
    const code = classifyGoogleError(r.status, text);
    console.error("[nearby] Google searchNearby failed", code, r.status, text.slice(0, 300));
    return { ok: false };
  }
  const data = (await r.json()) as { places?: GooglePlaceListing[] };
  const hits = (data.places ?? [])
    .map(nearbyHitFromPlace)
    .filter((p) => p.placeId && p.name);
  return { ok: true, hits };
}

/** Nearby's order: DISTANCE (nearest first) or POPULARITY (prominence). */
export type NearbyShape = { rankPreference?: NearbyRank };

export type SearchNearbyOpts = {
  /** Nearby primary types (`includedPrimaryTypes`): the guest's families'
   *  batteries, or every guest family's when omitted (EVERY_FAMILY_TYPES).
   *  Empty = no Google call. */
  types?: readonly string[];
  /** The operator's circle (`map.radiusKm`, MESITA-2298 §3). Omit = 50 km.
   */
  radiusKm?: number;
  /** Nearby `excludedPrimaryTypes` (MESITA-2338): the precise subtypes of
   *  an included general type that belong to no requested family, so the
   *  Family gate's pushdown is exact (Dinner sends `restaurant` and
   *  excludes `mexican_restaurant`). */
  excludedTypes?: readonly string[];
  /**
   * Called once, right before the ONE billed Nearby call (MESITA-1700): the
   * ledger behind this hook counts what Google charges for. `false` skips
   * Google for this ask.
   */
  beforeFanout?: () => Promise<boolean>;
} & NearbyShape;

const SUPER_SEARCH_TYPE_SET = new Set<string>(
  Object.values(GOOGLE_SEARCH_TYPES).flat(),
);

function resolveNearbyTypes(types?: readonly string[]): readonly string[] {
  if (!types) return EVERY_FAMILY_TYPES;
  return types.filter((t) => SUPER_SEARCH_TYPE_SET.has(t));
}

/** What one Nearby request did: billed and answered, refused by the
 *  ledger, failed at Google, or nothing to ask. */
export type NearbyOutcome = "billed" | "refused" | "failed" | "none";

/** The Google places around `center`: ONE Nearby Search (New) POST with the
 *  primary types, maxResultCount 20, the asked rank (DISTANCE unless
 *  POPULARITY), inside the circle (MESITA-2298). Never a second page, never
 *  cached (MESITA-2765). HTTP / parse failures return no hits (Mesita still
 *  shows). The shared IP quota is `beforeFanout` (nearby-google-quota.ts),
 *  charged once per billed call. */
export async function searchNearbyPlaces(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<NearbyHit[]> {
  return (await searchNearbyPlacesOutcome(apiKey, center, opts)).hits;
}

/** `searchNearbyPlaces` with what happened, for the Area pipeline's log. */
export async function searchNearbyPlacesOutcome(
  apiKey: string,
  center: { lat: number; lng: number },
  opts: SearchNearbyOpts = {},
): Promise<{ hits: NearbyHit[]; outcome: NearbyOutcome }> {
  const radius = nearbyRadiusMetres(opts.radiusKm);
  const beforeFanout = opts.beforeFanout;
  const types = resolveNearbyTypes(opts.types);
  if (types.length === 0) return { hits: [], outcome: "none" };
  const excluded = (opts.excludedTypes ?? []).filter((t) => !types.includes(t));
  const rank = opts.rankPreference ?? "DISTANCE";
  if (beforeFanout && !(await beforeFanout())) return { hits: [], outcome: "refused" };

  const batch = await searchNearbyOnce(apiKey, center, radius, [...types], excluded, rank);
  if (!batch.ok) return { hits: [], outcome: "failed" };
  const seen = new Set<string>();
  const hits: NearbyHit[] = [];
  for (const hit of batch.hits) {
    if (seen.has(hit.placeId)) continue;
    seen.add(hit.placeId);
    hits.push(hit);
  }
  return { hits, outcome: "billed" };
}

/**
 * THE GUEST'S TWO WORDS (MESITA-2298) over the three internal sets
 * (Google Places ⊃ Mesita Places ⊃ Mesita Selected Places):
 *
 *   google    Google Places — Nearby's hits; a Mesita row that owns one
 *             (ready, Selected or not) goes out as itself.
 *   selected  Mesita Selected — the rows the operator marked
 *             (`places.selected`, MESITA-2707). Free: no Google.
 *
 * The wire carries the scope by NAME. A third word fails to compile here,
 * so no caller can ask for a set a guest cannot see. Absent, unknown and
 * the retired words (`enriched`, `mesita`, `partners`) all land on
 * `selected`, never on a paid call. Legacy ordinals keep their shipped
 * meanings (>= 2 = Google, lower = Mesita): Vercel and the Edge Functions
 * deploy on separate paths, so that skew window is real.
 */
export type PlacesScope = "google" | "selected";

export const PLACES_SCOPE_DEFAULT: PlacesScope = "selected";

const PLACES_SCOPES: readonly PlacesScope[] = ["google", "selected"];
const RETIRED_SCOPE_WORDS: readonly string[] = [
  "enriched",
  "mesita",
  "partners",
];

export function parsePlacesScope(value: unknown): PlacesScope {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((PLACES_SCOPES as readonly string[]).includes(key)) {
      return key as PlacesScope;
    }
    if (RETIRED_SCOPE_WORDS.includes(key)) return "selected";
    // A legacy numeric arriving as a string reads the same as the number.
    const legacy = Number(key);
    if (Number.isFinite(legacy) && key.length > 0) {
      return legacy >= 2 ? "google" : "selected";
    }
    return PLACES_SCOPE_DEFAULT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 2 ? "google" : "selected";
  }
  return PLACES_SCOPE_DEFAULT;
}
