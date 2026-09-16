// THE DATABASE. Four places, and everything that hangs off them.
//
// ── EVERY NAME HERE IS INVENTED, ON PURPOSE ────────────────────────────────
//
// Not one of these is a real venue, a real person or a real phone number, and
// none of them should ever become one. The rule that produced this file is the
// same one that keeps mock data OUT of the real console: an operator who sees
// a plausible restaurant on a screen assumes it is theirs. Here the frame is
// the protection — the app wears a MOCK banner and answers on :3006 — so the
// data may be plausible, but it stays fictional, and the photos are generated
// gradients rather than pictures of anywhere.
//
// The numbers are chosen to be READ, not to be round: a revenue column of
// 1000 / 2000 / 3000 tells a reviewer nothing about how the column handles a
// wide value, and a rating of exactly 4.5 everywhere hides the half-star.
import type {
  MockActivityEvent,
  MockCreditBalance,
  MockCustomer,
  MockMember,
  MockMenu,
  MockOrder,
  MockDay,
  MockPlace,
  MockPlaceProfile,
  MockPoolPlace,
  MockReservation,
  MockReview,
  MockVisit,
} from "@/mock/types";

/** A place's photo, as a data URI.
 *
 *  Deterministic, offline, and obviously not a photograph. A remote image
 *  would make the mock depend on a network it has no other reason to touch,
 *  and the first time it failed it would look like a bug in the gallery. */
function gradient(from: string, to: string, glyph: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="320" fill="url(#g)"/>` +
    `<text x="160" y="200" font-family="Georgia,serif" font-size="140" ` +
    `fill="rgba(255,255,255,0.92)" text-anchor="middle">${glyph}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PLACES: MockPlace[] = [
  {
    id: "plc_lumbre",
    name: "Lumbre y Sal",
    photoUrl: gradient("#fb2b7b", "#7b0f3c", "L"),
    category: "Restaurant",
    street: "Av. Vasconcelos 1204, Del Valle",
    city: "San Pedro Garza García",
    phone: "+52 81 5555 0142",
    website: "lumbreysal.example",
    myRole: "owner",
    verified: true,
    partnered: true,
    promoting: true,
    pickupOrders: true,
    deliveryOrders: false,
    reservations: true,
    visitRewards: true,
    credits: true,
    pay: "enabled",
    rating: 4.7,
    reviewCount: 218,
    photoCount: 8,
    menuCount: 3,
  },
  {
    id: "plc_pardo",
    name: "Café Pardo",
    photoUrl: gradient("#f0a24a", "#8a3d12", "P"),
    category: "Café",
    street: "Calle Morelos 88, Centro",
    city: "Monterrey",
    phone: "+52 81 5555 0197",
    website: "cafepardo.example",
    myRole: "owner",
    verified: true,
    partnered: false,
    promoting: false,
    pickupOrders: true,
    deliveryOrders: true,
    reservations: false,
    visitRewards: false,
    credits: false,
    pay: "started",
    rating: 4.3,
    reviewCount: 61,
    photoCount: 5,
    menuCount: 1,
  },
  {
    id: "plc_hoja",
    name: "Hoja Verde",
    photoUrl: gradient("#3fb98a", "#0d4a37", "H"),
    category: "Bar",
    street: "Río Danubio 415, Del Valle",
    city: "San Pedro Garza García",
    phone: "+52 81 5555 0163",
    website: "hojaverde.example",
    myRole: "editor",
    verified: true,
    partnered: true,
    promoting: false,
    pickupOrders: false,
    deliveryOrders: false,
    reservations: true,
    visitRewards: true,
    credits: false,
    pay: "pending",
    rating: 4.1,
    reviewCount: 37,
    photoCount: 2,
    menuCount: 2,
  },
  {
    id: "plc_norte",
    name: "Panadería Norte",
    photoUrl: gradient("#6f7ae8", "#241f6b", "N"),
    category: "Bakery",
    street: "Blvd. Díaz Ordaz 700, Santa María",
    city: "Monterrey",
    phone: "+52 81 5555 0118",
    website: "panaderianorte.example",
    myRole: "viewer",
    verified: false,
    partnered: false,
    promoting: false,
    pickupOrders: false,
    deliveryOrders: false,
    reservations: false,
    visitRewards: false,
    credits: false,
    pay: "never",
    rating: 3.8,
    reviewCount: 12,
    photoCount: 2,
    menuCount: 0,
  },
];

/** Places Mesita knows about that nobody holds. The catalogue lists them under
 *  `?owned=public`, and Claim is the verb — there is no membership to hold
 *  first, because claiming is what mints the owner row. */
export const POOL_PLACES: MockPoolPlace[] = [
  { id: "plc_pool_a", name: "Tostador Regio", category: "Café", city: "Monterrey", verified: true, claimable: true },
  { id: "plc_pool_b", name: "La Cuchara Azul", category: "Restaurant", city: "Guadalupe", verified: true, claimable: true },
  { id: "plc_pool_c", name: "Bar Once", category: "Bar", city: "Monterrey", verified: false, claimable: false },
  { id: "plc_pool_d", name: "Mercadito Sur", category: "Market", city: "Santa Catarina", verified: true, claimable: true },
];

const GUESTS = [
  "Ana Robles", "Beto Lanz", "Camila Duarte", "Diego Mena", "Elisa Ponce",
  "Fermín Rico", "Gaby Ochoa", "Hugo Vela", "Irene Salas", "Joaquín Paz",
  "Karla Nieto", "Lalo Bravo", "Mariana Cid", "Néstor Gil", "Olivia Rangel",
  "Paco Serna", "Quique Otero", "Rosa Tamez", "Sergio Luna", "Tania Prado",
];

/** Deterministic pseudo-randomness. A fixture that changed on every reload
 *  would make "did my change do that?" unanswerable. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Days back from a FIXED instant, never from `Date.now()`.
 *
 *  A clock in a fixture is a moving target: the same screenshot taken an hour
 *  apart would disagree, and a "2 days ago" that becomes "3 days ago"
 *  overnight turns every visual diff into noise. */
export const MOCK_NOW = new Date("2026-09-16T19:00:00.000Z");

function daysAgo(days: number, hourOffset = 0): string {
  const d = new Date(MOCK_NOW);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(d.getUTCHours() - hourOffset);
  return d.toISOString();
}

function build<T>(placeIds: string[], per: number, make: (placeId: string, i: number, rnd: () => number) => T): T[] {
  const out: T[] = [];
  placeIds.forEach((placeId, p) => {
    const rnd = seeded(placeId.length * 7919 + p * 104729 + per);
    for (let i = 0; i < per; i++) out.push(make(placeId, i, rnd));
  });
  return out;
}

const ALL_IDS = PLACES.map((p) => p.id);

export const VISITS: MockVisit[] = build(ALL_IDS, 14, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `vst_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(r * GUESTS.length)],
    at: daysAgo(Math.floor(i / 2), (i % 2) * 5 + 2),
    totalCents: 18_000 + Math.floor(rnd() * 96_000),
    rewardCents: Math.floor(rnd() * 5_500),
    method: r > 0.7 ? "credits" : r > 0.25 ? "card" : "cash",
    state: i === 0 ? "open" : r > 0.94 ? "voided" : "settled",
  };
});

export const ORDERS: MockOrder[] = build(ALL_IDS, 11, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `ord_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)],
    at: daysAgo(Math.floor(i / 3), (i % 3) * 3 + 1),
    channel: r > 0.55 ? "pickup" : "delivery",
    items: 1 + Math.floor(rnd() * 6),
    totalCents: 9_500 + Math.floor(rnd() * 58_000),
    state:
      i === 0 ? "placed" : i === 1 ? "preparing" : i === 2 ? "ready" : r > 0.9 ? "canceled" : "collected",
  };
});

export const RESERVATIONS: MockReservation[] = build(ALL_IDS, 9, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `rsv_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)],
    at: daysAgo(i < 4 ? -(4 - i) : i - 4, 6),
    party: 2 + Math.floor(rnd() * 7),
    state: i < 3 ? "confirmed" : i === 3 ? "requested" : r > 0.85 ? "no_show" : r > 0.75 ? "canceled" : "seated",
    note: r > 0.72 ? "Window table if possible" : null,
  };
});

const REVIEW_BODIES = [
  "Service was quick and the room was full but never loud. Came back twice this month.",
  "Good food, slow kitchen on a Saturday. Worth the wait if you are not in a hurry.",
  "The reward applied at the table without me asking. That is the part I liked.",
  "Parking is the only complaint. Everything else was better than I expected.",
  "Solid. Not remarkable, not a mistake either.",
  "Took the family. Kids ate, nobody complained, which is the highest rating I give.",
];

export const REVIEWS: MockReview[] = build(ALL_IDS, 7, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `rvw_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)],
    at: daysAgo(i * 3 + 1),
    stars: r > 0.75 ? 5 : r > 0.4 ? 4 : r > 0.2 ? 3 : 2,
    body: REVIEW_BODIES[i % REVIEW_BODIES.length],
    reply: i === 1 ? "Thank you — we added two more staff on weekends since." : null,
  };
});

export const MENUS: MockMenu[] = PLACES.flatMap((p) =>
  Array.from({ length: p.menuCount }, (_, i) => ({
    id: `mnu_${p.id}_${i}`,
    placeId: p.id,
    name: ["Food", "Drinks", "Brunch"][i] ?? `Menu ${i + 1}`,
    kind: (i === 2 ? "link" : "pdf") as "pdf" | "link",
    updatedAt: daysAgo(i * 11 + 4),
    pages: i === 2 ? 0 : 2 + i,
  })),
);

export const CREDIT_BALANCES: MockCreditBalance[] = build(ALL_IDS, 23, (placeId, i, rnd) => ({
  id: `crb_${placeId}_${i}`,
  placeId,
  guest: `${GUESTS[i % GUESTS.length]}${i >= GUESTS.length ? " Jr." : ""}`,
  balanceCents: Math.floor(rnd() * 240_000),
  lastMoveAt: daysAgo(i),
}));

export const CUSTOMERS: MockCustomer[] = build(ALL_IDS, 16, (placeId, i, rnd) => ({
  id: `cus_${placeId}_${i}`,
  placeId,
  name: `${GUESTS[i % GUESTS.length]}${i >= GUESTS.length ? " Jr." : ""}`,
  visits: 1 + Math.floor(rnd() * 19),
  lastSeen: daysAgo(i * 2),
  spendCents: 22_000 + Math.floor(rnd() * 480_000),
}));

export const MEMBERS: MockMember[] = [
  { id: "mem_1", placeId: "plc_lumbre", name: "You", email: "you@mock.mesita.ai", role: "owner", state: "active" },
  { id: "mem_2", placeId: "plc_lumbre", name: "Rosa Tamez", email: "rosa@lumbreysal.example", role: "editor", state: "active" },
  { id: "mem_3", placeId: "plc_lumbre", name: "Néstor Gil", email: "nestor@lumbreysal.example", role: "viewer", state: "invited" },
  { id: "mem_4", placeId: "plc_pardo", name: "You", email: "you@mock.mesita.ai", role: "owner", state: "active" },
  { id: "mem_5", placeId: "plc_hoja", name: "You", email: "you@mock.mesita.ai", role: "editor", state: "active" },
  { id: "mem_6", placeId: "plc_hoja", name: "Tania Prado", email: "tania@hojaverde.example", role: "owner", state: "active" },
  { id: "mem_7", placeId: "plc_norte", name: "You", email: "you@mock.mesita.ai", role: "viewer", state: "active" },
];

const ACTIVITY_SHAPES: Array<Pick<MockActivityEvent, "kind" | "title" | "detail"> & { amount: boolean }> = [
  { kind: "visit", title: "Visit settled", detail: "Closed at the table", amount: true },
  { kind: "order", title: "Order collected", detail: "Pickup", amount: true },
  { kind: "payout", title: "Payout sent", detail: "To ••••4417", amount: true },
  { kind: "review", title: "New review", detail: "4 stars", amount: false },
  { kind: "credit", title: "Credits issued", detail: "Gift purchase", amount: true },
  { kind: "reservation", title: "Reservation confirmed", detail: "Party of 4", amount: false },
  { kind: "member", title: "Teammate invited", detail: "Viewer", amount: false },
  { kind: "profile", title: "Profile updated", detail: "Hours changed", amount: false },
];

export const ACTIVITY: MockActivityEvent[] = build(ALL_IDS, 18, (placeId, i, rnd) => {
  const shape = ACTIVITY_SHAPES[i % ACTIVITY_SHAPES.length];
  return {
    id: `act_${placeId}_${i}`,
    placeId,
    at: daysAgo(Math.floor(i / 2), (i % 2) * 7 + 1),
    kind: shape.kind,
    title: shape.title,
    detail: shape.detail,
    amountCents: shape.amount ? 12_000 + Math.floor(rnd() * 180_000) : null,
  };
});

/** The person. There is no auth in this app, so this is simply who the console
 *  says you are — one constant, read by Account and by the rail's tooltip. */
export const VIEWER = {
  name: "Mock Operator",
  email: "you@mock.mesita.ai",
  joinedAt: daysAgo(412),
} as const;

// ── THE PROFILE RECORDS ─────────────────────────────────────────────────────
//
// One per place, under the REAL column names, because the Profile screen is a
// snapshot of the business console's and reads them by name (mock/types.ts
// says why). The Atlas vocabulary these point into lives in `mock/atlas.ts`.
//
// The four are deliberately at four different COMPLETENESS bands, because the
// meter above the form is the first thing on the screen and a console where
// every place scores 100% never shows what the chips look like:
//
//   Lumbre y Sal      100%  complete — the emerald check, no chips
//   Café Pardo         80%  sky — two chips
//   Hoja Verde         55%  amber — four chips
//   Panadería Norte    25%  rose — five chips and "+N more"

/** N gallery tiles for one place, deterministic and obviously not photographs.
 *  The hero is the place's own card image so the gallery's first tile and the
 *  rail agree; the rest step through the same hue. */
function photoSet(from: string, to: string, glyph: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? gradient(from, to, glyph) : gradient(to, from, String(i + 1)),
  );
}

const WEEK: Partial<Record<MockDay, { open: string; close: string }[]>> = {
  monday: [{ open: "13:00", close: "23:00" }],
  tuesday: [{ open: "13:00", close: "23:00" }],
  wednesday: [{ open: "13:00", close: "23:00" }],
  thursday: [{ open: "13:00", close: "23:30" }],
  friday: [{ open: "13:00", close: "01:00" }],
  saturday: [{ open: "12:00", close: "01:00" }],
};

export const PROFILES: Record<string, MockPlaceProfile> = {
  plc_lumbre: {
    mesita_name: "Lumbre y Sal",
    google_name: "Lumbre y Sal Parrilla",
    category: "steak_house",
    category_label: "Steakhouse",
    family_keys: ["restaurants"],
    description:
      "A wood-fired grill in Del Valle where the whole menu passes over live coals. The room is built around the fire: an open kitchen, a long bar facing it, and a terrace that opens when the evening cools. Cuts are dry-aged in house and served whole to share; the mezcal list is short and regional.",
    price_level: 3,
    currency: "MXN",
    tags: ["dine_in", "full_bar", "date_night", "outdoor_seating", "valet", "mezcal_tequila", "upscale"],
    photos: photoSet("#fb2b7b", "#7b0f3c", "L", 8),
    hours: { ...WEEK, sunday: [{ open: "12:00", close: "18:00" }] },
    address: "Av. Vasconcelos 1204, Del Valle",
    zone: "Del Valle",
    city: "San Pedro Garza García",
    lat: 25.6543,
    lng: -100.3591,
    timezone: "America/Monterrey",
    phone: "+528155550142",
    website_url: "https://lumbreysal.example",
    instagram_url: "https://instagram.com/lumbreysal.example",
    facebook_url: "https://facebook.com/lumbreysal.example",
    whatsapp_url: "https://wa.me/528155550142",
    google_maps_url: "https://maps.google.com/?cid=1000000000000000001",
    uber_eats_url: "",
    opentable_url: "https://opentable.example/lumbre-y-sal",
    content_state: "ready",
    reservation_channel: "whatsapp",
    menu_count: 3,
  },
  plc_pardo: {
    mesita_name: null,
    google_name: "Café Pardo",
    category: "cafe",
    category_label: "Café",
    family_keys: ["cafes_bakeries"],
    description:
      "A corner café in the Centro with a single-origin rotation and a short pastry case baked the same morning. Counter service, big windows, and enough outlets that half the room is working.",
    price_level: 1,
    currency: "MXN",
    tags: ["wifi", "working_laptop", "counter_service", "takeout", "power_outlets"],
    photos: photoSet("#f0a24a", "#8a3d12", "P", 5),
    // No Sunday and no Saturday — a real café's hours, and the two closed rows
    // are what the Hours card's toggle looks like at rest.
    hours: {
      monday: [{ open: "07:30", close: "20:00" }],
      tuesday: [{ open: "07:30", close: "20:00" }],
      wednesday: [{ open: "07:30", close: "20:00" }],
      thursday: [{ open: "07:30", close: "20:00" }],
      friday: [{ open: "07:30", close: "21:00" }],
    },
    address: "Calle Morelos 88, Centro",
    zone: "Centro",
    city: "Monterrey",
    lat: 25.6714,
    lng: -100.3095,
    timezone: "America/Monterrey",
    phone: "+528155550197",
    website_url: "https://cafepardo.example",
    instagram_url: "https://instagram.com/cafepardo.example",
    facebook_url: "",
    whatsapp_url: "",
    google_maps_url: "https://maps.google.com/?cid=1000000000000000002",
    uber_eats_url: "https://ubereats.example/store/cafe-pardo",
    opentable_url: "",
    content_state: "ready",
    // No reservation channel picked, and one menu short: the two chips this
    // place's meter prints.
    reservation_channel: null,
    menu_count: 1,
  },
  plc_hoja: {
    mesita_name: null,
    google_name: "Hoja Verde",
    category: "cocktail_bar",
    category_label: "Cocktail bar",
    family_keys: ["bars_nightlife"],
    // Under 80 characters ON PURPOSE — the Presentation check is a LENGTH
    // check, and a one-line blurb is exactly the case it exists to catch.
    description: "Garden cocktail bar in Del Valle.",
    price_level: 2,
    currency: "MXN",
    tags: ["cocktails", "outdoor_seating"],
    // Two photos, one under the "at least 3" floor.
    photos: photoSet("#3fb98a", "#0d4a37", "H", 2),
    hours: {
      wednesday: [{ open: "18:00", close: "01:00" }],
      thursday: [{ open: "18:00", close: "01:00" }],
      friday: [{ open: "18:00", close: "02:00" }],
      saturday: [{ open: "18:00", close: "02:00" }],
    },
    address: "Río Danubio 415, Del Valle",
    zone: "Del Valle",
    city: "San Pedro Garza García",
    lat: 25.6601,
    lng: -100.3624,
    timezone: "America/Monterrey",
    phone: "+528155550163",
    website_url: "",
    instagram_url: "https://instagram.com/hojaverde.example",
    facebook_url: "",
    whatsapp_url: "",
    google_maps_url: "https://maps.google.com/?cid=1000000000000000003",
    uber_eats_url: "",
    opentable_url: "",
    // MID-ENRICHMENT, which is the only way to see the quiet footnote under
    // the completeness meter.
    content_state: "generating",
    reservation_channel: "instagram",
    menu_count: 2,
  },
  plc_norte: {
    mesita_name: null,
    google_name: "Panadería Norte",
    // The undefined category — a real row, and the one that makes the Family
    // field fall back to the Intaker's inferred keys with "(inferred)".
    category: "undefined",
    category_label: "Bakery",
    family_keys: ["cafes_bakeries"],
    description: null,
    price_level: null,
    currency: null,
    tags: [],
    photos: photoSet("#6f7ae8", "#241f6b", "N", 2),
    hours: null,
    address: "Blvd. Díaz Ordaz 700, Santa María",
    zone: null,
    city: "Monterrey",
    // No coordinates: the Location card's map band is absent here, which is
    // the other half of that card nobody sees.
    lat: null,
    lng: null,
    timezone: "America/Monterrey",
    phone: "",
    website_url: "",
    instagram_url: "",
    facebook_url: "",
    whatsapp_url: "",
    google_maps_url: "",
    uber_eats_url: "",
    opentable_url: "",
    content_state: null,
    reservation_channel: null,
    menu_count: 0,
  },
};
