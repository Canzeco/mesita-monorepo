import type { MenuKind } from '@/lib/menu-url';

// Rich PlaceDetail — mirrors apps/web-consumer PlaceDetail plus MESITA-560
// menu viewer fields (`menus` with url/kind).

export type ConsumerClassKey = 'standard' | 'premium' | 'influencer' | 'aura';

type PlaceDetailTag = {
  slug: string;
  label: string;
  facet: string;
};

export type PlaceMenuItem = {
  name: string;
  url: string;
  kind: MenuKind;
  pages: number | null;
  updated_label: string;
};

export type PlaceDetail = {
  id: string;
  slug: string;
  name: string;
  category: string;
  vibe: string;
  price_level: 1 | 2 | 3 | 4;
  price_range: string;
  currency: string;
  distance_km: number;
  open_now: boolean;
  opens_at: string;
  closes_at: string;
  timezone: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  zone: string;
  listing_type: 'partner' | 'web';
  /** Relative "Created · …" source (from places.created_at). */
  created_label: string;
  /** Relative "Updated · …" source (enriched_at ?? created_at). */
  updated_label: string;
  /** Alias of updated_label — kept for lean Place / overview callers. */
  last_updated_label: string;
  is_enriching: boolean;
  photos: string[];
  tags: PlaceDetailTag[];
  menus: PlaceMenuItem[];
  mesita_reviews: {
    food: number;
    service: number;
    ambiance: number;
    value: number;
    overall: number;
    total: number;
  };
  google: { rating: number; count: number };
  facebook: { rating: number; followers: number };
  instagram: { followers: number };
  google_reviews: {
    author: string;
    rating: number;
    quote: string;
    date: string;
    photo_url?: string;
    photo_aspect?: 'square' | 'portrait' | 'landscape';
  }[];
  mesita_visitors: {
    name: string;
    handle: string;
    class_key: ConsumerClassKey;
    community: string;
    followers: number;
    quote: string;
    food: number;
    service: number;
    ambiance: number;
    value: number;
    photo_url?: string;
    photo_aspect?: 'square' | 'portrait' | 'landscape';
  }[];
  products: {
    menu: {
      name: string;
      pages: number;
      updated_label: string;
      url?: string;
    }[];
  };
  promo: {
    badge_label: string;
    reward_kind: 'discount';
    reward_value: number;
  };
  promo_matrix: {
    welcome: { free: number | null; premium: number | null };
    default: { free: number | null; premium: number | null };
    is_first_visit: boolean;
  };
  promo_configured?: boolean;
  reward_cap_mxn: number;
  requires_story?: boolean;
  long_description: string;
  long_description_es?: string;
  hours_table: { day: string; range: string }[];
  popular_times: { day: string; range: string; bars: number[] }[];
  popular_times_featured: string;
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
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  is_first_visit: boolean | null;
  pitch: string | null;
  story: string | null;
};
