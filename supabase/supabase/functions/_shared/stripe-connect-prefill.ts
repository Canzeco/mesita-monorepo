// Stripe Express hosted onboarding prefills from the merchant's own place
// (MESITA-1892 — the Connect account belongs to the PLACE now, so the rows
// this reads from are that one place's; it used to gather every place an
// organization held).
//
// Stripe does not take form values on accountLinks.create. Prefill is written
// onto the Account BEFORE the first Account Link (after that, Express with
// requirement_collection=stripe locks KYC). Missing MCC is how restaurants
// saw Industry=Software: Stripe falls back to the platform MCC (5734).
//
// Prefill is deterministic: Atlas's classification and the place's own
// columns, nothing else. accounts.create is idempotency-keyed, so its body must
// be a pure function of the row. An unclassified place gets the restaurant MCC
// (the owner can still change it); a missing description is simply not sent.
//
// THE ROW HELPERS STAY PLURAL ON PURPOSE. `sortPlacesForPrefill`,
// `mccFromPlaces` and `firstOf` take an array, and the caller now passes one
// of length 0 or 1. They are pure, already pinned by
// stripe-connect-prefill.test.ts, and total over any row count — collapsing
// them to a single row would buy nothing and re-open the ordering bug the
// stable sort exists to prevent.

import {
  familiesForAtlasCategory,
  sanitizeFamilyKeys,
  type FamilyKey,
} from "./place-taxonomy.ts";
import { isEmailish } from "./input.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isShapedRfc, normalizeRfc } from "./place-rfc.ts";

/** The RFC rule lives in place-rfc.ts, where the place WRITERS can reach it
 *  too (MESITA-1880). Re-exported here so this module's existing importers
 *  keep their entry point. */
export { MEXICO_RFC_RE } from "./place-rfc.ts";

/** Stripe's product_description cap. Keep the hosted field short. */
export const PRODUCT_DESCRIPTION_MAX = 400;

/**
 * Hospitality MCCs we will actually send. Closed so prefill never sends the
 * platform default (5734 Computer Software Stores) or a junk code.
 */
export const CONNECT_MCCS = {
  restaurants: "5812",
  bars: "5813",
  fastFood: "5814",
  bakery: "5462",
  catering: "5811",
  recreation: "7999",
  amusement: "7996",
  theater: "7832",
  performing: "7922",
  sports: "7997",
  spa: "7298",
  beauty: "7230",
} as const;

export const ALLOWED_CONNECT_MCCS: ReadonlySet<string> = new Set(
  Object.values(CONNECT_MCCS),
);

/** When Atlas has nothing, prefer restaurants over Software. The owner can still change it. */
export const DEFAULT_CONNECT_MCC = CONNECT_MCCS.restaurants;

const SUPER_MCC: Record<Exclude<FamilyKey, "undefined">, string> = {
  restaurants: CONNECT_MCCS.restaurants,
  cafes_bakeries: CONNECT_MCCS.restaurants,
  bars_nightlife: CONNECT_MCCS.bars,
  experiences: CONNECT_MCCS.recreation,
  culture_arts: CONNECT_MCCS.performing,
  sports_fitness: CONNECT_MCCS.sports,
  wellness_beauty: CONNECT_MCCS.spa,
};

const CATEGORY_MCC: Record<string, string> = {
  bakery: CONNECT_MCCS.bakery,
  dessert_shop: CONNECT_MCCS.bakery,
  ice_cream: CONNECT_MCCS.bakery,
  fast_food: CONNECT_MCCS.fastFood,
  food_truck: CONNECT_MCCS.fastFood,
  bar: CONNECT_MCCS.bars,
  pub: CONNECT_MCCS.bars,
  cocktail_bar: CONNECT_MCCS.bars,
  wine_bar: CONNECT_MCCS.bars,
  brewery: CONNECT_MCCS.bars,
  night_club: CONNECT_MCCS.bars,
  karaoke: CONNECT_MCCS.bars,
  spa: CONNECT_MCCS.spa,
  temazcal: CONNECT_MCCS.spa,
  hot_springs: CONNECT_MCCS.spa,
  massage: CONNECT_MCCS.spa,
  sauna: CONNECT_MCCS.spa,
  wellness_center: CONNECT_MCCS.spa,
  medical_spa: CONNECT_MCCS.spa,
  barbershop: CONNECT_MCCS.beauty,
  hair_salon: CONNECT_MCCS.beauty,
  nail_salon: CONNECT_MCCS.beauty,
  beauty_salon: CONNECT_MCCS.beauty,
  gym: CONNECT_MCCS.sports,
  climbing_gym: CONNECT_MCCS.sports,
  crossfit_box: CONNECT_MCCS.sports,
  yoga_studio: CONNECT_MCCS.sports,
  pilates_studio: CONNECT_MCCS.sports,
  dance_studio: CONNECT_MCCS.sports,
  martial_arts: CONNECT_MCCS.sports,
  padel_club: CONNECT_MCCS.sports,
  tennis_club: CONNECT_MCCS.sports,
  golf_course: CONNECT_MCCS.sports,
  soccer_field: CONNECT_MCCS.sports,
  swimming_pool: CONNECT_MCCS.sports,
  movie_theater: CONNECT_MCCS.theater,
  theater: CONNECT_MCCS.performing,
  concert_venue: CONNECT_MCCS.performing,
  museum: CONNECT_MCCS.performing,
  art_gallery: CONNECT_MCCS.performing,
  cultural_center: CONNECT_MCCS.performing,
  amusement_park: CONNECT_MCCS.amusement,
  water_park: CONNECT_MCCS.amusement,
};

export type PlacePrefillRow = {
  id?: string | null;
  name?: string | null;
  category?: string | null;
  category_label?: string | null;
  family_keys?: unknown;
  description?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  phone?: string | null;
  email?: string | null;
};

/** The merchant's own identity columns, read straight off `places`
 *  (MESITA-1892): its trade name, `places.legal_name` and `places.rfc`. The
 *  trade name is kept separate from the profile rows below because a place
 *  whose `place_profiles` row is missing still has one. */
export type MerchantPrefillRow = {
  name: string;
  legalName: string;
  rfc: string | null;
};

export type ConnectBusinessProfilePrefill = {
  mcc?: string;
  url?: string;
  product_description?: string;
  name?: string;
  support_phone?: string;
  support_email?: string;
};

export type ConnectPrefill = {
  email?: string;
  taxId?: string;
  businessProfile: ConnectBusinessProfilePrefill;
};

/** Prefill's fail-open reader: a malformed RFC is simply not sent to Stripe.
 *  Since MESITA-1880 the writers refuse one at the door and a CHECK backs
 *  them, so a row reaching here cannot be malformed — this stays fail-open
 *  for rows written before that, not as a policy. */
export function rfcIfValid(raw: unknown): string | null {
  const rfc = normalizeRfc(raw);
  return rfc && isShapedRfc(rfc) ? rfc : null;
}

export function asHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.startsWith("@")) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function asEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return isEmailish(t) ? t : null;
}

export function asPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  return digits.length >= 8 ? t : null;
}

export function trimProductDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 24) return null;
  if (text.length <= PRODUCT_DESCRIPTION_MAX) return text;
  const sliced = text.slice(0, PRODUCT_DESCRIPTION_MAX);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  const cut = lastStop >= 80 ? sliced.slice(0, lastStop + 1) : sliced.trim();
  return cut || null;
}

export function mccFromPlace(place: PlacePrefillRow): string | null {
  const category = typeof place.category === "string"
    ? place.category.trim().toLowerCase()
    : "";
  if (category && CATEGORY_MCC[category]) return CATEGORY_MCC[category];
  // A classified Atlas category (not the leftover `undefined`) maps through
  // its Super. `undefined` is itself an Atlas slug whose membership is Super
  // undefined — that must NOT win over stored inferred supers.
  if (category && category !== "undefined") {
    const atlas = familiesForAtlasCategory(category)
      .filter((k): k is Exclude<FamilyKey, "undefined"> => k !== "undefined");
    if (atlas.length > 0) return SUPER_MCC[atlas[0]] ?? null;
  }
  const stored = sanitizeFamilyKeys(place.family_keys)
    .filter((k): k is Exclude<FamilyKey, "undefined"> => k !== "undefined");
  if (stored.length > 0) return SUPER_MCC[stored[0]] ?? null;
  return null;
}

/**
 * One MCC for the merchant. Majority wins; a restaurant/bar tie prefers
 * restaurants (Mesita's default hospitality).
 * With the account scoped to one place the majority is a formality — but it
 * is what makes the function total over zero rows, which is the case that
 * actually happens (a place with no profile row yet).
 */
export function mccFromPlaces(places: PlacePrefillRow[]): string | null {
  const counts = new Map<string, number>();
  for (const p of places) {
    const mcc = mccFromPlace(p);
    if (!mcc) continue;
    counts.set(mcc, (counts.get(mcc) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: string | null = null;
  let bestN = 0;
  for (const [mcc, n] of counts) {
    if (n > bestN || (n === bestN && mcc === CONNECT_MCCS.restaurants)) {
      best = mcc;
      bestN = n;
    }
  }
  return best;
}

function firstOf<T>(
  places: PlacePrefillRow[],
  pick: (p: PlacePrefillRow) => T | null,
): T | null {
  for (const p of places) {
    const v = pick(p);
    if (v) return v;
  }
  return null;
}

/** Stable order so firstOf (url/email/phone/copy) does not ride PostgREST shuffle. */
export function sortPlacesForPrefill(places: PlacePrefillRow[]): PlacePrefillRow[] {
  return [...places].sort((a, b) => {
    const byId = (a.id ?? "").localeCompare(b.id ?? "");
    if (byId !== 0) return byId;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

const PLACE_PREFILL_SELECT =
  "id, legal_name, rfc, place_profiles(name, category, category_label, family_keys, description, website_url, instagram_url, phone, email)";

/**
 * Everything Connect prefill needs about the merchant, in ONE read: the legal
 * identity off `places` and the Atlas profile off `place_profiles`.
 *
 * BOTH HALVES COME FROM HERE ON PURPOSE. `legal_name` and `rfc` moved onto
 * `places` when the organization layer was removed (MESITA-1892), and the
 * onboarding EF was reading them itself — a second raw read of the tenant row
 * in a handler whose next statement patches Stripe. This module already had
 * to read the row; the EF now has no reason to.
 *
 * It also keeps Stripe's account patch out of write-surface's 2000-char window
 * of a places read (that scan treats any write-verb near `.from("places")` as
 * a places write).
 *
 * `places` comes back as an ARRAY because everything downstream is
 * array-shaped (see the file header), not because more than one row can. The
 * embed is a LEFT join: a place whose profile has not been written yet still
 * yields its legal identity, and prefill falls back to the default MCC.
 */
export async function loadPlaceForPrefill(
  admin: SupabaseClient,
  placeId: string,
): Promise<{
  merchant: MerchantPrefillRow;
  places: PlacePrefillRow[];
  error: unknown;
}> {
  const { data, error } = await admin
    .from("places")
    .select(PLACE_PREFILL_SELECT)
    .eq("id", placeId)
    .order("id");
  type ProfileEmbed = PlacePrefillRow | PlacePrefillRow[] | null;
  const rows = (data ?? []) as {
    id: string;
    legal_name?: string | null;
    rfc?: string | null;
    place_profiles: ProfileEmbed;
  }[];
  const places: PlacePrefillRow[] = rows.map((row) => {
    const profile = Array.isArray(row.place_profiles)
      ? row.place_profiles[0]
      : row.place_profiles;
    return { id: row.id, ...(profile ?? {}) };
  });
  const merchant: MerchantPrefillRow = {
    name: (places[0]?.name ?? "").trim(),
    legalName: (rows[0]?.legal_name ?? "").trim(),
    rfc: rows[0]?.rfc ?? null,
  };
  return { merchant, places, error };
}

export function deterministicConnectPrefill(
  merchant: MerchantPrefillRow,
  places: PlacePrefillRow[],
): ConnectPrefill {
  places = sortPlacesForPrefill(places);
  const url = firstOf(places, (p) => asHttpsUrl(p.website_url)) ??
    firstOf(places, (p) => asHttpsUrl(p.instagram_url));
  const email = firstOf(places, (p) => asEmail(p.email));
  const phone = firstOf(places, (p) => asPhone(p.phone));
  const description = firstOf(places, (p) => trimProductDescription(p.description));
  const tradeName = (merchant.name || "").trim() ||
    (places.map((p) => (p.name ?? "").trim()).find(Boolean) ?? "");
  const mcc = mccFromPlaces(places) ?? DEFAULT_CONNECT_MCC;
  const profile: ConnectBusinessProfilePrefill = {
    mcc,
    ...(url ? { url } : {}),
    ...(description ? { product_description: description } : {}),
    ...(tradeName ? { name: tradeName } : {}),
    ...(phone ? { support_phone: phone } : {}),
    ...(email ? { support_email: email } : {}),
  };
  return {
    ...(email ? { email } : {}),
    ...(rfcIfValid(merchant.rfc) ? { taxId: rfcIfValid(merchant.rfc)! } : {}),
    businessProfile: profile,
  };
}
