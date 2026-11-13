// The rich place shape the detail screen renders. `placeRowToDetail`
// (lib/adapters/place-to-detail.ts) maps a consumer-web-get-place row onto
// it; every field is null-safe on the adapter side, so the view never guards
// against a missing column — an empty list simply hides its box.

import type { VoucherReason } from "./money-state";

/** The six vouchers and the cashback a place can switch on (MESITA-3296). */
export const VOUCHER_KEYS = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story", "voucher_vip"] as const;
export type VoucherKey = (typeof VOUCHER_KEYS)[number];

/** One catalog line as the server prices it (MESITA-3303). The client shows
 *  these numbers and never adds them. */
export type VoucherCatalogLine = {
  price_cents: number;
  bonus_cents: number;
  /** Price plus bonus: the credit the guest ends up with. */
  credit_cents: number;
  available_after_sec: number;
};

/** The guest's credit at this place (consumer-web-list-vouchers). */
export type PlaceBalance = {
  available_cents: number;
  pending_cents: number;
  held_cents: number;
  spendable_cents: number;
};

export type PlaceMoney = {
  /** Stripe lets the place's account take payments. */
  charges_enabled: boolean;
  /** The green Mesita Payments mark, the server's (moneyState, MESITA-3408). */
  mesita_pay: boolean;
  /** Payments Cashback, the standard 5%, on. */
  cashback: boolean;
  /** A bill paid to the waiter earns 2% here (the Cashback switch and a place
   *  code, no Stripe; MESITA-3545). The server sends it; older reads lack it. */
  outside_cashback?: boolean;
  /** The place's own rates now, in bps, 0 = Off or not usable (MESITA-3589):
   *  the card part (Mesita Payments Cashback) and the cash bill part (Cash
   *  Payments Cashback). Older reads lack them. */
  card_cashback_bps?: number;
  cash_cashback_bps?: number;
  /** MESITA-3827: the credit part (Credits Payments Cashback) and a voucher's
   *  price (Mesita Prepayments Cashback); older reads lack them. */
  credit_cashback_bps?: number;
  prepay_cashback_bps?: number;
  /** House Credits is On here (MESITA-3589); older reads lack it. */
  house_credits?: boolean;
  /** Cash Payments is On here (the switch and the place code; MESITA-3589). */
  cash?: boolean;
  vouchers: Record<VoucherKey, boolean>;
  /** Stripe is in test mode: the TestBand shows, no real money moves. */
  test_mode: boolean;
  /** Lowercase ISO 4217 ("mxn"). */
  currency: string;
  /** The vouchers a guest can buy here now (MESITA-3303). */
  sell: VoucherKey[];
  /** Every other voucher and why. */
  unavailable: Partial<Record<VoucherKey, VoucherReason>>;
  catalog: Partial<Record<VoucherKey, VoucherCatalogLine>>;
  /** The signed-in guest's credit here; null when signed out or unknown. */
  balance: PlaceBalance | null;
};

/** The Catalog's score for one place, the server's numbers (MESITA-2379):
 *  Proximity × Popularity × Premier = Final. null is "n/a", never 0. */
export type PlaceScore = {
  proximity: number | null;
  distance_km: number | null;
  popularity: number | null;
  /** Premier's tier number (2 · 5), else 1. */
  premier: number;
  final: number;
};

export type PlaceDetail = {
  /** Reserve: the Reservations switch on AND a number to call (MESITA-3622). */
  reservations_enabled?: boolean;
  /** The money products the place has on (MESITA-3299): the owner's switches
   *  (Business › Payments) and whether its Stripe account can charge. The
   *  Vouchers tab reads it. Absent on a Google-only card and on older EFs. */
  money?: PlaceMoney;
  // Stable identifier — matches public.places.id once the real fetch lands.
  // Used as the key in the localStorage saved-places store, share URLs, and
  // any future per-place persistence.
  id: string;
  // 1. Summary
  name: string;
  category: string;
  /** The category's own emoji (MESITA-2813), drawn on the place screen's
   *  category fact; null when Google's table has none. */
  category_emoji?: string | null;
  price_level: 1 | 2 | 3 | 4 | null;
  // The place's own per-person numeric range (e.g. "MX$200–300"), or ""
  // when it has none. Quick-view surfaces (swipe / catalog / map) render
  // price_level as $-symbols; the place detail chip renders this and falls
  // back to a range derived from price_level when it is empty.
  price_range: string;
  // ISO 4217 code mirroring public.places.currency (default MXN).
  // Carried through so future surfaces can render dynamic prefixes
  // without parsing price_range.
  currency: string;
  distance_km: number;
  /** null = unknown (no hours, or no timezone and no word from Google). */
  open_now: boolean | null;
  opens_at: string;
  closes_at: string;
  timezone: string;
  city: string;
  address: string;
  // Coordinates from public.places — used for Uber / Maps deep links.
  // Null when the place row has no geo yet (enrichment still pending).
  lat: number | null;
  lng: number | null;
  zone: string;
  /** Relative "Created · …" source (from places.created_at). */
  created_label: string;
  /** Relative "Updated · …" source (enriched_at ?? created_at). */
  updated_label: string;
  /** Alias of updated_label — kept for lean Place / overview callers. */
  last_updated_label: string;
  // True while the Enricher is still building this place's profile across the
  // FULL pipeline (research → analysis → contents). Driven by
  // places.content_state = generating — it stays generating until contents
  // lands ready (MESITA-453). Drives the header "(Enriching)" badge.
  is_enriching: boolean;
  /** Viewable profile (content_state ready). Ugly Create profiles are ready. */
  is_profile_ready: boolean;
  /** Enricher finished (`places.enriched_at`). False → Enrich vote tab. */
  is_enriched: boolean;
  /** Mesita Premier (MESITA-2925, the paid tier since MESITA-2789):
   *  `places.boost_tier`, 0 none · 1 2X · 2 5X. Above 0 the name
   *  wears "Premier 2X". Absent on callers that never read it. */
  boost_tier?: number;
  /** Consumer vote count. Progress toward the Crenup threshold. */
  request_count: number;
  request_threshold: number;
  /** This consumer already voted on this place. */
  requested: boolean;
  /** Derived: listed | requested | enriched. Never a state-per-count. */
  request_lifecycle: "listed" | "requested" | "enriched";

  // 2. Media
  photos: string[];
  /** The round profile picture (MESITA-3528): the owner's pick, else the
   *  cover. Null with no photo at all. */
  profilePhoto: string | null;

  // Mesita tags, else Google atmosphere chips (MESITA-2792). Empty hides the box.
  tags: Array<{
    slug: string;
    label: string;
    facet: string;
  }>;

  /** Overview's Families box (Pato, MESITA-2924), above Tags: the
   *  place's families as the EF names them, in family order. Empty hides the
   *  box (an older EF sends none). */
  families: Array<{ key: string; label: string; emoji: string }>;

  /** Overview's Stats box (MESITA-2866): unique members who opened this
   *  profile and who liked (saved) it, from place_activity. Absent when the
   *  payload carries no counts (admin Preview, an older EF): no box. */
  profile_stats?: { viewed: number; saved: number };

  /** Overview's Score box (MESITA-3319), under Stats: the server's ranking
   *  breakdown for this guest's location, as the consumer read it from
   *  consumer-web-list-catalog for this one place. Absent or null (no
   *  location, no answer, admin Preview): no box. The client prints, never
   *  computes. */
  score?: PlaceScore | null;

  // 3. External reputation — the three outside channels the summary reads.
  // Google carries a rating and a count; Facebook and Instagram carry reach.
  google: { rating: number | null; count: number | null };
  facebook: { followers: number | null };
  instagram: { followers: number | null };

  // 4. Google reviews — ANONYMOUS (Pato, MESITA-2916: "don't mention the
  // names, just mention the stars and the comments"). No author, no
  // avatar, no reviewer photo: the shape has no field that could draw one.
  google_reviews: Array<{
    rating: number;
    quote: string;
    date: string;
  }>;

  // 5. Menus (stored under `products`) — for restaurants the menu lives
  // under products.menu. `url` is the Storage public URL or Drive share link;
  // `kind` drives the in-app viewer (image / PDF / Drive preview).
  products: {
    menu: Array<{
      name: string;
      url: string;
      kind: "image" | "pdf" | "drive";
      pages: number | null;
      updated_label: string;
      /** Headline facts. Null when the place has not estimated them. */
      nutrition: {
        kcal: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
      } | null;
    }>;
  };

  // 6. Long description — English (Mesita core). Spanish TMS later.
  long_description: string;

  // Hours / popular times
  hours_table: Array<{
    day: string;
    range: string;
  }>;
  popular_times: Array<{
    day: string;
    range: string;
    bars: number[];
  }>;

  channels: {
    website_url?: string;
    whatsapp_url?: string;
    instagram_url?: string;
    facebook_url?: string;
    x_url?: string;
    threads_url?: string;
    reddit_url?: string;
  };
  reservations: {
    opentable_url?: string;
    resy_url?: string;
    uber_eats_url?: string;
    didi_food_url?: string;
  };
  reviews_maps: {
    google_maps_url?: string;
    /** Google's write-review form for this place, from google_place_id
     *  (MESITA-2916). The stored maps URL is a `?cid=` link and cannot open
     *  the form. Absent when the payload carries no Google id. */
    google_review_url?: string;
  };

  phone?: string;
};
