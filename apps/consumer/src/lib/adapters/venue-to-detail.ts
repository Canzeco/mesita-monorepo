// Maps a public.venues row (as returned by consumer-get-venue, snake_case +
// JSONB) into the rich VenueDetail shape the detail modal renders. Every
// field is null-safe: enrichment leaves many columns empty, and the UI is
// built to tolerate empties (no reviews → no reviews section, etc.).
//
// Derived / not-stored fields (distance_km, open_now, price_range) get
// sensible neutral defaults — distance is geolocation-dependent and computed
// client-side later; the current_tier on the reward matrix defaults to "free"
// until the real consumer tier is threaded through.

import type { VenueDetail, Tier } from "@/lib/mock/venue";

// Loose row type — the EF returns the full venue projection; we read what we
// need defensively.
type Row = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function hoursTable(hours: unknown): VenueDetail["hours_table"] {
  const h = obj(hours);
  const out: VenueDetail["hours_table"] = [];
  for (const day of DAY_ORDER) {
    const ranges = arr<{ open?: string; close?: string }>(h[day]);
    if (ranges.length === 0) {
      out.push({ day: DAY_LABELS[day], range: "Closed" });
      continue;
    }
    const label = ranges
      .map((r) => `${r.open ?? ""}–${r.close ?? ""}`)
      .join(", ");
    out.push({ day: DAY_LABELS[day], range: label });
  }
  return out;
}

export function venueRowToDetail(row: Row): VenueDetail {
  const currency = str(row.currency) ?? "MXN";
  const priceLevel = (num(row.price_level) ?? 2) as 1 | 2 | 3 | 4;
  const listingType = row.listing_type === "partner" ? "partner" : "web";
  const fiscalFormal = row.fiscal_type === "formal";
  const details = obj(row.details);

  const activePremiumRate =
    num(row.premium_rate) ?? num(row.free_rate) ?? num(row.cashback_percent) ?? 0;

  return {
    id: str(row.id) ?? str(row.slug) ?? "",
    name: str(row.name) ?? "Venue",
    category: str(row.category) ?? "Place",
    vibe: str(row.vibe) ?? "",
    price_level: priceLevel,
    price_range: "$".repeat(priceLevel),
    currency,
    distance_km: 0,
    open_now: false,
    opens_at: "",
    closes_at: str(row.closes_at) ?? "",
    timezone: str(row.timezone) ?? "",
    city: str(row.city) ?? "",
    address: str(row.address) ?? "",
    zone: str(row.zone) ?? str(row.city) ?? "",
    listing_type: listingType,
    last_updated_label: "recently",

    photos: arr<string>(row.photos),

    mesita_reviews: {
      food: num(row.mesita_stars_food) ?? 0,
      service: num(row.mesita_stars_service) ?? 0,
      ambiance: num(row.mesita_stars_ambience) ?? 0,
      value: num(row.mesita_stars_value) ?? 0,
      overall: num(row.mesita_stars_overall) ?? 0,
      total: num(row.mesita_review_count) ?? 0,
    },
    google: {
      rating: num(row.google_stars_overall) ?? 0,
      count: num(row.google_review_count) ?? 0,
    },
    facebook: {
      rating: num(row.facebook_rating) ?? 0,
      followers: num(row.facebook_followers) ?? 0,
    },
    instagram: { followers: num(row.instagram_followers_count) ?? 0 },

    google_reviews: arr<Record<string, unknown>>(row.google_reviews).map((r) => ({
      author: str(r.author) ?? "Google reviewer",
      rating: num(r.rating) ?? 0,
      quote: str(r.quote) ?? "",
      date: str(r.date) ?? "",
      photo_url: str(r.photo_url),
    })),

    // No Mesita-native traffic until guests visit; the UI nulls this cleanly.
    mesita_visitors: [],

    menus: arr<Record<string, unknown>>(row.menus).map((m) => ({
      name: str(m.name) ?? "Menu",
      pages: arr(m.items).length,
      updated_label: "",
    })),

    promo: {
      badge_label: listingType === "partner" ? "Verified partner" : "Web listing",
      reward_kind: fiscalFormal ? "cashback" : "discount",
      reward_value: activePremiumRate,
    },

    promo_matrix: {
      welcome: {
        free: num(row.welcome_free_rate) ?? null,
        premium: num(row.welcome_premium_rate) ?? null,
      },
      default: {
        free: num(row.free_rate) ?? null,
        premium: num(row.premium_rate) ?? null,
      },
      current_tier: "free" as Tier,
      is_first_visit: true,
    },
    reward_cap_mxn: num(row.reward_cap_cents)
      ? Math.round((num(row.reward_cap_cents) ?? 0) / 100)
      : 0,
    requires_story: row.requires_story === true,

    long_description:
      str(row.description) ?? str(row.story) ?? str(row.pitch) ?? "",

    hours_table: hoursTable(row.hours),
    popular_times: arr<Record<string, unknown>>(row.popular_times).map((p) => ({
      day: str(p.day) ?? "",
      range: str(p.range) ?? "",
      bars: arr<number>(p.bars),
    })),
    popular_times_featured:
      str(arr<Record<string, unknown>>(row.popular_times)[0]?.day) ?? "",

    details: {
      category_full: str(row.category) ?? "",
      zone: str(row.zone) ?? "",
      dining_style: str(details.dining_style) ?? "",
      dress_code: str(details.dress_code) ?? "",
      service_options: arr<string>(details.service_options),
      reservations: str(details.reservations) ?? "",
      payment_methods: arr<string>(details.payment_methods),
      parking: str(details.parking) ?? "",
      amenities: arr<string>(details.amenities),
      accessibility: arr<string>(details.accessibility),
      dietary_options: arr<string>(details.dietary_options),
      good_for: arr<string>(details.good_for),
      languages: arr<string>(details.languages),
      kid_friendly:
        typeof details.kid_friendly === "boolean"
          ? details.kid_friendly
          : undefined,
      pet_friendly:
        typeof details.pet_friendly === "boolean"
          ? details.pet_friendly
          : undefined,
      established_year: num(row.established_year),
      executive_chef: str(row.executive_chef),
      participation: listingType === "partner" ? "Partner" : "Web listing",
      mechanic: fiscalFormal ? "Cashback" : "Discount",
    },

    channels: {
      website_url: str(row.website_url),
      whatsapp_url: str(row.whatsapp_url),
      instagram_url: str(row.instagram_url),
      tiktok_url: str(row.tiktok_url),
      facebook_url: str(row.facebook_url),
      x_url: str(row.x_url),
      youtube_url: str(row.youtube_url),
      threads_url: str(row.threads_url),
      reddit_url: str(row.reddit_url),
    },
    reservations: {
      opentable_url: str(row.opentable_url),
      resy_url: str(row.resy_url),
      uber_eats_url: str(row.uber_eats_url),
      rappi_url: str(row.rappi_url),
      didi_food_url: str(row.didi_food_url),
    },
    reviews_maps: {
      tripadvisor_url: str(row.tripadvisor_url),
      google_maps_url: str(row.google_maps_url),
    },

    phone: str(row.phone),
    email: str(row.email),
  };
}
