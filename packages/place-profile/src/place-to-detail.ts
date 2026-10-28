// Maps a public.places row (as returned by consumer-get-place, snake_case +
// JSONB) into the rich PlaceDetail shape the detail modal renders. Every
// field is null-safe: enrichment leaves many columns empty, and the UI is
// built to tolerate empties (no reviews → no reviews section, etc.).
//
// Derived / not-stored fields (distance_km, open_now, price_range) get
// sensible neutral defaults — distance is geolocation-dependent and computed
// client-side later.

import { googleTypeEmoji } from "./lib/google-type-emoji";
import type { PlaceDetail } from "./place-detail";
import { detectMenuKind } from "./lib/menu-url";
import { parseMenuNutrition } from "./lib/nutrition";
import { resolvePlaceCategoryName } from "./lib/place-category";
import { googleTagChips } from "./lib/google-atmosphere";
import { relativeLabel } from "./lib/format";
import { DEFAULT_CURRENCY } from "./lib/money";
import { isReserveActionEnabled } from "./lib/place-profile-actions";
import type { Row } from "./place-to-detail-helpers";
import {
  arr,
  computeOpenState,
  derivePriceRange,
  hoursTable,
  num,
  obj,
  resolvePlaceDisplayName,
  str,
} from "./place-to-detail-helpers";

// Resolved tag as returned by consumer-get-place's `tags` array: only the
// place's selected tags, already ordered by sort_order. Display uses
// label_en (MESITA-963); facet drives the per-facet chip tint in the modal.
export type ResolvedTag = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  sort_order: number;
};

export { googleTagLabel } from "./lib/google-atmosphere";

// consumer-web-get-place's `profile_stats` (MESITA-2866). Both counts or none.
function profileStats(raw: unknown): PlaceDetail["profile_stats"] {
  if (!raw || typeof raw !== "object") return undefined;
  const { viewed, saved } = raw as Record<string, unknown>;
  if (typeof viewed !== "number" || typeof saved !== "number") return undefined;
  if (!Number.isFinite(viewed) || !Number.isFinite(saved)) return undefined;
  return { viewed: Math.max(0, viewed), saved: Math.max(0, saved) };
}

// Google's documented write-review link (MESITA-2916).
function googleReviewUrl(placeId: string | undefined): string | undefined {
  if (!placeId) return undefined;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function placeRowToDetail(row: Row, catalogTags?: ResolvedTag[]): PlaceDetail {
  // Catalog tags stay stored and are not the Profile field (MESITA-2255).
  void catalogTags;
  const categoryName =
    resolvePlaceCategoryName({
      categoryLabel: str(row.category_label),
      category: str(row.category),
    }) ?? "Place";
  const currency = str(row.currency) ?? DEFAULT_CURRENCY;
  // No stored level, no price (MESITA-2860): a default of 2 printed
  // "MX$200–300 per person" for places Google never priced.
  const level = num(row.price_level);
  const priceLevel =
    level != null && level >= 1 && level <= 4
      ? (Math.round(level) as 1 | 2 | 3 | 4)
      : null;

  const openState = computeOpenState(row.hours, str(row.timezone));
  // Dates box: Created from created_at; Updated from enrichment (falls back
  // to creation). last_updated_label stays an alias for lean Place / overview.
  const createdLabel = relativeLabel(str(row.created_at)) ?? "recently";
  const updatedLabel =
    relativeLabel(str(row.enriched_at) ?? str(row.created_at)) ?? "recently";

  return {
    reservations_enabled: isReserveActionEnabled(row),
    id: str(row.id) ?? str(row.slug) ?? "",
    name: resolvePlaceDisplayName(row),
    category: categoryName,
    category_emoji: googleTypeEmoji(str(row.category)),
    price_level: priceLevel,
    price_range: derivePriceRange(row),
    currency,
    distance_km: 0,
    // Without stored hours or a timezone, a Google-only draft still carries
    // Google's own open-now (MESITA-2313); otherwise unknown stays null.
    open_now: openState.open_now ??
      (typeof row.open_now === "boolean" ? row.open_now : null),
    opens_at: openState.opens_at,
    closes_at: openState.closes_at || (str(row.closes_at) ?? ""),
    timezone: str(row.timezone) ?? "",
    city: str(row.city) ?? "",
    address: str(row.address) ?? "",
    lat: num(row.lat) ?? null,
    lng: num(row.lng) ?? null,
    zone: str(row.zone) ?? "",
    created_label: createdLabel,
    updated_label: updatedLabel,
    last_updated_label: updatedLabel,
    // Enrichment still in flight for the WHOLE pipeline (research → analysis →
    // contents). places.content_state stays 'generating' until the contents
    // stage lands 'ready' — never clear Enriching after research alone
    // (MESITA-453). 'ready'/'failed' both read as done.
    is_enriching: row.content_state === "generating",
    is_profile_ready: row.is_profile_ready === true ||
      row.content_state === "ready",
    is_enriched: row.is_enriched === true ||
      (typeof row.enriched_at === "string" && row.enriched_at.trim() !== ""),
    boost_tier: num(row.boost_tier) ?? 0,
    request_count: num(row.request_count) ?? 0,
    request_threshold: num(row.request_threshold) ?? 5,
    requested: row.requested === true,
    request_lifecycle:
      row.request_lifecycle === "requested" ||
        row.request_lifecycle === "enriched" ||
        row.request_lifecycle === "listed"
        ? row.request_lifecycle
        : row.is_enriched === true ||
            (typeof row.enriched_at === "string" && row.enriched_at.trim() !== "")
          ? "enriched"
          : (num(row.request_count) ?? 0) > 0
            ? "requested"
            : "listed",

    photos: arr<string>(row.photos),

    // Google atmosphere chips (MESITA-2255). places.tags is not this box.
    tags: googleTagChips(row.google_tags),
    families: familyChips(row.families),
    profile_stats: profileStats(row.profile_stats),

    google: {
      rating: num(row.google_stars_overall) ?? null,
      count: num(row.google_review_count) ?? null,
    },
    facebook: { followers: num(row.facebook_followers) ?? null },
    instagram: { followers: num(row.instagram_followers_count) ?? null },

    // Enricher (enricher-cron-enrich-place-*) stores each review as
    // { author, rating, text, published } — map those onto the detail shape
    // (quote/date) and keep the legacy keys as fallbacks. The author and any
    // photo are dropped here: guests see reviews anonymously (MESITA-2916).
    google_reviews: arr<Record<string, unknown>>(row.google_reviews).map(
      (r) => ({
        rating: num(r.rating) ?? 0,
        quote: str(r.text) ?? str(r.quote) ?? "",
        date: str(r.published) ?? str(r.date) ?? "",
      }),
    ),

    products: {
      menu: (() => {
        const menuItems = arr<Record<string, unknown>>(obj(row.products).menu);
        const legacyMenus = arr<Record<string, unknown>>(row.menus);
        const source = menuItems.length > 0 ? menuItems : legacyMenus;
        const fromJson = source
          .map((m) => {
            const url = str(m.url) ?? str(m.pdf_url) ?? str(m.source_url) ?? "";
            if (!url) return null;
            const kind = detectMenuKind(url);
            const itemPages = arr(m.items).length;
            const pages =
              typeof m.pages === "number" && Number.isFinite(m.pages)
                ? Math.max(0, Math.round(m.pages))
                : kind === "image"
                  ? Math.max(1, itemPages || 1)
                  : itemPages > 0
                    ? itemPages
                    : null;
            return {
              name: str(m.name) ?? "Menu",
              url,
              kind,
              pages,
              updated_label: str(m.updated_label) ?? "",
              nutrition: parseMenuNutrition(m.nutrition),
            };
          })
          .filter((m): m is NonNullable<typeof m> => m != null);

        if (fromJson.length > 0) return fromJson;

        // Legacy single-slot columns (pre-products.menu).
        const legacyUrl = str(row.menu_pdf_url);
        if (!legacyUrl) return [];
        const kind = detectMenuKind(legacyUrl);
        return [
          {
            name: str(row.menu_pdf_name) ?? "Menu",
            url: legacyUrl,
            kind,
            pages: kind === "image" ? 1 : null,
            updated_label: "",
            nutrition: null,
          },
        ];
      })(),
    },

    long_description:
      str(row.description) ?? str(row.story) ?? str(row.pitch) ?? "",
    // Spanish About translation (MESITA-926). Empty until Enricher/admin fills it.

    hours_table: hoursTable(row.hours),
    popular_times: arr<Record<string, unknown>>(row.popular_times).map((p) => ({
      day: str(p.day) ?? "",
      range: str(p.range) ?? "",
      bars: arr<number>(p.bars),
    })),

    channels: {
      website_url: str(row.website_url),
      whatsapp_url: str(row.whatsapp_url),
      instagram_url: str(row.instagram_url),
      facebook_url: str(row.facebook_url),
      x_url: str(row.x_url),
      threads_url: str(row.threads_url),
      reddit_url: str(row.reddit_url),
    },
    reservations: {
      opentable_url: str(row.opentable_url),
      resy_url: str(row.resy_url),
      uber_eats_url: str(row.uber_eats_url),
      didi_food_url: str(row.didi_food_url),
    },
    reviews_maps: {
      google_maps_url: str(row.google_maps_url),
      google_review_url: googleReviewUrl(str(row.google_place_id)),
    },

    phone: str(row.phone),
  };
}

/** The EF's `families` (MESITA-2924), kept only when well formed. */
function familyChips(
  raw: unknown,
): Array<{ key: string; label: string; emoji: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f) => {
    const r = (f ?? {}) as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.label !== "string" || !r.label) {
      return [];
    }
    // Undefined is no family: an EF from before MESITA-2954 still sends it.
    if (r.key === "undefined") return [];
    const emoji = typeof r.emoji === "string" ? r.emoji : "";
    return [{ key: r.key, label: r.label, emoji }];
  });
}
