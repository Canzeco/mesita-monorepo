// Mock venue data shaped for the venue-detail screen. While /venues/[id]
// is in design-mode, every id resolves to this same fixture and the view
// component reads from `VenueDetail` instead of the leaner `Venue` row
// that the Edge Function will eventually return.
//
// When wiring real data, write an adapter that maps the EF response →
// VenueDetail; the view stays untouched.

export type Tier = "bronze" | "silver" | "gold" | "diamond";

export type VenueDetail = {
  // 1. Summary
  name: string;
  category: string;
  vibe: string;
  price_level: 1 | 2 | 3 | 4;
  distance_km: number;
  walk_minutes: number;
  open_now: boolean;
  opens_at: string;
  closes_at: string;
  timezone: string;
  city: string;
  address: string;
  zone: string;
  short_description: string;
  listing_type: "partner" | "web";
  last_updated_label: string;

  // 2. Media
  photos: string[];

  // 3. Reviews summary
  mesita_reviews: {
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    total: number;
  };
  google: { rating: number; count: number };
  facebook: { rating: number; fans: number };
  instagram: { followers: number; mentions: number };

  // 4. Google reviews
  google_reviews: Array<{
    author: string;
    rating: number;
    quote: string;
    date: string;
  }>;

  // 5. Mesita visitors
  mesita_visitors: Array<{
    name: string;
    handle: string;
    tier: Tier;
    community: string;
    followers: number;
    quote: string;
    food: number;
    service: number;
    ambiance: number;
    value: number;
  }>;

  // 6. Menu — multiple menus per venue (dinner, wine, cocktails, etc.)
  menus: Array<{
    name: string;
    pages: number;
    updated_label: string;
  }>;

  // 7. Promotion
  promo: {
    badge_label: string;
    reward_kind: "cashback" | "discount";
    reward_value: number;
  };

  // 8. Reward by class — welcome bonus + per-tier rewards in one h-scroll.
  // Only one applies to a given user: either the welcome (first visit) or
  // the current_tier card. The other cards are visible for context.
  welcome_discount: {
    value: number;
    subtitle: string;
  };
  promo_matrix: {
    bronze: number;
    silver: number;
    gold: number;
    diamond: number;
    current_tier: Tier;
  };

  // 9. Long description
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

  // 10. Details (Google-Places-style metadata: category, zone, hours, etc.)
  details: {
    category_full: string;
    zone: string;
    participation: string;
    mechanic: string;
  };
  channels: {
    website_url?: string;
    whatsapp_url?: string;
    instagram_url?: string;
    tiktok_url?: string;
    facebook_url?: string;
    x_url?: string;
    youtube_url?: string;
    threads_url?: string;
    reddit_url?: string;
  };
  reservations: {
    opentable_url?: string;
    resy_url?: string;
    uber_eats_url?: string;
    rappi_url?: string;
    didi_food_url?: string;
  };
  reviews_maps: {
    tripadvisor_url?: string;
    google_maps_url?: string;
  };

  phone?: string;
  email?: string;
};

export const mockVenue: VenueDetail = {
  name: "Mochomos Monterrey",
  category: "Mexican",
  vibe: "Elegant",
  price_level: 3,
  distance_km: 2.4,
  walk_minutes: 28,
  open_now: true,
  opens_at: "18:00",
  closes_at: "02:00",
  timezone: "GMT-6",
  city: "Monterrey",
  address:
    "Eje Metropolitano 10 2400, Zona Loma Larga Oriente, 66260 Monterrey, N.L.",
  zone: "Loma Larga Oriente",
  short_description:
    "Experience Sonoran cuisine with a contemporary twist in a luxurious setting.",
  listing_type: "partner",
  last_updated_label: "2 days ago",

  photos: [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&q=80&auto=format&fit=crop",
  ],

  mesita_reviews: {
    food: 5.0,
    service: 4.7,
    ambiance: 5.0,
    overall: 4.8,
    total: 142,
  },
  google: { rating: 4.7, count: 1891 },
  facebook: { rating: 4.6, fans: 11100 },
  instagram: { followers: 23000, mentions: 2800 },

  google_reviews: [
    {
      author: "Andrea V.",
      rating: 5,
      quote:
        "La mejor experiencia de cortes en Monterrey. Servicio impecable y ambiente elegante.",
      date: "2 weeks ago",
    },
    {
      author: "Diego R.",
      rating: 4,
      quote:
        "Cocina sonorense muy bien ejecutada. La carta de vinos es excelente, aunque algo cara.",
      date: "1 month ago",
    },
    {
      author: "Sofía L.",
      rating: 5,
      quote:
        "Vinimos por aniversario. Los cortes están perfectos y el postre cierra de maravilla.",
      date: "1 month ago",
    },
    {
      author: "Mariana T.",
      rating: 5,
      quote:
        "Ambiente de lujo sin perder lo cálido. Vale cada peso para una ocasión especial.",
      date: "2 months ago",
    },
  ],

  mesita_visitors: [
    {
      name: "Valentina R.",
      handle: "@valenrose",
      tier: "gold",
      community: "Tec",
      followers: 126000,
      quote:
        "El mejor ribeye de la ciudad, sin duda. El servicio te hace sentir como en casa.",
      food: 5,
      service: 5,
      ambiance: 5,
      value: 4,
    },
    {
      name: "Lucas M.",
      handle: "@lucasm",
      tier: "gold",
      community: "Stanford",
      followers: 78400,
      quote:
        "Llevé clientes y cerramos la mesa. Ambiente perfecto para negocios o cita especial.",
      food: 5,
      service: 5,
      ambiance: 5,
      value: 4,
    },
    {
      name: "Renata G.",
      handle: "@renatagomez",
      tier: "silver",
      community: "Ibero",
      followers: 42100,
      quote:
        "Sonorense con vista. Pedí la arrachera y no me arrepentí. Postres muy bien.",
      food: 5,
      service: 4,
      ambiance: 5,
      value: 4,
    },
    {
      name: "Andrés P.",
      handle: "@andrespv",
      tier: "diamond",
      community: "Harvard",
      followers: 214000,
      quote:
        "Una de mis paradas obligadas en Monterrey. La cava nunca decepciona.",
      food: 5,
      service: 5,
      ambiance: 5,
      value: 5,
    },
  ],

  menus: [
    {
      name: "Dinner menu",
      pages: 6,
      updated_label: "updated last week",
    },
    {
      name: "Wine list",
      pages: 12,
      updated_label: "updated 2 weeks ago",
    },
    {
      name: "Cocktail list",
      pages: 4,
      updated_label: "updated last week",
    },
  ],

  promo: {
    badge_label: "Verified partner",
    reward_kind: "cashback",
    reward_value: 20,
  },

  welcome_discount: {
    value: 50,
    subtitle: "1 / month · first visit",
  },

  promo_matrix: {
    bronze: 10,
    silver: 10,
    gold: 20,
    diamond: 50,
    current_tier: "gold",
  },

  long_description:
    "Mochomos Monterrey offers a unique dining experience that combines the rich flavors of Sonoran cuisine with a modern atmosphere. Ideal for business lunches or special dinners, the venue features a diverse menu centered around grilled meats, seafood, and an extensive wine selection. Guests appreciate the attentive service and the elegant ambiance, making it a perfect spot for both corporate meetings and social gatherings.",

  hours_table: [
    { day: "Monday", range: "18:00 – 01:00" },
    { day: "Tuesday", range: "18:00 – 01:00" },
    { day: "Wednesday", range: "18:00 – 01:00" },
    { day: "Thursday", range: "18:00 – 02:00" },
    { day: "Friday", range: "18:00 – 02:00" },
    { day: "Saturday", range: "18:00 – 02:00" },
    { day: "Sunday", range: "12:00 – 23:00" },
  ],
  popular_times_featured: "SAT",
  popular_times: [
    {
      day: "MON",
      range: "6p — 1a",
      bars: [0.08, 0.12, 0.18, 0.28, 0.45, 0.65, 0.85, 0.55, 0.25],
    },
    {
      day: "TUE",
      range: "6p — 1a",
      bars: [0.1, 0.14, 0.2, 0.3, 0.48, 0.68, 0.9, 0.58, 0.28],
    },
    {
      day: "WED",
      range: "6p — 1a",
      bars: [0.1, 0.16, 0.22, 0.34, 0.52, 0.72, 0.95, 0.62, 0.3],
    },
    {
      day: "THU",
      range: "6p — 2a",
      bars: [0.12, 0.2, 0.3, 0.45, 0.65, 0.85, 1.0, 0.8, 0.5, 0.3],
    },
    {
      day: "FRI",
      range: "6p — 2a",
      bars: [0.15, 0.25, 0.4, 0.55, 0.75, 0.95, 1.0, 0.9, 0.65, 0.45],
    },
    {
      day: "SAT",
      range: "6p — 2a",
      bars: [0.2, 0.35, 0.5, 0.65, 0.85, 1.0, 0.95, 0.85, 0.7, 0.5],
    },
    {
      day: "SUN",
      range: "12p — 11p",
      bars: [0.3, 0.5, 0.65, 0.55, 0.35, 0.2, 0.15, 0.18, 0.25, 0.1],
    },
  ],

  details: {
    category_full: "Place · Restaurant",
    zone: "Loma Larga Oriente",
    participation: "Partner",
    mechanic: "Cashback (Formal)",
  },
  channels: {
    website_url: "https://www.mochomos.com",
    instagram_url: "https://www.instagram.com/mochomos",
    facebook_url: "https://www.facebook.com/mochomos",
    x_url: "https://x.com/mochomos",
    youtube_url: "https://www.youtube.com/@mochomos",
    whatsapp_url: "https://wa.me/528186470160",
  },
  reservations: {
    opentable_url: "https://www.opentable.com/mochomos-monterrey",
    uber_eats_url: "https://www.ubereats.com/store/mochomos",
    rappi_url: "https://www.rappi.com.mx/restaurantes/mochomos",
  },
  reviews_maps: {
    tripadvisor_url: "https://www.tripadvisor.com/Restaurant_Review-mochomos",
    google_maps_url: "https://maps.google.com/?q=Mochomos+Monterrey",
  },

  phone: "81 8647 0160",
  email: undefined,
};
