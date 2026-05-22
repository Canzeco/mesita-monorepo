export const TIER_ORDER = ["bronze", "silver", "gold", "diamond"] as const;
export type Tier = (typeof TIER_ORDER)[number];

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type ExternalReview = {
  source: "google" | "uber" | "facebook" | "instagram";
  value: string;
  meta: string;
};

type VenueVisitor = {
  name: string;
  handle: string;
  followers: string;
  tier: Tier;
  community?: string;
  quote: string;
  avatar: string;
  ratings: { food: number; service: number; atm: number; value: number };
};

type VenueHour = { day: Weekday; label: string; range: string };

type VenueMedia =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

export type Venue = {
  id: string;
  name: string;
  category: string;
  vibe: string;
  priceLevel: 1 | 2 | 3 | 4;
  distanceKm: number;
  walkMinutes: number;
  closesAt: string;
  listingType: "partner" | "web";
  cashbackPercent: number | null;
  rating: number;
  ratingExternal: number;
  externalLabel: string;
  reviewsCount: number;
  photos: string[];
  description: string;
  area: string;
  emoji: string;
  media?: VenueMedia[];
  coupon?: {
    percent: number;
    title: string;
    sub: string;
    status: "active" | "expired";
  };
  externalReviews?: ExternalReview[];
  mesitaReviews?: {
    food: number;
    service: number;
    ambiance: number;
    overall: number;
    total: number;
  };
  visitors?: VenueVisitor[];
  menu?: { pages: number; updated: string };
  hours?: VenueHour[];
  todayLabel?: Weekday;
  popularTimes?: { day: Weekday; note: string; bars: number[] }[];
  contact?: { phone: string; website: string };
  priceRange?: { min: number; max: number; currency: string };
  dressCode?: string;
  payment?: string[];
  parkingInfo?: string;
  access?: string[];
  story?: string;
};

const VENUES: Venue[] = [
  {
    id: "casa-luminar",
    name: "Casa Luminar",
    category: "Mediterranean",
    vibe: "Rooftop",
    priceLevel: 3,
    distanceKm: 0.4,
    walkMinutes: 5,
    closesAt: "2:00am",
    listingType: "partner",
    cashbackPercent: 20,
    rating: 4.9,
    ratingExternal: 4.7,
    externalLabel: "G",
    reviewsCount: 1284,
    photos: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Mediterranean tasting menu on a candle-lit rooftop with sweeping mountain views. Inventive small plates, a deep natural-wine list, and a long late-night vermouth hour.",
    area: "San Pedro",
    emoji: "🌲",
    media: [
      {
        type: "video",
        src: "https://assets.mixkit.co/videos/preview/mixkit-restaurant-with-customers-1170-large.mp4",
        poster:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80&auto=format&fit=crop",
      },
    ],
    coupon: {
      percent: 20,
      title: "20% welcome cashback on your bill",
      sub: "Welcome offer · Covers the first $1,000 of your bill",
      status: "active",
    },
    externalReviews: [
      { source: "google", value: "4.7", meta: "1,284 reviews" },
      { source: "uber", value: "4.8", meta: "2,100 reviews" },
      { source: "facebook", value: "4.7", meta: "312 reviews" },
      { source: "instagram", value: "126k", meta: "3.2k mentions" },
    ],
    mesitaReviews: {
      food: 4.4,
      service: 4.4,
      ambiance: 4.6,
      overall: 4.5,
      total: 129,
    },
    visitors: [
      {
        name: "Valentina R.",
        handle: "@valenrose",
        followers: "126.0k",
        tier: "gold",
        community: "Tec",
        quote: "Best sunset terrace in the city.",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop&crop=faces",
        ratings: { food: 5, service: 5, atm: 5, value: 5 },
      },
      {
        name: "Lucas M.",
        handle: "@lucasm",
        followers: "78.4k",
        tier: "gold",
        community: "Stanford",
        quote: "The DJ set elevates dinner into an event.",
        avatar:
          "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80&auto=format&fit=crop&crop=faces",
        ratings: { food: 5, service: 4, atm: 5, value: 4 },
      },
      {
        name: "Renata G.",
        handle: "@renatagomez",
        followers: "42.1k",
        tier: "silver",
        community: "Ibero",
        quote: "Pastas are house-made and the wine list is real.",
        avatar:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop&crop=faces",
        ratings: { food: 5, service: 5, atm: 4, value: 4 },
      },
    ],
    menu: { pages: 4, updated: "this week" },
    todayLabel: "sat",
    hours: [
      { day: "mon", label: "Mon", range: "Closed" },
      { day: "tue", label: "Tue", range: "7:00pm – 1:00am" },
      { day: "wed", label: "Wed", range: "7:00pm – 1:00am" },
      { day: "thu", label: "Thu", range: "7:00pm – 2:00am" },
      { day: "fri", label: "Fri", range: "7:00pm – 2:00am" },
      { day: "sat", label: "Sat", range: "6:00pm – 2:00am" },
      { day: "sun", label: "Sun", range: "12:00pm – 11:00pm" },
    ],
    popularTimes: [
      {
        day: "mon",
        note: "Closed",
        bars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        day: "tue",
        note: "Usually quiet",
        bars: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 1],
      },
      {
        day: "wed",
        note: "Steady mid-week",
        bars: [0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 2],
      },
      {
        day: "thu",
        note: "Picks up after 10pm",
        bars: [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 5, 4],
      },
      {
        day: "fri",
        note: "Busy from 9pm",
        bars: [0, 0, 0, 0, 0, 0, 0, 2, 4, 5, 5, 4],
      },
      {
        day: "sat",
        note: "Usually a little busy",
        bars: [0, 0, 0, 0, 0, 0, 0, 3, 4, 5, 5, 4],
      },
      {
        day: "sun",
        note: "Long brunch",
        bars: [0, 0, 0, 3, 4, 4, 3, 2, 1, 1, 0, 0],
      },
    ],
    contact: { phone: "444 714 0346", website: "@casaluminar" },
    priceRange: { min: 310, max: 500, currency: "MXN" },
    dressCode: "Smart casual",
    payment: ["Visa", "Mastercard", "AMEX"],
    parkingInfo: "Public parking available",
    access: ["Wheelchair access", "Non-smoking", "Full bar"],
    story:
      "Casa Luminar sits on the 14th-floor rooftop of an old textile building in Roma Norte, with 270° views over the city skyline and Chapultepec park in the distance. Chef Iván Solís — formerly of Pujol and Quintonil — runs a Mediterranean tasting menu anchored in Baja seafood, wood-fired vegetables and house-made pastas, with an optional pairing from a 400-label cellar leaning into low-intervention wines from Valle de Guadalupe and the Mediterranean coast. The room is intimate (42 seats, mostly two- and four-tops at the edge for the view), candlelit, and quiet enough for conversation until the live DJ takes over Thursday through Saturday from 11pm. Open nightly 7pm–1am · reservations strongly recommended, especially for sunset · smart casual · terrace heated year-round.",
  },
  {
    id: "neon-bar",
    name: "Neón Bar",
    category: "Cocktails",
    vibe: "Late night",
    priceLevel: 2,
    distanceKm: 0.4,
    walkMinutes: 6,
    closesAt: "3:00am",
    listingType: "partner",
    cashbackPercent: 20,
    rating: 4.8,
    ratingExternal: 4.4,
    externalLabel: "G",
    reviewsCount: 942,
    photos: [
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80&auto=format&fit=crop",
    ],
    media: [
      {
        type: "video",
        src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        poster:
          "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1200&q=80&auto=format&fit=crop",
      },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200&q=80&auto=format&fit=crop",
      },
    ],
    description:
      "Neon-lit cocktail den with industry favorites at the bar and a vinyl room in the back. Walk-ins only after 11pm.",
    area: "Centro",
    emoji: "🌃",
  },
  {
    id: "mar-verde",
    name: "Mar Verde",
    category: "Seafood",
    vibe: "Date night",
    priceLevel: 3,
    distanceKm: 1.2,
    walkMinutes: 14,
    closesAt: "12:00am",
    listingType: "partner",
    cashbackPercent: 10,
    rating: 4.7,
    ratingExternal: 4.6,
    externalLabel: "G",
    reviewsCount: 612,
    photos: [
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1559847844-5315695dadae?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1535007813616-79dc02ba4021?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Coastal Mexican seafood. Aguachiles, ceviches and a great mezcal-forward bar program right at the water's edge.",
    area: "Valle Oriente",
    emoji: "🌊",
  },
  {
    id: "atelier-nueve",
    name: "Atelier Nueve",
    category: "New American",
    vibe: "Tasting menu",
    priceLevel: 4,
    distanceKm: 2.1,
    walkMinutes: 22,
    closesAt: "11:30pm",
    listingType: "web",
    cashbackPercent: null,
    rating: 4.9,
    ratingExternal: 4.8,
    externalLabel: "G",
    reviewsCount: 318,
    photos: [
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1574484284002-952d92456975?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Nine-course tasting from a chef-driven counter. Reservations only — no walk-ins, no cashback.",
    area: "Loma Larga",
    emoji: "✨",
  },
  {
    id: "loto-cafe",
    name: "Loto Café",
    category: "Café",
    vibe: "Brunch",
    priceLevel: 1,
    distanceKm: 0.8,
    walkMinutes: 9,
    closesAt: "6:00pm",
    listingType: "partner",
    cashbackPercent: 10,
    rating: 4.6,
    ratingExternal: 4.5,
    externalLabel: "G",
    reviewsCount: 420,
    photos: [
      "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Specialty coffee from rotating Latin American roasters, with a tight all-day brunch menu and natural-light corner seating.",
    area: "San Pedro",
    emoji: "☕",
  },
  {
    id: "taqueria-cruz",
    name: "Taquería Cruz",
    category: "Tacos",
    vibe: "Casual",
    priceLevel: 1,
    distanceKm: 1.6,
    walkMinutes: 18,
    closesAt: "1:00am",
    listingType: "partner",
    cashbackPercent: 10,
    rating: 4.8,
    ratingExternal: 4.7,
    externalLabel: "G",
    reviewsCount: 2104,
    photos: [
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Three generations of trompo. Pastor, suadero and a salsa bar that runs the line. Open until close.",
    area: "Centro",
    emoji: "🌮",
  },
  {
    id: "sala-trece",
    name: "Sala Trece",
    category: "Pizza",
    vibe: "Pizza bar",
    priceLevel: 2,
    distanceKm: 0.9,
    walkMinutes: 11,
    closesAt: "12:00am",
    listingType: "partner",
    cashbackPercent: 5,
    rating: 4.5,
    ratingExternal: 4.4,
    externalLabel: "G",
    reviewsCount: 287,
    photos: [
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1593504049359-74330189a345?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "Neapolitan pizza with sourdough crust, Italian wines by the glass and a tiny terrace for two.",
    area: "Garza García",
    emoji: "🍕",
  },
  {
    id: "cielo",
    name: "Cielo",
    category: "Mediterranean",
    vibe: "Rooftop",
    priceLevel: 3,
    distanceKm: 1.4,
    walkMinutes: 16,
    closesAt: "1:00am",
    listingType: "web",
    cashbackPercent: null,
    rating: 4.7,
    ratingExternal: 4.6,
    externalLabel: "G",
    reviewsCount: 412,
    photos: [
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
    ],
    description:
      "All-day Mediterranean from a converted warehouse. Tile floors, olive trees, late dinner crowd.",
    area: "San Pedro",
    emoji: "🌿",
  },
];

export type StepKey = "R" | "P" | "S" | "C";

type SavedItemState = "arrive" | "calling" | "booking" | "show-qr";

export type SavedItem = {
  id: string;
  venueId: string;
  steps: StepKey[];
  badgeTone: "pink" | "magenta" | "gold" | "solid-pink";
  state: SavedItemState;
  totalDots: number;
  doneDots: number;
  cashback: number | null;
  cashbackTone?: "pink" | "gold";
  cashbackLabel?: string;
  callingNote?: string;
  when?: string;
  partySize?: number;
  cashbackCap?: number;
  reservationStatus?: "pending" | "confirmed";
};

export const RESERVATIONS: SavedItem[] = [
  {
    id: "r-1",
    venueId: "mar-verde",
    steps: ["R", "P", "C"],
    badgeTone: "pink",
    state: "arrive",
    totalDots: 7,
    doneDots: 1,
    cashback: 10,
    cashbackTone: "pink",
    when: "Fri May 16 · 8:00 PM",
    partySize: 2,
    cashbackCap: 800,
    reservationStatus: "confirmed",
  },
  {
    id: "r-2",
    venueId: "neon-bar",
    steps: ["R", "P", "S", "C"],
    badgeTone: "magenta",
    state: "calling",
    totalDots: 10,
    doneDots: 0,
    cashback: 20,
    cashbackTone: "pink",
    callingNote: "AI calling venue · expect a call in ~3 min to confirm",
    when: "Fri May 16 · 9:30 PM",
    partySize: 4,
    cashbackCap: 1000,
    reservationStatus: "pending",
  },
  {
    id: "r-3",
    venueId: "casa-luminar",
    steps: ["R", "P", "S", "C"],
    badgeTone: "gold",
    state: "arrive",
    totalDots: 10,
    doneDots: 2,
    cashback: 20,
    cashbackTone: "pink",
    when: "Sat May 17 · 8:30 PM",
    partySize: 4,
    cashbackCap: 1500,
    reservationStatus: "confirmed",
  },
  {
    id: "r-4",
    venueId: "atelier-nueve",
    steps: ["R"],
    badgeTone: "solid-pink",
    state: "booking",
    totalDots: 2,
    doneDots: 0,
    cashback: null,
    when: "Sun May 25 · 7:00 PM",
    partySize: 2,
    reservationStatus: "pending",
  },
];

export const COUPONS: SavedItem[] = [
  {
    id: "c-1",
    venueId: "mar-verde",
    steps: ["R", "P", "C"],
    badgeTone: "pink",
    state: "arrive",
    totalDots: 7,
    doneDots: 1,
    cashback: 10,
    cashbackTone: "pink",
    when: "Fri May 16 · 8:00 PM",
    partySize: 2,
    cashbackCap: 800,
    reservationStatus: "confirmed",
  },
  {
    id: "c-2",
    venueId: "neon-bar",
    steps: ["R", "P", "S", "C"],
    badgeTone: "magenta",
    state: "calling",
    totalDots: 10,
    doneDots: 0,
    cashback: 20,
    cashbackTone: "pink",
    callingNote: "AI calling venue · expect a call in ~3 min to confirm",
    when: "Fri May 16 · 9:30 PM",
    partySize: 4,
    cashbackCap: 1000,
    reservationStatus: "pending",
  },
  {
    id: "c-3",
    venueId: "casa-luminar",
    steps: ["P", "S", "C"],
    badgeTone: "gold",
    state: "show-qr",
    totalDots: 9,
    doneDots: 3,
    cashback: 20,
    cashbackTone: "gold",
    cashbackLabel: "WELCOME",
    cashbackCap: 1500,
  },
  {
    id: "c-4",
    venueId: "loto-cafe",
    steps: ["P", "C"],
    badgeTone: "pink",
    state: "show-qr",
    totalDots: 6,
    doneDots: 2,
    cashback: 10,
    cashbackTone: "pink",
    cashbackCap: 500,
  },
  {
    id: "c-5",
    venueId: "cielo",
    steps: ["R"],
    badgeTone: "solid-pink",
    state: "arrive",
    totalDots: 2,
    doneDots: 1,
    cashback: null,
    when: "Fri May 16 · 9:30 PM",
    partySize: 4,
    reservationStatus: "confirmed",
  },
  {
    id: "c-6",
    venueId: "loto-cafe",
    steps: ["P", "C"],
    badgeTone: "pink",
    state: "show-qr",
    totalDots: 6,
    doneDots: 1,
    cashback: 10,
    cashbackTone: "pink",
    cashbackCap: 500,
  },
];

export const AI_SUGGESTIONS = [
  "Rooftop with a sunset view",
  "Romantic dinner in Polanco",
  "Sunday family brunch",
  "Mezcal and vinyl after midnight",
  "Most fashionable club in San Pedro",
  "Famous Luis Miguel spot in Acapulco",
];

// Country list — used both by the Country residence dropdown and the
// phone-input dial-code picker. Ordered roughly by hospitality relevance:
// Mexico first (the home market), Latam + Iberian world next, then a
// short tail of common origin countries. `dial` is the E.164 country
// calling code (no leading "+"); the picker re-adds the plus visually.
export type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
};
export const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "52" },
  { code: "US", name: "United States", flag: "🇺🇸", dial: "1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dial: "1" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dial: "34" },
  // LatAm core — Mesita's natural expansion path.
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "54" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "57" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "56" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dial: "51" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "55" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dial: "598" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dial: "595" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dial: "591" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dial: "593" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "58" },
  // Central America + Caribbean — second-wave markets.
  { code: "GT", name: "Guatemala", flag: "🇬🇹", dial: "502" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", dial: "504" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", dial: "503" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", dial: "505" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", dial: "506" },
  { code: "PA", name: "Panama", flag: "🇵🇦", dial: "507" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", dial: "1" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", dial: "1" },
  // Common visitor origins.
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", dial: "44" },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dial: "39" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dial: "49" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dial: "31" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dial: "351" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dial: "81" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dial: "61" },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

// How the current tier was granted. The Class tab shows different copy
// depending on origin (e.g. "earned via 7.3K Instagram followers" vs
// "subscribed · renews Dec 12"), and `subscription` is the only origin
// that allows a downgrade/cancel action.
type TierOrigin = "default" | "instagram" | "subscription" | "appeal";

// Mock guest used by the Profile + Discover header until real guest-side
// reads are wired up. Only carries the fields the UI actually reads — name,
// city, joined-at, etc. were leftovers from the original Lovable export
// and never consumed in the current build.
export const CURRENT_USER = {
  tier: "gold" as Tier,
  tierOrigin: "instagram" as TierOrigin,
  /** Only meaningful when `tierOrigin === "subscription"`. ISO date string. */
  tierRenewsAt: null as string | null,
  balance: 1284,
  followers: 7320,
};

export const TIERS: {
  id: Tier;
  label: string;
  req: string;
  /** Monthly subscription price in MXN. 0 for Bronze (the default tier).
   *  Granted upfront — no spend accumulation required. */
  priceMxn: number;
  cashback: string;
  perk: string;
}[] = [
  // The tier IS the brand — rendered as "Mesita Bronze" / "Mesita Silver"
  // / "Mesita Gold" / "Mesita Diamond" in marketing and subscribe surfaces.
  // The compact `label` here is used inside tight UI (tier badges, table
  // rows) where the "Mesita" prefix would just add noise.
  {
    id: "bronze",
    label: "Bronze",
    req: "Default · no IG or under 1K followers",
    priceMxn: 0,
    cashback: "Base cashback",
    perk: "Welcome to the club",
  },
  {
    id: "silver",
    label: "Silver",
    req: "1K+ followers · or $200 MXN / mo",
    priceMxn: 200,
    cashback: "More cashback",
    perk: "Insider perks",
  },
  {
    id: "gold",
    label: "Gold",
    req: "5K+ followers · or $500 MXN / mo",
    priceMxn: 500,
    cashback: "Even more cashback",
    perk: "Priority access",
  },
  {
    id: "diamond",
    label: "Diamond",
    req: "20K+ followers · or $1,000 MXN / mo · or appeal",
    priceMxn: 1000,
    cashback: "Most cashback",
    perk: "VIP · private events",
  },
];

type Transaction = {
  id: string;
  venueId: string;
  amount: number;
  when: string;
  expires?: string;
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: "t-1",
    venueId: "casa-luminar",
    amount: 140,
    when: "2 days ago",
    expires: "88d",
  },
  { id: "t-2", venueId: "neon-bar", amount: -380, when: "5 days ago" },
  {
    id: "t-3",
    venueId: "loto-cafe",
    amount: 180,
    when: "1 week ago",
    expires: "83d",
  },
  { id: "t-4", venueId: "mar-verde", amount: -260, when: "2 weeks ago" },
  {
    id: "t-5",
    venueId: "casa-luminar",
    amount: 90,
    when: "3 weeks ago",
    expires: "69d",
  },
];

// 50 themed achievements grouped by category. Each one has its own
// criterion + display tone — the Profile Game tab uses the `category` to
// pick the badge color and icon, so a "spend" achievement looks visually
// different from a "story" achievement.
export type AchievementCategory =
  | "visit"
  | "spend"
  | "cashback"
  | "streak"
  | "variety"
  | "community"
  | "story"
  | "tier"
  | "time"
  | "category"
  | "reservation"
  | "social"
  | "special";

export type Achievement = {
  id: string;
  label: string;
  description: string;
  category: AchievementCategory;
  unlocked: boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ── Visits ──
  {
    id: "v-first",
    label: "First step",
    description: "Your first visit on Mesita.",
    category: "visit",
    unlocked: true,
  },
  {
    id: "v-5",
    label: "Regular",
    description: "Visited 5 times.",
    category: "visit",
    unlocked: true,
  },
  {
    id: "v-10",
    label: "Insider",
    description: "Visited 10 times.",
    category: "visit",
    unlocked: true,
  },
  {
    id: "v-25",
    label: "Familiar face",
    description: "Visited 25 times.",
    category: "visit",
    unlocked: true,
  },
  {
    id: "v-50",
    label: "Local",
    description: "Visited 50 times.",
    category: "visit",
    unlocked: false,
  },
  {
    id: "v-100",
    label: "Mayor",
    description: "Visited 100 times.",
    category: "visit",
    unlocked: false,
  },

  // ── Spend ──
  {
    id: "s-500",
    label: "Opening tab",
    description: "First MX$500 spent.",
    category: "spend",
    unlocked: true,
  },
  {
    id: "s-1k",
    label: "Comfortable",
    description: "MX$1,000 spent.",
    category: "spend",
    unlocked: true,
  },
  {
    id: "s-5k",
    label: "Big spender",
    description: "MX$5,000 spent.",
    category: "spend",
    unlocked: true,
  },
  {
    id: "s-20k",
    label: "High roller",
    description: "MX$20,000 spent.",
    category: "spend",
    unlocked: false,
  },
  {
    id: "s-100k",
    label: "Whale",
    description: "MX$100,000 spent.",
    category: "spend",
    unlocked: false,
  },

  // ── Cashback earned ──
  {
    id: "c-first",
    label: "First reward",
    description: "Earned your first cashback.",
    category: "cashback",
    unlocked: true,
  },
  {
    id: "c-100",
    label: "MX$100 back",
    description: "Earned MX$100 cashback.",
    category: "cashback",
    unlocked: true,
  },
  {
    id: "c-500",
    label: "MX$500 back",
    description: "Earned MX$500 cashback.",
    category: "cashback",
    unlocked: false,
  },
  {
    id: "c-1k",
    label: "MX$1K back",
    description: "Earned MX$1,000 cashback.",
    category: "cashback",
    unlocked: false,
  },

  // ── Streaks ──
  {
    id: "st-2w",
    label: "Two weeks",
    description: "2-week visit streak.",
    category: "streak",
    unlocked: true,
  },
  {
    id: "st-4w",
    label: "Month strong",
    description: "4-week visit streak.",
    category: "streak",
    unlocked: false,
  },
  {
    id: "st-10w",
    label: "Loyal",
    description: "10-week visit streak.",
    category: "streak",
    unlocked: false,
  },

  // ── Variety ──
  {
    id: "va-3",
    label: "Explorer",
    description: "Visited 3 different venues.",
    category: "variety",
    unlocked: true,
  },
  {
    id: "va-10",
    label: "Tasted around",
    description: "Visited 10 different venues.",
    category: "variety",
    unlocked: true,
  },
  {
    id: "va-25",
    label: "Foodie",
    description: "Visited 25 different venues.",
    category: "variety",
    unlocked: false,
  },
  {
    id: "va-50",
    label: "Tour guide",
    description: "Visited 50 different venues.",
    category: "variety",
    unlocked: false,
  },
  {
    id: "va-100",
    label: "Connoisseur",
    description: "Visited 100 different venues.",
    category: "variety",
    unlocked: false,
  },

  // ── Communities ──
  {
    id: "co-first",
    label: "Verified",
    description: "Joined your first community.",
    category: "community",
    unlocked: true,
  },
  {
    id: "co-3",
    label: "Triple alumna",
    description: "Verified in 3 communities.",
    category: "community",
    unlocked: false,
  },

  // ── Stories ──
  {
    id: "sy-first",
    label: "First post",
    description: "Posted your first venue story.",
    category: "story",
    unlocked: true,
  },
  {
    id: "sy-10",
    label: "Storyteller",
    description: "Posted 10 stories.",
    category: "story",
    unlocked: false,
  },
  {
    id: "sy-50",
    label: "Influencer",
    description: "Posted 50 stories.",
    category: "story",
    unlocked: false,
  },

  // ── Tier ──
  {
    id: "t-silver",
    label: "Mesita Silver",
    description: "Reached Mesita Silver.",
    category: "tier",
    unlocked: true,
  },
  {
    id: "t-gold",
    label: "Mesita Gold",
    description: "Reached Mesita Gold.",
    category: "tier",
    unlocked: false,
  },
  {
    id: "t-diamond",
    label: "Mesita Diamond",
    description: "Reached Mesita Diamond.",
    category: "tier",
    unlocked: false,
  },

  // ── Time of day ──
  {
    id: "tm-late",
    label: "Night owl",
    description: "Visited after 1 AM.",
    category: "time",
    unlocked: true,
  },
  {
    id: "tm-brunch",
    label: "Brunch regular",
    description: "5 brunch visits.",
    category: "time",
    unlocked: false,
  },
  {
    id: "tm-happy",
    label: "Happy hour fan",
    description: "5 happy-hour visits.",
    category: "time",
    unlocked: false,
  },

  // ── Category ──
  {
    id: "cat-bar",
    label: "First bar",
    description: "Visited a bar.",
    category: "category",
    unlocked: true,
  },
  {
    id: "cat-cafe",
    label: "First café",
    description: "Visited a café.",
    category: "category",
    unlocked: true,
  },
  {
    id: "cat-rest",
    label: "First restaurant",
    description: "Visited a restaurant.",
    category: "category",
    unlocked: false,
  },
  {
    id: "cat-club",
    label: "First nightclub",
    description: "Visited a nightclub.",
    category: "category",
    unlocked: false,
  },
  {
    id: "cat-roof",
    label: "First rooftop",
    description: "Visited a rooftop.",
    category: "category",
    unlocked: false,
  },

  // ── Reservations ──
  {
    id: "r-first",
    label: "First booking",
    description: "Booked your first AI reservation.",
    category: "reservation",
    unlocked: true,
  },
  {
    id: "r-10",
    label: "Frequent booker",
    description: "10 reservations made.",
    category: "reservation",
    unlocked: false,
  },
  {
    id: "r-50",
    label: "Power planner",
    description: "50 reservations made.",
    category: "reservation",
    unlocked: false,
  },

  // ── Social ──
  {
    id: "so-friend",
    label: "Friend invited",
    description: "Invited a friend to Mesita.",
    category: "social",
    unlocked: true,
  },
  {
    id: "so-code",
    label: "Creator code",
    description: "Redeemed a creator code.",
    category: "social",
    unlocked: false,
  },

  // ── Special ──
  {
    id: "sp-bday",
    label: "Birthday visit",
    description: "Visited during your birthday week.",
    category: "special",
    unlocked: false,
  },
  {
    id: "sp-val",
    label: "Valentine",
    description: "Visited on Valentine's Day.",
    category: "special",
    unlocked: false,
  },
  {
    id: "sp-madre",
    label: "Día de la Madre",
    description: "Visited on Día de la Madre.",
    category: "special",
    unlocked: false,
  },
  {
    id: "sp-yearend",
    label: "Year-end",
    description: "Visited between Dec 24–31.",
    category: "special",
    unlocked: false,
  },

  // ── Diamond perks ──
  {
    id: "d-invite",
    label: "Diamond invite",
    description: "Accepted your Diamond invitation.",
    category: "tier",
    unlocked: false,
  },
  {
    id: "d-perk",
    label: "Diamond perk",
    description: "Used a Diamond-only perk.",
    category: "tier",
    unlocked: false,
  },
];

export function venueById(id: string): Venue | undefined {
  return VENUES.find((v) => v.id === id);
}

// Canonical bg + text class per tier. Used wherever a tier needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
export function tierBadgeClass(tier: Tier): string {
  switch (tier) {
    case "bronze":
      return "bg-tier-bronze text-white";
    case "silver":
      return "bg-tier-silver text-zinc-900";
    case "gold":
      return "bg-tier-gold text-black";
    case "diamond":
      return "bg-tier-diamond text-white";
  }
}

// ─── Saved venues (mock) ─────────────────────────────────────────────────
//
// Bookmarks created by the guest's plain "Save" action on a venue card.
// Shape matches the production `Venue` type so VenueCatalogCard can render
// these unmodified. Two verified-partner venues (cashback / discount
// badges) plus two web-listed venues (no badge) so the contextual badge
// logic on /saved is visible.
//
// TODO: replace with `guest-list-saved-venues` edge function once the
// guest_saved_venues table + EF land. Client calls the EF, never the DB
// directly — see api/venues.ts for the existing pattern.

import type { Venue as PublicVenue } from "@/lib/api/venues";

export const SAVED_VENUES: PublicVenue[] = [
  {
    id: "casa-luminar",
    slug: "casa-luminar",
    name: "Casa Luminar",
    category: "Mediterranean",
    vibe: "Rooftop",
    price_level: 3,
    listing_type: "partner",
    status: "active",
    fiscal_type: "formal",
    plan: "formal_pro",
    lat: 25.6515,
    lng: -100.291,
    address: "San Pedro Garza García",
    closes_at: "02:00",
    phone: null,
    pitch: "Mediterranean tasting menu on a candle-lit rooftop.",
    story: null,
    cashback_percent: 20,
    photos: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
    ],
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "brasero",
    slug: "brasero",
    name: "Brasero del Sur",
    category: "Argentine",
    vibe: "Smoky · cellar",
    price_level: 3,
    listing_type: "partner",
    status: "active",
    fiscal_type: "informal",
    plan: "informal_pro",
    lat: 25.665,
    lng: -100.317,
    address: "Centrito Valle",
    closes_at: "01:00",
    phone: null,
    pitch: "Wood-fired Argentine grill with a 200-label cellar.",
    story: null,
    cashback_percent: 15,
    photos: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80&auto=format&fit=crop",
    ],
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: "2026-05-03T00:00:00Z",
  },
  {
    id: "kaffe-aurelio",
    slug: "kaffe-aurelio",
    name: "Kaffe Aurelio",
    category: "Specialty coffee",
    vibe: "Light · airy",
    price_level: 2,
    listing_type: "web",
    status: "active",
    fiscal_type: "formal",
    plan: "free",
    lat: 25.671,
    lng: -100.327,
    address: "Obispado",
    closes_at: "20:00",
    phone: null,
    pitch: null,
    story: null,
    cashback_percent: null,
    photos: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80&auto=format&fit=crop",
    ],
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: "2026-05-09T00:00:00Z",
  },
  {
    id: "tapanco-9",
    slug: "tapanco-9",
    name: "Tapanco 9",
    category: "Modern Mexican",
    vibe: "Cosy · industrial",
    price_level: 2,
    listing_type: "web",
    status: "active",
    fiscal_type: "formal",
    plan: "free",
    lat: 25.658,
    lng: -100.305,
    address: "Del Valle",
    closes_at: "23:30",
    phone: null,
    pitch: null,
    story: null,
    cashback_percent: null,
    photos: [
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop",
    ],
    website_url: null,
    instagram_url: null,
    tiktok_url: null,
    facebook_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    rappi_url: null,
    x_url: null,
    youtube_url: null,
    threads_url: null,
    reddit_url: null,
    didi_food_url: null,
    tripadvisor_url: null,
    google_maps_url: null,
    email: null,
    created_at: "2026-05-12T00:00:00Z",
  },
];
