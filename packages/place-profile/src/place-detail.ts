// The rich place shape the detail screen renders. `placeRowToDetail`
// (lib/adapters/place-to-detail.ts) maps a consumer-web-get-place row onto
// it; every field is null-safe on the adapter side, so the view never guards
// against a missing column — an empty list simply hides its box.

export type PlaceDetail = {
  /** Description/Actions — false only when this place has opted out of bookings. */
  reservations_enabled?: boolean;
  // Stable identifier — matches public.places.id once the real fetch lands.
  // Used as the key in the localStorage saved-places store, share URLs, and
  // any future per-place persistence.
  id: string;
  // 1. Summary
  name: string;
  category: string;
  price_level: 1 | 2 | 3 | 4;
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
  /** Consumer vote count. Progress toward the Crenup threshold. */
  request_count: number;
  request_threshold: number;
  /** This consumer already voted on this place. */
  requested: boolean;
  /** Derived: listed | requested | enriched. Never a state-per-count. */
  request_lifecycle: "listed" | "requested" | "enriched";

  // 2. Media
  photos: string[];

  // Place tags — the curated taxonomy chips the business selected (cocktails,
  // rooftop, date night, …). Sourced from consumer-get-place's resolved
  // `tags` array, already ordered by sort_order. Chip `label` is English
  // (label_en) until a TMS lands (MESITA-963). `facet` is one of 17 taxonomy
  // groups (payment, vibe, drinks, …) and drives the per-facet chip tint.
  // Empty when the place has none — the Details box renders nothing for tags.
  tags: Array<{
    slug: string;
    label: string;
    facet: string;
  }>;

  // 3. External reputation — the three outside channels the summary reads.
  // Google carries a rating and a count; Facebook and Instagram carry reach.
  google: { rating: number | null; count: number | null };
  facebook: { followers: number | null };
  instagram: { followers: number | null };

  // 4. Google reviews
  google_reviews: Array<{
    author: string;
    rating: number;
    quote: string;
    date: string;
    // Optional dish / dining-room photo attached by the reviewer (Google
    // Maps surfaces these on the review card). Shown as a thumbnail under
    // the truncated quote. photo_aspect drives the container ratio so
    // landscape food shots, square IG-style posts, and portrait/story
    // images all render at their native shape.
    photo_url?: string;
    photo_aspect?: "square" | "portrait" | "landscape";
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
  };

  phone?: string;
};
