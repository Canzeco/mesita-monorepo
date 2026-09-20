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
  MockClass,
  MockCreditBalance,
  MockCreditCampaign,
  MockCreditPurchase,
  MockCustomer,
  MockMember,
  MockOrder,
  MockDay,
  MockPayout,
  MockPlan,
  MockPlace,
  MockPlaceProfile,
  MockPlaceView,
  MockProfileMenu,
  MockPoolPlace,
  MockReservation,
  MockReview,
  MockSettingChange,
  MockSex,
  MockVisit,
  MockMenuSection,
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

/** Days from a FIXED instant, never from `Date.now()`.
 *
 *  A clock in a fixture is a moving target: the same screenshot taken an hour
 *  apart would disagree, and a "2 days ago" that becomes "3 days ago"
 *  overnight turns every visual diff into noise.
 *
 *  IT IS DECLARED HERE, ABOVE `PLACES`, and not beside the other date helpers
 *  below: `PLACES` calls `daysAhead` while it is being built, and a `const`
 *  read before its own declaration is a temporal-dead-zone throw rather than
 *  an undefined — the whole app white-screens on module evaluation. */
export const MOCK_NOW = new Date("2026-09-16T19:00:00.000Z");

/** The other direction, for a renewal date. Hoisted, so `PLACES` may call it
 *  from above its own definition. */
function daysAhead(days: number): string {
  const d = new Date(MOCK_NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** ONE renewal date for the whole app. The fixture below and the scenario
 *  panel both reach for it, so a place the panel puts back on `active` renews
 *  on the same day it renewed before — two sources would let the strip print a
 *  date the fixture never held. A year out, because the Membership is yearly. */
// MONTHLY NOW (MESITA-1997). It was `daysAhead(365)` while the Membership was
// a yearly purchase; a plan billed every month that renews in a year is the
// kind of number a reader checks against the price and does not believe.
export const MEMBERSHIP_RENEWS_AT = daysAhead(30);

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
    plan: "ultra",
    promoting: true,
    pulsing: true,
    disabled: false,
    membership: "active",
    renewsAt: MEMBERSHIP_RENEWS_AT,
    customerIntel: true,
    customerIntelSince: daysAgo(188),
    pickupOrders: true,
    deliveryOrders: false,
    orders: {
      paused: false,
      prepMinutes: 20,
      windowNote: null,
      radiusKm: null,
      deliveryFeeCents: null,
      minimumCents: 12000,
    },
    reservations: true,
    visitRewards: true,
    credits: true,
    pay: "enabled",
    rating: 4.7,
    reviewCount: 218,
    photoCount: 8,
    menuCount: 3,
    // ── MESITA-2017: the place with everything on ─────────────────────────
    menuPublishedAt: daysAgo(3),
    verificationRequested: false,
    partnerHeld: true,
    partnerLapsedAt: null,
    notificationsNumber: "+52 81 5555 0142",
    rewards: { mode: "cashback", cap: 500, welcome: true, story: true, mesita: true },
    cashbackPaused: false,
    // One marketplace with a token that died — the most common real state —
    // and one never connected, so the channel list shows three states at once.
    orderChannels: {
      app: "connected",
      web: "connected",
      whatsapp: "connected",
      ubereats: "connected",
      rappi: "token_expired",
      didi: "disconnected",
    },
    reviewSources: {
      google: { connected: true, lastSyncedAt: daysAgo(0, 2) },
      mesita: { connected: true, lastSyncedAt: daysAgo(0, 1) },
      instagram: { connected: true, lastSyncedAt: daysAgo(1) },
      facebook: { connected: true, lastSyncedAt: daysAgo(1) },
    },
    lineState: "full",
    lineFactsPending: 2,
    lineLabel: "Pedidos y reservaciones",
    websiteState: "published",
    websiteTemplate: "elegant",
    websiteDomain: "lumbreysal.mx",
    acceptedIssuers: ["plc_hoja"],
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
    plan: "free",
    promoting: false,
    pulsing: true,
    disabled: false,
    membership: "none",
    renewsAt: null,
    customerIntel: false,
    customerIntelSince: null,
    pickupOrders: true,
    deliveryOrders: true,
    orders: {
      paused: true,
      prepMinutes: 25,
      windowNote: null,
      radiusKm: 3.0,
      deliveryFeeCents: 4000,
      minimumCents: 15000,
    },
    reservations: false,
    visitRewards: false,
    credits: false,
    pay: "started",
    rating: 4.3,
    reviewCount: 61,
    photoCount: 5,
    menuCount: 1,
    // ── MESITA-2017: Free, and the badge it once held ────────────────────
    menuPublishedAt: null,
    verificationRequested: false,
    partnerHeld: true,
    partnerLapsedAt: daysAgo(12),
    notificationsNumber: null,
    rewards: { mode: "discount", cap: 200, welcome: true, story: false, mesita: true },
    cashbackPaused: false,
    orderChannels: {
      app: "disconnected",
      web: "disconnected",
      whatsapp: "disconnected",
      ubereats: "connecting",
      rappi: "disconnected",
      didi: "disconnected",
    },
    reviewSources: {
      google: { connected: true, lastSyncedAt: daysAgo(2) },
      mesita: { connected: true, lastSyncedAt: daysAgo(0, 1) },
      instagram: { connected: false, lastSyncedAt: null },
      facebook: { connected: false, lastSyncedAt: null },
    },
    lineState: "off",
    lineFactsPending: 0,
    lineLabel: "Pedidos y reservaciones",
    websiteState: "none",
    websiteTemplate: null,
    websiteDomain: null,
    acceptedIssuers: [],
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
    plan: "pro",
    promoting: false,
    pulsing: true,
    disabled: false,
    membership: "none",
    renewsAt: null,
    // PRO, SO THE CATALOG IS CLOSED (MESITA-1997). Customer Intelligence sits
    // in Ultra now; the `Since` date survives the lapse on purpose, exactly
    // as `renewsAt` does, so a place that goes back up does not read as new.
    customerIntel: false,
    customerIntelSince: daysAgo(96),
    pickupOrders: false,
    deliveryOrders: false,
    orders: null,
    reservations: true,
    visitRewards: true,
    credits: false,
    pay: "pending",
    rating: 4.1,
    reviewCount: 37,
    photoCount: 2,
    menuCount: 2,
    // ── MESITA-2017: Pro, cashback with Credits off, a site half built ─────
    menuPublishedAt: daysAgo(20),
    verificationRequested: false,
    partnerHeld: false,
    partnerLapsedAt: null,
    notificationsNumber: "+52 81 5555 0163",
    rewards: { mode: "cashback", cap: 1000, welcome: false, story: true, mesita: true },
    cashbackPaused: true,
    orderChannels: {
      app: "connected",
      web: "connected",
      whatsapp: "disconnected",
      ubereats: "disconnected",
      rappi: "disconnected",
      didi: "disconnected",
    },
    reviewSources: {
      google: { connected: true, lastSyncedAt: daysAgo(1) },
      mesita: { connected: true, lastSyncedAt: daysAgo(0, 1) },
      instagram: { connected: false, lastSyncedAt: null },
      facebook: { connected: false, lastSyncedAt: null },
    },
    lineState: "activating",
    lineFactsPending: 0,
    lineLabel: "Pedidos y reservaciones",
    websiteState: "preview",
    websiteTemplate: "casual",
    websiteDomain: null,
    acceptedIssuers: [],
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
    plan: "free",
    promoting: false,
    pulsing: true,
    disabled: false,
    membership: "none",
    renewsAt: null,
    customerIntel: false,
    customerIntelSince: null,
    pickupOrders: false,
    deliveryOrders: false,
    orders: null,
    reservations: false,
    visitRewards: false,
    credits: false,
    pay: "never",
    rating: 3.8,
    reviewCount: 12,
    photoCount: 2,
    menuCount: 0,
    // ── MESITA-2017: unverified, verification requested, nothing else ─────
    menuPublishedAt: null,
    verificationRequested: true,
    partnerHeld: false,
    partnerLapsedAt: null,
    notificationsNumber: null,
    rewards: { mode: "discount", cap: 500, welcome: true, story: true, mesita: true },
    cashbackPaused: false,
    orderChannels: {
      app: "disconnected",
      web: "disconnected",
      whatsapp: "disconnected",
      ubereats: "disconnected",
      rappi: "disconnected",
      didi: "disconnected",
    },
    reviewSources: {
      google: { connected: false, lastSyncedAt: null },
      mesita: { connected: true, lastSyncedAt: daysAgo(0, 1) },
      instagram: { connected: false, lastSyncedAt: null },
      facebook: { connected: false, lastSyncedAt: null },
    },
    lineState: "off",
    lineFactsPending: 0,
    lineLabel: "Pedidos y reservaciones",
    websiteState: "none",
    websiteTemplate: null,
    websiteDomain: null,
    acceptedIssuers: [],
  },
];

/** Places Mesita knows about that nobody holds. The catalogue lists them under
 *  `?owned=public`, and Claim is the verb — there is no membership to hold
 *  first, because claiming is what mints the owner row. */
export const POOL_PLACES: MockPoolPlace[] = [
  { id: "plc_pool_a", name: "Tostador Regio", category: "Café", city: "Monterrey", verified: true, claimable: true, pulsing: true, disabled: false },
  { id: "plc_pool_b", name: "La Cuchara Azul", category: "Restaurant", city: "Guadalupe", verified: true, claimable: true, pulsing: true, disabled: false },
  { id: "plc_pool_c", name: "Bar Once", category: "Bar", city: "Monterrey", verified: false, claimable: false, pulsing: false, disabled: false },
  { id: "plc_pool_d", name: "Mercadito Sur", category: "Market", city: "Santa Catarina", verified: true, claimable: true, pulsing: true, disabled: false },
];

/** The invented guests, and each one's sex ALONGSIDE the name rather than
 *  rolled for separately.
 *
 *  A sex column filled from the same `rnd()` as everything else would sooner or
 *  later print "Ana Robles · Man", and a reviewer who sees that files it
 *  against the COLUMN — they have no way to know it was the fixture lying. The
 *  pairing is what keeps the demographics arguable. */
const GUESTS: Array<{ name: string; sex: MockSex }> = [
  { name: "Ana Robles", sex: "f" }, { name: "Beto Lanz", sex: "m" },
  { name: "Camila Duarte", sex: "f" }, { name: "Diego Mena", sex: "m" },
  { name: "Elisa Ponce", sex: "f" }, { name: "Fermín Rico", sex: "m" },
  { name: "Gaby Ochoa", sex: "f" }, { name: "Hugo Vela", sex: "m" },
  { name: "Irene Salas", sex: "f" }, { name: "Joaquín Paz", sex: "m" },
  { name: "Karla Nieto", sex: "f" }, { name: "Lalo Bravo", sex: "m" },
  { name: "Mariana Cid", sex: "f" }, { name: "Néstor Gil", sex: "m" },
  { name: "Olivia Rangel", sex: "f" }, { name: "Paco Serna", sex: "m" },
  { name: "Quique Otero", sex: "m" }, { name: "Rosa Tamez", sex: "f" },
  { name: "Sergio Luna", sex: "m" }, { name: "Tania Prado", sex: "f" },
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

// A VISIT IS SETTLED BY TENDER ROWS (MESITA-1910), so the fixture builds the
// arithmetic instead of picking one word. `totalCents` is what the guest owed
// after the reward; Credits reduce it further; the tenders take the rest.
//
//     sum(tenders) + creditsCents = totalCents
//
// Four shapes, because each is a case the single chip got wrong:
//   · one tender          the everyday bill
//   · credits + one       the chip showed "credits" and the cash vanished
//   · cash + card         unrepresentable before this — the guest split it
//   · credits, no tender  Credits covered the bill; ZERO rows is the honest
//                         answer, and the old model needed a sentinel for it
export const VISITS: MockVisit[] = build(ALL_IDS, 14, (placeId, i, rnd) => {
  const r = rnd();
  const totalCents = 18_000 + Math.floor(rnd() * 96_000);
  const shape = rnd();

  let creditsCents = 0;
  let tenders: MockVisit["tenders"] = [];
  if (shape > 0.9) {
    // Credits cover the whole bill: no tender at all.
    creditsCents = totalCents;
  } else if (shape > 0.62) {
    // Credits take a bite, one tender settles the remainder.
    creditsCents = Math.min(totalCents, 2_000 + Math.floor(rnd() * 22_000));
    tenders = [{ method: r > 0.5 ? "card" : "cash", amountCents: totalCents - creditsCents }];
  } else if (shape > 0.42) {
    // The split the scalar column could never hold.
    const first = Math.floor(totalCents * (0.3 + rnd() * 0.4));
    tenders = [
      { method: "cash", amountCents: first },
      { method: "card", amountCents: totalCents - first },
    ];
  } else {
    tenders = [
      { method: r > 0.78 ? "mesita_pay" : r > 0.4 ? "card" : "cash", amountCents: totalCents },
    ];
  }

  return {
    id: `vst_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(r * GUESTS.length)].name,
    at: daysAgo(Math.floor(i / 2), (i % 2) * 5 + 2),
    totalCents,
    rewardCents: Math.floor(rnd() * 5_500),
    creditsCents,
    tenders,
    state: i === 0 ? "open" : r > 0.94 ? "voided" : "settled",
  };
});

// THE INVARIANT, HELD AT BUILD TIME. The screen's whole claim is that the
// breakdown adds up; a fixture that drifts by a centavo would make the mock
// teach the opposite of what the real table enforces. Throwing here fails the
// build, which is louder than a wrong number nobody adds up by hand.
for (const v of VISITS) {
  const taken = v.tenders.reduce((n, t) => n + t.amountCents, 0);
  if (taken + v.creditsCents !== v.totalCents) {
    throw new Error(
      `MockVisit ${v.id}: tenders (${taken}) + credits (${v.creditsCents}) !== total (${v.totalCents})`,
    );
  }
}

export const ORDERS: MockOrder[] = build(ALL_IDS, 11, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `ord_${placeId}_${i}`,
    placeId,
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)].name,
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
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)].name,
    at: daysAgo(i < 4 ? -(4 - i) : i - 4, 6),
    party: 2 + Math.floor(rnd() * 7),
    state: i < 3 ? "confirmed" : i === 3 ? "requested" : r > 0.85 ? "no_show" : r > 0.75 ? "canceled" : "seated",
    note: r > 0.72 ? "Window table if possible" : null,
  };
});

export const CREDIT_BALANCES: MockCreditBalance[] = build(ALL_IDS, 23, (placeId, i, rnd) => ({
  id: `crb_${placeId}_${i}`,
  placeId,
  guest: `${GUESTS[i % GUESTS.length].name}${i >= GUESTS.length ? " Jr." : ""}`,
  balanceCents: Math.floor(rnd() * 240_000),
  lastMoveAt: daysAgo(i),
}));

/** A PYRAMID, not a flat draw. Most guests are Bronze, Silver is earned on
 *  Instagram, Gold is bought, and Diamond is invited — a column where all four
 *  are equally common would say the ladder means nothing. */
function classFor(r: number): MockClass {
  if (r > 0.94) return "Diamond";
  if (r > 0.78) return "Gold";
  if (r > 0.55) return "Silver";
  return "Bronze";
}

/** Plan FOLLOWS class, because in the real product it cannot contradict it.
 *
 *  Paying is what gets you Gold, so a Gold guest is on Premium and Bronze and
 *  Silver guests are not — a Silver who paid would rank up and stop being
 *  Silver. Diamond is the only free variable: it is invite-only and outranks
 *  Gold, so a Diamond guest may or may not also be paying, and Class alone
 *  cannot tell you which. Roll only that case. */
function planFor(cls: MockClass, r: number): MockPlan {
  if (cls === "Gold") return "Premium";
  if (cls === "Diamond") return r > 0.5 ? "Premium" : "Free";
  return "Free";
}

/** "Ana Robles" -> "ana.robles". Accents out, because a handle cannot carry
 *  them and a mock that prints @fermin.rico with an accent teaches a shape
 *  Instagram would reject. */
function handleFor(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/ +/g, ".");
}

export const CUSTOMERS: MockCustomer[] = build(ALL_IDS, 16, (placeId, i, rnd) => {
  const guest = GUESTS[i % GUESTS.length];
  const cls = classFor(rnd());
  const name = `${guest.name}${i >= GUESTS.length ? " Jr." : ""}`;
  const visits = 1 + Math.floor(rnd() * 19);
  const spendCents = 22_000 + Math.floor(rnd() * 480_000);
  // FIVE OF SIXTEEN ARE QUIET, and they are picked by INDEX rather than rolled
  // for. Two reasons: the ratio is the argument — a catalog where everybody
  // came back this month sells a fiction, and the row worth acting on is the
  // regular who stopped — and a rolled threshold moves every later draw in the
  // stream when it is tuned, so nudging "about a third" once turned five quiet
  // guests into one. The draws below are made on BOTH branches for the same
  // reason.
  const quiet = i % 4 === 1 || i === 6;
  const monthlyVisits = 1 + Math.floor(rnd() * 3);
  // NEVER ZERO, and never three weeks for somebody who came three times this
  // month: `daysAgo(0)` prints "0m ago", which reads as a clock that has not
  // loaded, and a guest who is here weekly cannot last have been seen 26 days
  // back. Quiet guests are thrown well past the month on the same draw.
  const gapDays = 1 + Math.floor(rnd() * 20);
  const visitsPerMonth = quiet ? 0 : Math.min(visits, monthlyVisits);
  return {
    id: `cus_${placeId}_${i}`,
    placeId,
    name,
    age: 19 + Math.floor(rnd() * 49),
    class: cls,
    sex: guest.sex,
    plan: planFor(cls, rnd()),
    // A Silver ALWAYS has a handle — Silver is the class Instagram earns, so a
    // Silver with an empty cell is a contradiction on screen. Everyone else is
    // a coin the reviewer can watch land both ways.
    instagram: cls === "Silver" || rnd() > 0.55 ? handleFor(name) : null,
    visits,
    spendCents,
    phone: `+52 81 5555 ${String(1200 + Math.floor(rnd() * 8000)).padStart(4, "0")}`,
    visitsPerMonth,
    // The month's money is the guest's OWN average ticket times the visits
    // they made, not a fresh roll: a guest who spends 900 pesos a head has to
    // still spend it in the column that sells the subscription.
    spendPerMonthCents: visitsPerMonth === 0 ? 0 : Math.min(spendCents, Math.round((spendCents / visits) * visitsPerMonth)),
    lastVisitAt: quiet ? daysAgo(41 + gapDays * 7) : daysAgo(gapDays),
  };
});

// THE MONTH AND THE LIFETIME HAVE TO AGREE. A guest with no visits this month
// and money against them, or a month bigger than the lifetime it is part of,
// would make the two halves of this table argue — and the argument is invisible
// unless somebody adds up sixteen rows by hand. Thrown at build time, like the
// visit arithmetic above.
for (const c of CUSTOMERS) {
  const brokenQuiet = c.visitsPerMonth === 0 && c.spendPerMonthCents !== 0;
  if (brokenQuiet || c.visitsPerMonth > c.visits || c.spendPerMonthCents > c.spendCents) {
    throw new Error(
      `MockCustomer ${c.id}: month (${c.visitsPerMonth} visits, ${c.spendPerMonthCents}) does not fit the lifetime (${c.visits} visits, ${c.spendCents})`,
    );
  }
}

export const MEMBERS: MockMember[] = [
  { id: "mem_1", placeId: "plc_lumbre", name: "You", email: "you@mock.mesita.ai", role: "owner", state: "active" },
  { id: "mem_2", placeId: "plc_lumbre", name: "Rosa Tamez", email: "rosa@lumbreysal.example", role: "editor", state: "active" },
  { id: "mem_3", placeId: "plc_lumbre", name: "Néstor Gil", email: "nestor@lumbreysal.example", role: "viewer", state: "invited" },
  { id: "mem_4", placeId: "plc_pardo", name: "You", email: "you@mock.mesita.ai", role: "owner", state: "active" },
  { id: "mem_5", placeId: "plc_hoja", name: "You", email: "you@mock.mesita.ai", role: "editor", state: "active" },
  { id: "mem_6", placeId: "plc_hoja", name: "Tania Prado", email: "tania@hojaverde.example", role: "owner", state: "active" },
  { id: "mem_7", placeId: "plc_norte", name: "You", email: "you@mock.mesita.ai", role: "viewer", state: "active" },
];

// ── THE LOGS THAT HAVE NO PRODUCT PAGE ──────────────────────────────────────
//
// Everything above this line is a record some screen in the console already
// renders. The four below exist because the Activity page is the LEDGER BOOK
// (MESITA-1939) and a book with holes in it is not one: a place is looked at,
// pays out to a bank, sells credit and gets reconfigured, and until now the
// console could not show a single one of those as a row.
//
// THERE IS NO `ACTIVITY` FIXTURE ANY MORE. It was eight invented one-liners —
// "Visit settled", "Payout sent" — with a random amount stapled on, which meant
// the feed's numbers could not agree with any table in this console, because
// nothing connected them. `mock/logs.ts` PROJECTS the feed out of the records
// instead, so the one-liner and the ticket are the same row read at two
// resolutions and neither can drift from the other.

const VIEW_SURFACES: MockPlaceView["surface"][] = ["search", "map", "swipe", "link", "qr"];

// WEIGHTED TOWARDS "VIEWED", because that is the truth of a funnel: most
// people look and leave. A uniform draw over five outcomes would paint a place
// where a third of viewers call it, and a console teaching that would set
// every expectation on this screen wrong.
const VIEW_OUTCOMES: MockPlaceView["outcome"][] = [
  "viewed", "viewed", "viewed", "viewed", "saved", "viewed", "directions",
  "viewed", "viewed", "called", "viewed", "shared",
];

export const PLACE_VIEWS: MockPlaceView[] = build(ALL_IDS, 22, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `viw_${placeId}_${i}`,
    placeId,
    at: daysAgo(Math.floor(i / 4), (i % 4) * 5 + 1),
    surface: VIEW_SURFACES[Math.floor(r * VIEW_SURFACES.length)],
    // Most viewers are signed out. See the type: naming them all would make
    // the place look better known than it is.
    guest: r > 0.68 ? GUESTS[Math.floor(rnd() * GUESTS.length)].name : null,
    outcome: VIEW_OUTCOMES[i % VIEW_OUTCOMES.length],
  };
});

/** One bank account per place, and four different sets of digits — two places
 *  printing the same last four would read as one account paying both. */
const BANK_LAST4 = ["4417", "0286", "9134", "7752"];

// THE NEWEST ONE IS HOURS OLD, NOT DAYS, and that is placement rather than
// realism: the Activity page caps each log at six rows, payouts are the only
// money going OUT, and a weekly cadence buried the whole direction under a
// week of payments taken. A Payments table where every row says In teaches
// that the column has one value. Six days between the rest keeps the cadence.
export const PAYOUTS: MockPayout[] = build(ALL_IDS, 3, (placeId, i, rnd) => ({
  id: `pyo_${placeId}_${i}`,
  placeId,
  at: i === 0 ? daysAgo(0, 3) : daysAgo(i * 6 + 1, 4),
  last4: BANK_LAST4[ALL_IDS.indexOf(placeId) % BANK_LAST4.length],
  amountCents: 42_000 + Math.floor(rnd() * 310_000),
  // THE NEWEST ONE IS STILL MOVING. A payouts log where every row is final
  // hides the state an operator actually writes in about.
  state: i === 0 ? "in_transit" : "paid",
}));

// THE DENOMINATIONS A GUEST ACTUALLY BUYS — round numbers, because a credit
// purchase is a person picking an amount off a sheet, not a bill being
// totalled. Every other money column in this file is deliberately ragged for
// the opposite reason; this one is round because rounding IS the fact.
const CREDIT_DENOMINATIONS = [50_000, 100_000, 25_000, 200_000, 75_000, 150_000];

export const CREDIT_PURCHASES: MockCreditPurchase[] = build(ALL_IDS, 6, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `crp_${placeId}_${i}`,
    placeId,
    at: daysAgo(i * 2 + 1, (i % 2) * 6 + 3),
    guest: GUESTS[Math.floor(r * GUESTS.length)].name,
    amountCents: CREDIT_DENOMINATIONS[i % CREDIT_DENOMINATIONS.length],
    gift: r > 0.62,
  };
});

// Nine changes, spread over the eight areas a place is configured in, with the
// `from` deliberately null on three of them — a photo added, a teammate
// invited, a description written — because "there was nothing here before" is
// a real shape this column has to render.
const SETTING_SHAPES: Array<Omit<MockSettingChange, "id" | "placeId" | "at" | "who">> = [
  { area: "hours", what: "Sunday hours", from: "Closed", to: "9:00 – 17:00" },
  { area: "profile", what: "Photos", from: null, to: "One added" },
  { area: "team", what: "Néstor Gil", from: null, to: "Invited as Viewer" },
  { area: "orders", what: "Delivery", from: "On", to: "Off" },
  { area: "rewards", what: "Strategy", from: "Conservative", to: "Aggressive" },
  { area: "menus", what: "Lunch menu", from: "3 items", to: "5 items" },
  { area: "credits", what: "Credits", from: "Off", to: "On" },
  { area: "profile", what: "Description", from: null, to: "Rewritten" },
  { area: "reservations", what: "Provider", from: "None", to: "OpenTable" },
];

// THE CAMPAIGNS (MESITA-2017). Prepaid Credits sells by CAMPAIGN, not at a
// standing rate: a window, an offer, a cap on the cash raised, a per-guest
// limit. One fixture per lifecycle state the screen has to draw, spread over
// the places that have Credits at all.
export const CREDIT_CAMPAIGNS: MockCreditCampaign[] = [
  {
    id: "cmp_lumbre_0",
    placeId: "plc_lumbre",
    name: "Otoño",
    payCents: 80_000,
    getCents: 100_000,
    capCents: 5_000_000,
    soldCents: 3_120_000,
    perGuestCents: 400_000,
    startsAt: daysAgo(9),
    endsAt: daysAhead(21),
    redeemUntil: daysAhead(120),
    state: "selling",
  },
  {
    id: "cmp_lumbre_1",
    placeId: "plc_lumbre",
    name: "Verano",
    payCents: 85_000,
    getCents: 100_000,
    capCents: 2_000_000,
    soldCents: 2_000_000,
    perGuestCents: 200_000,
    startsAt: daysAgo(70),
    endsAt: daysAgo(40),
    redeemUntil: daysAhead(50),
    state: "redeeming",
  },
  {
    id: "cmp_lumbre_2",
    placeId: "plc_lumbre",
    name: "Diciembre",
    payCents: 75_000,
    getCents: 100_000,
    capCents: 8_000_000,
    soldCents: 0,
    perGuestCents: 500_000,
    startsAt: daysAhead(60),
    endsAt: daysAhead(90),
    redeemUntil: daysAhead(210),
    state: "scheduled",
  },
  {
    id: "cmp_lumbre_3",
    placeId: "plc_lumbre",
    name: "Primavera",
    payCents: 90_000,
    getCents: 100_000,
    capCents: 1_000_000,
    soldCents: 640_000,
    perGuestCents: 200_000,
    startsAt: daysAgo(190),
    endsAt: daysAgo(160),
    redeemUntil: daysAgo(10),
    state: "expired",
  },
  {
    id: "cmp_hoja_0",
    placeId: "plc_hoja",
    name: "Apertura",
    payCents: 80_000,
    getCents: 100_000,
    capCents: 500_000,
    soldCents: 500_000,
    perGuestCents: 100_000,
    startsAt: daysAgo(30),
    endsAt: daysAhead(10),
    redeemUntil: daysAhead(100),
    state: "sold_out",
  },
  {
    id: "cmp_hoja_1",
    placeId: "plc_hoja",
    name: "Borrador",
    payCents: 80_000,
    getCents: 100_000,
    capCents: 1_000_000,
    soldCents: 0,
    perGuestCents: 200_000,
    startsAt: daysAhead(30),
    endsAt: daysAhead(60),
    redeemUntil: daysAhead(180),
    state: "draft",
  },
  {
    id: "cmp_pardo_0",
    placeId: "plc_pardo",
    name: "Lanzamiento",
    payCents: 80_000,
    getCents: 100_000,
    capCents: 300_000,
    soldCents: 120_000,
    perGuestCents: 100_000,
    startsAt: daysAgo(120),
    endsAt: daysAgo(90),
    redeemUntil: daysAhead(30),
    state: "closed",
  },
];

export const SETTING_CHANGES: MockSettingChange[] = build(ALL_IDS, 9, (placeId, i, rnd) => {
  // THE AUTHOR COMES FROM THE TEAM, not from a name pool. A change log
  // attributed to somebody who is not on this place's team is the one kind of
  // wrong an operator would notice immediately and never trust again.
  const team = MEMBERS.filter((m) => m.placeId === placeId && m.state === "active");
  return {
    id: `set_${placeId}_${i}`,
    placeId,
    at: daysAgo(i + 1, (i % 3) * 4 + 2),
    who: team.length ? team[Math.floor(rnd() * team.length)].name : "You",
    ...SETTING_SHAPES[i % SETTING_SHAPES.length],
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


/** A place's menus, as the Menus card edits them. `upload` is a file that was
 *  pushed to Storage in the real console and is a plain URL here; `drive` is a
 *  Google Drive or Docs link the operator pasted. */
function menuSet(slug: string, names: string[], driveAt = -1): MockProfileMenu[] {
  return names.map((name, i) => ({
    key: `mnu_${slug}_${i}`,
    name,
    source: i === driveAt ? ("drive" as const) : ("upload" as const),
    url:
      i === driveAt
        ? `https://drive.google.com/file/d/${slug}${i}menu/view`
        : `https://files.example/menu-pdfs/${slug}/${name.toLowerCase()}.pdf`,
  }));
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
    menus: menuSet("lumbre", ["Food", "Drinks", "Brunch"], 2),
    google_stars_overall: 4.6,
    google_review_count: 1180,
    mesita_stars_overall: 4.7,
    mesita_review_count: 218,
    mesita_stars_food: 4.8,
    mesita_stars_service: 4.5,
    mesita_stars_ambience: 4.9,
    mesita_stars_value: 4.3,
    instagram_followers_count: 18400,
    facebook_followers: 6200,
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
    // NO MENU, so that the completeness meter's "Add a menu" chip is REACHABLE
    // on some place: it is the only chip on this card that scrolls, and with
    // every fixture carrying a menu it only ever appeared under "+3 more" on
    // the place that is missing eight other things. This is the one-thing-left
    // shape — two chips, both in the visible five, one of them a live button.
    menus: [],
    google_stars_overall: 4.4,
    google_review_count: 372,
    mesita_stars_overall: 4.3,
    mesita_review_count: 61,
    mesita_stars_food: 4.5,
    mesita_stars_service: 4.1,
    mesita_stars_ambience: 4.4,
    mesita_stars_value: 4.2,
    instagram_followers_count: 3100,
    facebook_followers: null,
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
    menus: menuSet("hoja", ["Drinks", "Food"], 0),
    google_stars_overall: 4.2,
    google_review_count: 148,
    mesita_stars_overall: 4.1,
    mesita_review_count: 37,
    mesita_stars_food: 4.0,
    mesita_stars_service: 4.2,
    mesita_stars_ambience: 4.4,
    mesita_stars_value: 3.8,
    instagram_followers_count: 920,
    facebook_followers: null,
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
    menus: [],
    google_stars_overall: null,
    google_review_count: null,
    mesita_stars_overall: null,
    mesita_review_count: 0,
    mesita_stars_food: null,
    mesita_stars_service: null,
    mesita_stars_ambience: null,
    mesita_stars_value: null,
    instagram_followers_count: null,
    facebook_followers: null,
  },
};

const REVIEW_BODIES = [
  "Service was quick and the room was full but never loud. Came back twice this month.",
  "Good food, slow kitchen on a Saturday. Worth the wait if you are not in a hurry.",
  "The reward applied at the table without me asking. That is the part I liked.",
  "Parking is the only complaint. Everything else was better than I expected.",
  "Solid. Not remarkable, not a mistake either.",
  "Took the family. Kids ate, nobody complained, which is the highest rating I give.",
];

const GOOGLE_REVIEW_BODIES = [
  "Been coming here for years. Still the same people behind the counter, which says something.",
  "Fine. Nothing to complain about and nothing I would drive across town for.",
  "Waited 40 minutes for a table with a reservation. Food was good, the front desk was not.",
  "Best in the area, and I have tried all of them. Ask for the corner table.",
  "Prices went up and the portions did not. Two stars is generous.",
  "Went for a birthday. They did not make a fuss about it and I appreciated that.",
  "Clean, fast, good coffee. Wifi is terrible if you plan to work.",
  "Closed when Google said it was open. Drove 25 minutes for nothing.",
];

/** The places whose profile says somebody has scored them. A fixture that
 *  built rows for every place would put seven guest reviews under a tile that
 *  reads "no reviews yet" — the two sit one on top of the other on Profile
 *  now, so a reviewer would have to pick which one is lying. `plc_norte` is
 *  the unenriched, unreviewed place and it stays that way all the way down. */
const MESITA_REVIEWED = ALL_IDS.filter((id) => (PROFILES[id].mesita_review_count ?? 0) > 0);
const GOOGLE_SCRAPED = ALL_IDS.filter((id) => (PROFILES[id].google_review_count ?? 0) > 0);

export const REVIEWS: MockReview[] = build(MESITA_REVIEWED, 7, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `rvw_${placeId}_${i}`,
    placeId,
    source: "mesita",
    guest: GUESTS[Math.floor(rnd() * GUESTS.length)].name,
    at: daysAgo(i * 3 + 1),
    stars: r > 0.75 ? 5 : r > 0.4 ? 4 : r > 0.2 ? 3 : 2,
    body: REVIEW_BODIES[i % REVIEW_BODIES.length],
    reply: i === 1 ? "Thank you — we added two more staff on weekends since." : null,
  };
});

/** What Google carries, written by people who never touched Mesita.
 *
 *  A SEPARATE ARRAY, not a `source` filter over `REVIEWS`, because Home counts
 *  `reply === null` to raise the "unanswered reviews" blocker — and a Google
 *  row in that count would be a blocker no operator can clear from inside the
 *  console. Nothing here is replyable, so nothing here is ever a blocker.
 *
 *  Its own voice too. A Google reviewer has no idea a reward exists, so the
 *  Mesita bodies would be wrong in their mouths; these read like what a place
 *  actually gets on Maps — older, blunter, and further apart in score. The
 *  spread is deliberate: the aggregate tile above says 4.6, and a scroller
 *  where every card is 5 would make that number look wrong. */
export const GOOGLE_REVIEWS: MockReview[] = build(GOOGLE_SCRAPED, 8, (placeId, i, rnd) => {
  const r = rnd();
  return {
    id: `grv_${placeId}_${i}`,
    placeId,
    source: "google",
    guest: GUESTS[(i * 3 + 5) % GUESTS.length].name,
    // Sparser than Mesita's: Google collects a review a place earns by
    // existing, Mesita collects one it earns at a visit it just settled.
    at: daysAgo(i * 11 + 4),
    stars: r > 0.62 ? 5 : r > 0.34 ? 4 : r > 0.16 ? 3 : r > 0.06 ? 2 : 1,
    body: GOOGLE_REVIEW_BODIES[i % GOOGLE_REVIEW_BODIES.length],
    reply: null,
  };
});

// ── THE DIGITAL MENU ────────────────────────────────────────────────────────
//
// Dishes and prices as something Mesita can READ (Main §4), which is the whole
// difference between this product and the PDF it replaces. Every dish carries
// three prices because a place sets them independently: the table pays for the
// room, pickup is often the cheapest thing on the menu on purpose, and delivery
// carries a courier.
//
// A NULL PRICE IS A REAL ANSWER. The tuétano does not survive a courier and the
// place does not send it, so delivery is null rather than a number nobody
// should be able to charge. A dash says "not on that channel"; a zero would say
// "free".
//
// Invented like everything else here, and deliberately a steakhouse's menu so
// the prices read as this place's rather than as lorem.
export const MENU_SECTIONS: readonly MockMenuSection[] = [
  {
    id: "sec_brasa",
    name: "De la brasa",
    dishes: [
      {
        id: "dish_tomahawk",
        name: "Tomahawk 1.2kg",
        blurb: "Dry-aged 40 days, over live coals, carved at the table for two.",
        photoUrl: gradient("#3f3f3f", "#141414", "T"),
        table: 189000,
        pickup: 179000,
        delivery: null,
      },
      {
        id: "dish_arrachera",
        name: "Arrachera al carbón",
        blurb: "Marinated overnight, served with grilled spring onion and salsa martajada.",
        photoUrl: gradient("#4a3a2a", "#1b1410", "A"),
        table: 42000,
        pickup: 39000,
        delivery: 44000,
      },
      {
        id: "dish_tuetano",
        name: "Tuétano a la leña",
        blurb: "Roasted marrow, lime, flour tortillas. Eaten hot or not at all.",
        photoUrl: gradient("#6b5433", "#241a0e", "T"),
        table: 28000,
        pickup: null,
        delivery: null,
      },
    ],
  },
  {
    id: "sec_entradas",
    name: "Para empezar",
    dishes: [
      {
        id: "dish_aguachile",
        name: "Aguachile de la casa",
        blurb: "Shrimp, serrano, cucumber and a chile oil the kitchen makes weekly.",
        photoUrl: gradient("#2f6b5a", "#0f231d", "A"),
        table: 31000,
        pickup: 29000,
        delivery: 33000,
      },
      {
        id: "dish_queso",
        name: "Queso fundido con chistorra",
        blurb: "Skillet cheese, chistorra, warm tortillas. The lightest thing here is not this.",
        photoUrl: gradient("#8a6a2f", "#2b1f0d", "Q"),
        table: 24000,
        pickup: 22000,
        delivery: 26000,
      },
    ],
  },
  {
    id: "sec_barra",
    name: "De la barra",
    dishes: [
      {
        id: "dish_mezcal",
        name: "Mezcal flight",
        blurb: "Three pours from Oaxaca and Durango, poured side by side with sal de gusano.",
        photoUrl: gradient("#5c5a3a", "#1d1c11", "M"),
        table: 35000,
        pickup: null,
        delivery: null,
      },
      {
        id: "dish_paloma",
        name: "Paloma de la casa",
        blurb: "Grapefruit pressed in house, mezcal instead of tequila, salt on half the rim.",
        photoUrl: gradient("#8a4a55", "#2b141a", "P"),
        table: 18000,
        pickup: null,
        delivery: null,
      },
    ],
  },
];
