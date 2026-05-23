export type Tier = "bronze" | "silver" | "gold" | "diamond";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type ExternalReview = {
  source: "google" | "uber" | "facebook" | "instagram";
  value: string;
  meta: string;
};

export type VenueVisitor = {
  name: string;
  handle: string;
  followers: string;
  tier: Tier;
  community?: string;
  quote: string;
  avatar: string;
  ratings: { food: number; service: number; atm: number; value: number };
};

export type VenueHour = { day: Weekday; label: string; range: string };

export type VenueMedia =
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


export type StepKey = "R" | "P" | "S" | "C";

export type SavedItemState = "arrive" | "calling" | "booking" | "show-qr";

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

export type TicketTypeKey = "R" | "PC" | "RPC" | "PSC" | "RPSC";

export function ticketType(steps: StepKey[]): TicketTypeKey {
  return steps.join("") as TicketTypeKey;
}

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

export type TierMeta = {
  id: Tier;
  label: string;
  req: string;
  /** Monthly subscription price in MXN. 0 for Bronze (the default tier).
   *  Granted upfront — no spend accumulation required. */
  priceMxn: number;
  cashback: string;
  perk: string;
};

export const TIERS: TierMeta[] = [
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

export function tierBadgeClass(tier: Tier): string {
  switch (tier) {
    case "bronze":
      return "bg-tier-bronze text-black";
    case "silver":
      return "bg-tier-silver text-black";
    case "gold":
      return "bg-tier-gold text-black";
    case "diamond":
      return "bg-tier-diamond text-black";
  }
}
