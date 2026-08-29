// Mock place data shaped for the place-detail screen. While /places/[id]
// is in design-mode, every id resolves to this same fixture and the view
// component reads from `PlaceDetail` instead of the leaner `Place` row
// that the Edge Function will eventually return.
//
// When wiring real data, write an adapter that maps the EF response →
// PlaceDetail; the view stays untouched.

import type { ClassKey } from "@/lib/consumer-data";

/** @deprecated Prefer `ClassKey` from `@/lib/consumer-data` — alias kept for call sites. */
export type ConsumerClass = ClassKey;

export type PlaceDetail = {
  /** Server-computed per request (MESITA-1150): a guest gets a discount here
   *  RIGHT NOW. The gate every reward surface reads — `listing_type` is the
   *  stale collapsed enum and no longer decides anything a guest sees. */
  promoting?: boolean | null;
  /** Server-computed per request: this place PAYS Mesita. See Place.partner. */
  partner?: boolean | null;
  // Stable identifier — matches public.places.id once the real fetch lands.
  // Used as the key in the localStorage saved-places store, share URLs, and
  // any future per-place persistence.
  id: string;
  // 1. Summary
  name: string;
  category: string;
  vibe: string;
  price_level: 1 | 2 | 3 | 4;
  // Actual per-person price range. Quick-view surfaces (swipe / catalog
  // / map) keep using price_level rendered as $-symbols; the place
  // detail page renders price_range so users can see real numbers.
  // Pre-formatted with the currency prefix (e.g. "MX$200–300") to
  // match what the place's currency column dictates.
  price_range: string;
  // ISO 4217 code mirroring public.places.currency (default MXN).
  // Carried through so future surfaces can render dynamic prefixes
  // without parsing price_range.
  currency: string;
  distance_km: number;
  open_now: boolean;
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
  listing_type: "partner" | "web";
  /** Relative "Created · …" source (from places.created_at). */
  created_label: string;
  /** Relative "Updated · …" source (enriched_at ?? created_at). */
  updated_label: string;
  /** Alias of updated_label — kept for lean Place / overview callers. */
  last_updated_label: string;
  // True while the Intaker is still building this place's profile across the
  // FULL pipeline (research → analysis → contents). Driven by
  // projects.content_status ∈ {queued, generating} — stays generating until
  // contents lands ready (MESITA-453). Drives the header "(Enriching)" badge.
  is_enriching: boolean;
  /** Viewable profile (content_status ready). Ugly Create profiles are ready. */
  is_profile_ready: boolean;
  /** Intaker finished (`places.enriched_at`). False → Enrich vote tab. */
  is_enriched: boolean;
  /** Consumer vote count. Progress toward the Intake threshold. */
  request_count: number;
  request_threshold: number;
  /** This consumer already voted on this place. */
  requested: boolean;
  /** Derived: listed | requested | enriched. Never a status-per-count. */
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

  // 3. Reviews summary
  mesita_reviews: {
    food: number;
    service: number;
    ambience: number;
    value: number;
    overall: number;
    total: number;
  };
  google: { rating: number; count: number };
  facebook: { rating: number; followers: number };
  instagram: { followers: number };

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

  // 5. Mesita visitors
  mesita_visitors: Array<{
    name: string;
    handle: string;
    class_key: ConsumerClass;
    community: string;
    followers: number;
    quote: string;
    food: number;
    service: number;
    ambience: number;
    value: number;
    // Optional photo uploaded by the visitor (Instagram-story style for
    // Mesita). Same surfacing pattern as Google reviews. photo_aspect
    // controls the thumbnail's container ratio so portrait stories,
    // landscape dining shots, and square food photos render natively.
    photo_url?: string;
    photo_aspect?: "square" | "portrait" | "landscape";
  }>;

  // 6. Menus (stored under `products`) — for restaurants the menu lives
  // under products.menu. `url` is the Storage public URL or Drive share link;
  // `kind` drives the in-app viewer (image / PDF / Drive preview).
  products: {
    menu: Array<{
      name: string;
      url: string;
      kind: "image" | "pdf" | "drive";
      pages: number | null;
      updated_label: string;
    }>;
  };

  // 7. Promotion — strategy identity, the four per-class promo columns mirroring
  // mesita-supabase migration 0032 / public.places. NOT prices (MESITA-1019):
  // the engine matches this tuple against its strategy presets, and the
  // percentage a guest is quoted comes from consumer-web-get-discount-quote.
  // Read them to decide WHETHER a place rewards, never by how much.
  promo_matrix: {
    welcome: {
      free: number | null;
      premium: number | null;
    };
    default: {
      free: number | null;
      premium: number | null;
    };
  };
  /** Business set per-tier rates on the Promos page (not scraped legacy percent). */
  promo_configured?: boolean;
  reward_cap_mxn: number;
  // When true, the reward unlocks only after the guest posts an Instagram
  // story tagging the place (in addition to paying via QR). Drives the
  // "Pay & Post" vs "Pay" CTA on the place Reward box.
  requires_story?: boolean;

  // 8. Long description — English (Mesita core). Spanish TMS later.
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
  popular_times_featured: string; // day name to show in the Popular times card

  // 9. Details (Google-Places-style metadata: category, zone, hours, etc.)
  // Most of the extra fields below mirror what Google's Places panel
  // and OpenTable surface on their detail views — dining style, dress
  // code, parking, accessibility, amenities, executive chef. Optional
  // OpenTable extras land here too (reservations, payment methods,
  // kid/pet friendliness).
  details: {
    category_full: string;
    zone: string;
    dining_style: string;
    dress_code: string;
    service_options: string[];
    reservations: string;
    payment_methods: string[];
    parking: string;
    amenities: string[];
    accessibility: string[];
    dietary_options: string[];
    good_for: string[];
    languages: string[];
    kid_friendly?: boolean;
    pet_friendly?: boolean;
    established_year?: number;
    executive_chef?: string;
    participation: string;
    mechanic: string;
  };
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
  email?: string;
};
