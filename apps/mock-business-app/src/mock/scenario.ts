// THE QUERY PLANNER — what the console reads, given the scenario on screen.
//
// The real console's shape is decided by one Edge Function call whose answer
// nobody can dictate: `business-web-list-places` returns what it returns, and
// the console's four shapes (`RailMode`) fall out of it. Two of those four —
// the FAILED READ and the EMPTY PORTFOLIO — are states no reviewer can reach
// on purpose, which is why they are the two that ship broken.
//
// Here the scenario IS the answer. Pick a mode and the console is in it.
import { MEMBERSHIP_RENEWS_AT, PLACES, POOL_PLACES, PROFILES } from "@/mock/fixtures";
import type {
  MembershipState,
  MockPlace,
  MockPlaceProfile,
  PayLadder,
  PlaceRole,
} from "@/mock/types";
import type { RailMode } from "@/lib/rail-scope";

export type Scenario = {
  /** The console's shape. `unknown` is the failed read, and it is NOT an empty
   *  list: a failed read must never render as "you have no places". */
  mode: RailMode;
  /** The caller's role on the place they are looking at. Drives `tabsForAccess`
   *  — a viewer sees three views, an editor nine. */
  role: PlaceRole;
  /** Super-admin adds the Admin view, and nothing else. */
  isSuperAdmin: boolean;
  /** Mesita Partner on the SELECTED place. The gate five of the eight products
   *  read; off, they are Locked and carry no verb. */
  partnered: boolean;
  /** What the SUBSCRIPTION behind the gate is doing. Its own axis, because
   *  `partnered` and the membership come apart in both directions — a
   *  `past_due` place is still a partner, and a partner switched on by an
   *  operator has no subscription at all. `withOverrides` holds the one pair
   *  that cannot exist: not partnered, so nothing to be in a state. */
  membership: MembershipState;
  /** Where this place sits on Stripe's ladder. */
  pay: PayLadder;
  /** The per-place capability switches. */
  pickupOrders: boolean;
  deliveryOrders: boolean;
  reservations: boolean;
  visitRewards: boolean;
  credits: boolean;
  /** Strip every list to nothing, so the empty states can be READ. Half this
   *  console is empty states nobody has ever seen with their own eyes. */
  empty: boolean;
};

export const DEFAULT_SCENARIO: Scenario = {
  mode: "solo",
  role: "owner",
  isSuperAdmin: false,
  partnered: true,
  membership: "active",
  pay: "enabled",
  pickupOrders: true,
  deliveryOrders: false,
  reservations: true,
  visitRewards: true,
  credits: true,
  empty: false,
};

/** The named starting points. Each is a state somebody has had to debug. */
export const PRESETS: Array<{ id: string; label: string; hint: string; patch: Partial<Scenario> }> = [
  {
    id: "owner",
    label: "Partner owner",
    hint: "One place, everything on. The console's happy path.",
    patch: { ...DEFAULT_SCENARIO },
  },
  {
    id: "first-run",
    label: "First run",
    hint: "Zero places. Add place is the only row.",
    patch: { mode: "zero", empty: true },
  },
  {
    id: "unpartnered",
    label: "Not a partner",
    hint: "Five of the eight products Locked, no verb on any of them.",
    patch: { mode: "solo", partnered: false, membership: "none", pay: "never", visitRewards: false, credits: false },
  },
  {
    id: "membership-past-due",
    label: "Membership past due",
    hint: "Stripe is retrying the card. Still a partner — LAPSE is not DROP.",
    patch: { mode: "solo", partnered: true, membership: "past_due" },
  },
  {
    id: "membership-ending",
    label: "Membership ending",
    hint: "Cancelled, running to the paid-through date. Never says \u201crenews\u201d.",
    patch: { mode: "solo", partnered: true, membership: "cancelling" },
  },
  {
    id: "membership-none",
    label: "Partner, no subscription",
    hint: "Switched on by an operator. There is no date, so none is shown.",
    patch: { mode: "solo", partnered: true, membership: "none" },
  },
  {
    id: "multi",
    label: "Four places",
    hint: "The selector heads the rail and the console picks none of them.",
    patch: { mode: "multi" },
  },
  {
    id: "viewer",
    label: "Viewer",
    hint: "Three views. The other six are hidden AND refused.",
    patch: { mode: "solo", role: "viewer" },
  },
  {
    id: "failed",
    label: "Read failed",
    hint: "The rail says so and offers a retry. It never says 'add one'.",
    patch: { mode: "unknown", empty: true },
  },
  {
    id: "stripe-fresh",
    label: "Stripe, day zero",
    hint: "Never started — which Stripe reports with a disabled_reason set.",
    patch: { mode: "solo", partnered: true, pay: "never" },
  },
  {
    id: "stripe-restricted",
    label: "Stripe, restricted",
    hint: "Charges were on and are not any more.",
    patch: { mode: "solo", partnered: true, pay: "restricted" },
  },
  {
    id: "superadmin",
    label: "Super-admin",
    hint: "Adds the Admin view. Everything on it calls admin-only endpoints.",
    patch: { mode: "multi", isSuperAdmin: true },
  },
];

export type World = {
  /** The caller's portfolio. EMPTY at `zero` AND at `unknown` — two different
   *  facts, told apart by `viewerError`, never by the length of this array. */
  places: MockPlace[];
  /** The read failed. Computed once, passed down, never re-derived from an
   *  empty array. */
  viewerError: boolean;
  poolPlaces: typeof POOL_PLACES;
  /** The profile record per place id — the fixture, or what Profile's save bar
   *  last wrote over it. Keyed rather than nested on `MockPlace` so the rail
   *  and the eight product views never carry thirty columns they do not read
   *  (mock/types.ts). */
  profiles: Record<string, MockPlaceProfile>;
};

/** Apply the scenario's switches to a place. The FIRST place is the one under
 *  the microscope — the others keep their fixture values, so a multi-place rail
 *  still shows a mix rather than four identical venues. */
function withOverrides(place: MockPlace, s: Scenario, primary: boolean): MockPlace {
  if (!primary) return place;
  return {
    ...place,
    myRole: s.role,
    partnered: s.partnered,
    // THE ONE PAIR THAT CANNOT EXIST. A place that is not a partner has no
    // subscription to be `past_due` or `cancelling` about, so the panel's two
    // dials cannot be crossed into a state the real console never produces.
    // Held here rather than in the panel because the panel is not the only
    // writer — a stored scenario from an older build arrives through
    // `getScenario`'s spread with whatever it was saved with.
    membership: s.partnered ? s.membership : "none",
    renewsAt: s.partnered && s.membership !== "none" ? place.renewsAt ?? MEMBERSHIP_RENEWS_AT : null,
    pay: s.pay,
    pickupOrders: s.pickupOrders,
    deliveryOrders: s.deliveryOrders,
    reservations: s.reservations,
    visitRewards: s.visitRewards,
    credits: s.credits,
  };
}

/** The profile a place currently has: its fixture, unless Profile's save bar
 *  has written one. A saved edit REPLACES the record rather than merging into
 *  it — the form holds every field, so a partial write here could only ever
 *  come from a bug, and merging would hide it. */
function profilesWith(
  edits: Record<string, MockPlaceProfile>,
): Record<string, MockPlaceProfile> {
  return { ...PROFILES, ...edits };
}

export function resolveWorld(
  s: Scenario,
  profileEdits: Record<string, MockPlaceProfile> = {},
): World {
  const profiles = profilesWith(profileEdits);
  if (s.mode === "unknown") {
    return { places: [], viewerError: true, poolPlaces: POOL_PLACES, profiles };
  }
  if (s.mode === "zero") {
    return { places: [], viewerError: false, poolPlaces: POOL_PLACES, profiles };
  }
  const chosen = s.mode === "solo" ? PLACES.slice(0, 1) : PLACES;
  return {
    // A SAVED PROFILE MOVES THE PLACE, not just the form: the name the rail
    // and the heading print is `mesita_name` falling back to `google_name`
    // (the real column is GENERATED as exactly that coalesce), and the photo
    // count Admin prints is the gallery's length. Re-deriving them here is
    // what makes the save bar's promise visible outside the card it was
    // pressed in.
    places: chosen.map((p, i) => withProfile(withOverrides(p, s, i === 0), profiles[p.id])),
    viewerError: false,
    poolPlaces: POOL_PLACES,
    profiles,
  };
}

function withProfile(place: MockPlace, profile: MockPlaceProfile | undefined): MockPlace {
  if (!profile) return place;
  return {
    ...place,
    name: (profile.mesita_name ?? "").trim() || (profile.google_name ?? "").trim() || place.name,
    category: profile.category_label ?? place.category,
    street: profile.address ?? place.street,
    city: profile.city ?? place.city,
    phone: profile.phone ?? place.phone,
    website: profile.website_url ?? place.website,
    photoUrl: profile.photos[0] ?? place.photoUrl,
    photoCount: profile.photos.length,
    menuCount: profile.menus.length,
  };
}

/** Rows a list should show. `empty` is a scenario, not a bug — the whole point
 *  of the switch is that a reviewer can look at the empty state on purpose. */
export function listFor<T>(rows: T[], s: Scenario): T[] {
  return s.empty ? [] : rows;
}
