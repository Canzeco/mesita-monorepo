// Google's listing of a place (MESITA-2313, MESITA-2325, MESITA-2678): the
// one field mask, its parser and the one-place Details read. The search
// bar's Text Search and its Details gate call share them, so a Google-only
// card carries the same facts whichever call found it. Google Nearby Search
// is gone (MESITA-2872): the Area pipeline reads Mesita's places only.

import {
  GOOGLE_PLACES_DETAILS_BASE,
  stripPlacesPrefix,
} from "./google-places.ts";
import { googleFetch } from "./google-fetch.ts";
import type { GooglePriceRange } from "./enrich-google-basics-normalizers.ts";

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
  "priceRange",
  "googleMapsUri",
  "internationalPhoneNumber",
  "websiteUri",
];

/** THE ONE field mask for a list of places (Text Search): the listing
 *  fields, with open now as Google's one boolean. */
export const LISTING_FIELD_MASK = [
  ...LISTING_FIELDS,
  "currentOpeningHours.openNow",
]
  .map((field) => `places.${field}`)
  .join(",");

/** The same listing for ONE place, a Place Details read (MESITA-2678).
 *  Opening hours go whole, the Details field the Enricher already asks
 *  (enrich-google-basics.ts); the parser reads `openNow` off it. Same
 *  Enterprise SKU. */
export const DETAILS_LISTING_FIELD_MASK = [
  ...LISTING_FIELDS,
  "currentOpeningHours",
].join(",");

export type GoogleHit = {
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
  /** Google's numeric `priceRange`: the $$ when `priceLevel` is missing
   *  (MESITA-2860). Same Enterprise SKU. */
  priceRange?: GooglePriceRange | null;
  /** `shortFormattedAddress`: street and area, without city and country. */
  shortAddress?: string | null;
  mapsUri?: string | null;
  phone?: string | null;
  website?: string | null;
};

/** One place as the listing mask returns it (Text Search and Details). */
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
  priceRange?: GooglePriceRange;
  shortFormattedAddress?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
};

/** THE parser for the listing mask (MESITA-2313, MESITA-2325): Text Search
 *  and Details both hand their places here, so a Google-only card carries
 *  the same facts whichever call found it. */
export function googleHitFromPlace(p: GooglePlaceListing): GoogleHit {
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
    types: Array.isArray(p.types)
      ? p.types.filter((t) => typeof t === "string")
      : [],
    businessStatus: typeof p.businessStatus === "string"
      ? p.businessStatus
      : null,
    reviewCount: typeof p.userRatingCount === "number"
      ? p.userRatingCount
      : null,
    openNow: typeof p.currentOpeningHours?.openNow === "boolean"
      ? p.currentOpeningHours.openNow
      : null,
    typeLabel: p.primaryTypeDisplayName?.text?.trim() || null,
    priceLevel: p.priceLevel ?? null,
    priceRange: p.priceRange ?? null,
    shortAddress: p.shortFormattedAddress?.trim() || null,
    mapsUri: p.googleMapsUri ?? null,
    phone: p.internationalPhoneNumber?.trim() || null,
    website: p.websiteUri ?? null,
  };
}

/** One Google place's listing, read by Place Details (MESITA-2678): the
 *  search lane's gate call for a Google-only Autocomplete row, whose answer
 *  is also the row's card, so a typed pick carries what Text Search
 *  sends. The id stays the one asked for, so the card, the dedupe key
 *  and the opening screen's stash agree. Null on any failure, and a refusal
 *  logs Google's body: a rejected mask empties every such row. */
export async function fetchPlaceListing(
  placeId: string,
  apiKey: string,
): Promise<GoogleHit | null> {
  try {
    const r = await googleFetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`,
      { apiKey, fieldMask: DETAILS_LISTING_FIELD_MASK },
    );
    if (!r.ok) {
      const text = await r.text();
      console.error(
        "[google-listing] Google place details",
        r.status,
        text.slice(0, 300),
      );
      return null;
    }
    return {
      ...googleHitFromPlace((await r.json()) as GooglePlaceListing),
      placeId,
    };
  } catch (err) {
    console.error("[google-listing] Google place details threw", String(err));
    return null;
  }
}
