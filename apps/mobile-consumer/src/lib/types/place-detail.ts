// Lean PlaceDetail for mobile — subset of web PlaceDetail focused on
// summary + Place/Rewards tabs. Full adapter can grow when Reviews/Products land.

export type PlaceDetailTag = {
  slug: string;
  label: string;
  facet: string;
};

export type PlaceDetail = {
  id: string;
  slug: string;
  name: string;
  category: string;
  vibe: string;
  price_level: number | null;
  price_range: string | null;
  currency: string;
  address: string;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  listing_type: 'partner' | 'web';
  open_now: boolean | null;
  opens_at: string | null;
  closes_at: string | null;
  photos: string[];
  pitch: string | null;
  story: string | null;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  whatsapp_url: string | null;
  google_rating: number | null;
  google_count: number | null;
  instagram_followers: number | null;
  tags: PlaceDetailTag[];
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  is_first_visit: boolean | null;
};
