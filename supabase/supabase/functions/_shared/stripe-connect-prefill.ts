// Stripe Express hosted onboarding prefills from the organization's places.
//
// Stripe does not take form values on accountLinks.create. Prefill is written
// onto the Account BEFORE the first Account Link (after that, Express with
// requirement_collection=stripe locks KYC). Missing MCC is how restaurants
// saw Industry=Software: Stripe falls back to the platform MCC (5734).
//
// Atlas already classified the place. LLM is only for the leftover: undefined
// category, a tied mix of supers, or a missing product description. Fail-open:
// a missing key or a slow model still mints the link.

import {
  familiesForAtlasCategory,
  familiesForPlace,
  sanitizeFamilyKeys,
  type FamilyKey,
} from "./place-taxonomy.ts";
import { OPENAI_URL } from "./enrich-config.ts";
import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

/** Mexican RFC (persona moral 12 / física 13). Same shape as the dropped CFDI check. */
export const MEXICO_RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

/** Stripe's product_description cap. Keep the hosted field short. */
export const PRODUCT_DESCRIPTION_MAX = 400;

/** Don't stall Connect on a hung model. Deterministic prefill already ran. */
export const PREFILL_LLM_TIMEOUT_MS = 4000;

/**
 * Hospitality MCCs we will actually send. Closed so a model cannot pick the
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

export type OrgPrefillRow = {
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

export function rfcIfValid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const rfc = raw.trim().toUpperCase();
  return MEXICO_RFC_RE.test(rfc) ? rfc : null;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return EMAIL_RE.test(t) ? t : null;
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
 * One MCC for the org. Majority wins; a restaurant/bar tie prefers restaurants
 * (Mesita's default hospitality) rather than calling the model.
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

export function deterministicConnectPrefill(
  org: OrgPrefillRow,
  places: PlacePrefillRow[],
): ConnectPrefill {
  const url = firstOf(places, (p) => asHttpsUrl(p.website_url)) ??
    firstOf(places, (p) => asHttpsUrl(p.instagram_url));
  const email = firstOf(places, (p) => asEmail(p.email));
  const phone = firstOf(places, (p) => asPhone(p.phone));
  const description = firstOf(places, (p) => trimProductDescription(p.description));
  const tradeName = (org.name || "").trim() ||
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
    ...(rfcIfValid(org.rfc) ? { taxId: rfcIfValid(org.rfc)! } : {}),
    businessProfile: profile,
  };
}

export function needsLlmDescription(places: PlacePrefillRow[]): boolean {
  return places.length > 0 &&
    firstOf(places, (p) => trimProductDescription(p.description)) === null;
}

export function needsLlmMcc(places: PlacePrefillRow[]): boolean {
  return places.length > 0 && mccFromPlaces(places) === null;
}

export function parseLlmPrefill(raw: string): {
  mcc: string | null;
  product_description: string | null;
} {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return { mcc: null, product_description: null };
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const mccRaw = typeof parsed.mcc === "string" ? parsed.mcc.trim() : "";
    const mcc = ALLOWED_CONNECT_MCCS.has(mccRaw) ? mccRaw : null;
    return {
      mcc,
      product_description: trimProductDescription(parsed.product_description),
    };
  } catch {
    return { mcc: null, product_description: null };
  }
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

function placeLines(places: PlacePrefillRow[]): string {
  return places.slice(0, 8).map((p, i) => {
    const families = familiesForPlace({
      category: p.category,
      family_keys: p.family_keys,
    }).join(",");
    return [
      `${i + 1}. ${p.name ?? "unnamed"}`,
      p.category_label || p.category ? `category=${p.category_label || p.category}` : "",
      families ? `supers=${families}` : "",
      p.description ? `about=${trimProductDescription(p.description) ?? p.description.slice(0, 280)}` : "",
    ].filter(Boolean).join(" | ");
  }).join("\n");
}

export async function completePrefillWithLlm(opts: {
  places: PlacePrefillRow[];
  needMcc: boolean;
  needDescription: boolean;
  openaiKey: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ mcc: string | null; product_description: string | null }> {
  const empty = { mcc: null, product_description: null };
  const key = (opts.openaiKey ?? "").trim();
  if (!key || (!opts.needMcc && !opts.needDescription)) return empty;
  const catalog = Object.entries(CONNECT_MCCS)
    .map(([k, code]) => `${code} ${k}`)
    .join(", ");
  const system =
    "You classify a hospitality business for Stripe Connect onboarding. " +
    "Reply with JSON only: {\"mcc\":\"<4-digit>\",\"product_description\":\"...\"}. " +
    `mcc MUST be one of: ${catalog}. ` +
    "product_description is 2 short sentences in English about what the business sells, no marketing fluff.";
  const user =
    `Need mcc: ${opts.needMcc}\nNeed description: ${opts.needDescription}\n\nPlaces:\n${placeLines(opts.places)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    opts.timeoutMs ?? PREFILL_LLM_TIMEOUT_MS,
  );
  try {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const res = await fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: DEFAULT_MODELS_CONFIG.enricher.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[stripe-connect-prefill] openai", res.status, await res.text());
      return empty;
    }
    const body = await res.json() as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    return typeof text === "string" ? parseLlmPrefill(text) : empty;
  } catch (e) {
    console.error("[stripe-connect-prefill] openai", (e as Error).message);
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveConnectPrefill(opts: {
  org: OrgPrefillRow;
  places: PlacePrefillRow[];
  openaiKey: string | undefined;
  fetchImpl?: typeof fetch;
}): Promise<ConnectPrefill> {
  const base = deterministicConnectPrefill(opts.org, opts.places);
  const needMcc = needsLlmMcc(opts.places);
  const needDescription = needsLlmDescription(opts.places);
  if (!needMcc && !needDescription) return base;
  const llm = await completePrefillWithLlm({
    places: opts.places,
    needMcc,
    needDescription,
    openaiKey: opts.openaiKey,
    fetchImpl: opts.fetchImpl,
  });
  const profile = { ...base.businessProfile };
  if (needMcc && llm.mcc) profile.mcc = llm.mcc;
  if (needDescription && llm.product_description) {
    profile.product_description = llm.product_description;
  }
  return { ...base, businessProfile: profile };
}
