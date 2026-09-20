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
import { isPartner } from "@/mock/types";
import type {
  MembershipState,
  MockPlace,
  PlanTier,
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
   *  — a viewer sees Profile alone, an editor every view. */
  role: PlaceRole;
  /** Super-admin adds the Admin view, and nothing else. */
  isSuperAdmin: boolean;
  /** THE RUNG on the SELECTED place (MESITA-1997) — four values now,
   *  replacing the `partnered` boolean this dial used to be. Everything a
   *  product gates on is derived from this and never set beside it. A boolean
   *  could not reach Ultra, which is the whole reason the dial changed shape —
   *  and since 2026-09-20 it could not reach Start either, which is a rung
   *  that PAYS and is not a Partner. */
  plan: PlanTier;
  /** THE TWO GENERAL STATES THE PANEL CAN MOVE (MESITA-1977). `verified` is
   *  not one of them: it is a fixture fact per place, and a switch for it here
   *  would let a caller build a Partner that Mesita never verified — a rung
   *  below one it already has. `pulsing` and `disabled` are both reachable at
   *  any height, which is why they are dials and the ladder is not. */
  pulsing: boolean;
  disabled: boolean;
  /** What the BILLING under the rung is doing. Its own axis, because the rung
   *  and the subscription come apart in both directions — a `past_due` place
   *  is still on Pro, and a place switched up by an operator has no
   *  subscription at all. `withOverrides` holds the one pair that cannot
   *  exist: `free`, so nothing to be in a state. */
  membership: MembershipState;
  /** Where this place sits on Stripe's ladder. */
  pay: PayLadder;
  // NO `customerIntel` DIAL ANY MORE (MESITA-1997). Customer Intelligence
  // moved inside Mesita Ultra, so the closed form of the catalog is what a
  // `free` or `pro` place sees — reachable by moving the rung, which is one
  // dial instead of a second one that could contradict it.
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
  plan: "pro",
  pulsing: true,
  disabled: false,
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
    label: "Free",
    hint: "The bottom rung. Profile, Reviews, Menu and the Developers Platform; everything else Locked and carrying no verb.",
    patch: { mode: "solo", plan: "free", membership: "none", pay: "never", visitRewards: false, credits: false },
  },
  {
    id: "ultra",
    label: "Ultra",
    hint: "The top rung. The Answering Agent unlocks and the customer catalog opens \u2014 the only preset where either does.",
    patch: { mode: "solo", plan: "ultra" },
  },
  {
    id: "membership-past-due",
    label: "Membership past due",
    hint: "Stripe is retrying the card. Still a partner — LAPSE is not DROP.",
    patch: { mode: "solo", plan: "pro", membership: "past_due" },
  },
  {
    id: "membership-ending",
    label: "Membership ending",
    hint: "Cancelled, running to the paid-through date. Never says \u201crenews\u201d.",
    patch: { mode: "solo", plan: "pro", membership: "cancelling" },
  },
  {
    id: "membership-none",
    label: "Partner, no subscription",
    hint: "Switched on by an operator. There is no date, so none is shown.",
    patch: { mode: "solo", plan: "pro", membership: "none" },
  },
  {
    id: "customers-closed",
    label: "Customers, not subscribed",
    hint: "The catalog is counted and nobody in it is named \u2014 what Pro sees, because the catalog is Ultra's.",
    patch: { mode: "solo", plan: "pro" },
  },
  {
    id: "multi",
    label: "Four places",
    hint: "The console picks none of them: Place opens the catalogue.",
    patch: { mode: "multi" },
  },
  {
    id: "viewer",
    label: "Viewer",
    hint: "Profile alone. Every other view and all four pages are refused.",
    patch: { mode: "solo", role: "viewer" },
  },
  {
    id: "failed",
    label: "Read failed",
    hint: "The catalogue says so and offers a retry. It never says 'add one'.",
    patch: { mode: "unknown", empty: true },
  },
  {
    id: "stripe-fresh",
    label: "Stripe, day zero",
    hint: "Never started — which Stripe reports with a disabled_reason set.",
    patch: { mode: "solo", plan: "pro", pay: "never" },
  },
  {
    id: "stripe-restricted",
    label: "Stripe, restricted",
    hint: "Charges were on and are not any more.",
    patch: { mode: "solo", plan: "pro", pay: "restricted" },
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
   *  last wrote over it. Keyed rather than nested on `MockPlace` so the menu
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
    plan: s.plan,
    // DERIVED, NEVER DIALLED — this is the one line that computes the badge,
    // the way the real lane's `deriveListingType` is the one line over there.
    // Two writers for one fact is how a console ends up showing a Partner
    // badge on a place that did not buy one.
    //
    // `isPartner`, NOT `plan !== "free"` (2026-09-20). The badge starts at
    // Mesita Pro; the rung below it pays and wears none.
    partnered: isPartner(s.plan),
    pulsing: s.pulsing,
    disabled: s.disabled,
    // THE ONE PAIR THAT CANNOT EXIST. A place on Free has no subscription to
    // be `past_due` or `cancelling` about, so the panel's two dials cannot be
    // crossed into a state the real console never produces. THE TEST IS THE
    // RUNG, NOT THE BADGE: Start pays, and a paying place has billing states.
    // Held here rather than in the panel because the panel is not the only
    // writer — a stored scenario from an older build arrives through
    // `getScenario`'s spread with whatever it was saved with.
    membership: s.plan !== "free" ? s.membership : "none",
    renewsAt: s.plan !== "free" && s.membership !== "none"
      ? place.renewsAt ?? MEMBERSHIP_RENEWS_AT
      : null,
    pay: s.pay,
    // The Ultra rung IS the Customers subscription now — see `MockPlace`.
    customerIntel: s.plan === "ultra",
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
    // A SAVED PROFILE MOVES THE PLACE, not just the form: the name the menu
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
