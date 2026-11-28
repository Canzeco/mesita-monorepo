import { formatCompactCount, formatRating } from "@/generated/shared/lib/format";
import { googleTypeEmoji } from "@/generated/shared/lib/google-type-emoji";
import { STANDARD_BONUS, voucherPct, type OfferInput } from "@/generated/shared/lib/offers";
import { formatPlacePriceLevelSymbols } from "@/generated/shared/lib/place-price";
import { computeOpenState } from "@/generated/shared/place-to-detail-helpers";

export type Point = { lat: number; lng: number };
export type ActiveLocation = Point & { name: string };

/** The built-in pin (MESITA-5008). A guest with nothing stored, and every
 *  anonymous profile, starts here. The campus point the web app uses. */
export const DISTRITO_TEC: ActiveLocation = {
  lat: 25.6514,
  lng: -100.2895,
  name: "Distrito Tec",
};

/** A stored choice, or Distrito Tec when the phone has none. */
export function withDefaultLocation(stored: ActiveLocation | null): ActiveLocation {
  return stored ?? DISTRITO_TEC;
}

/** The server's score parts (the temporary score label, MESITA-4449). */
export type Area = {
  final: number | null;
  google?: number | null;
  foursquare: { boost: number | null } | null;
  signals: { popularity: number | null; proximity: number | null };
  premierBoost: number | null;
  selectedFactor: number | null;
};

export type CatalogPlace = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  /** The raw Google type: the placeholder's emoji. */
  googleType?: string | null;
  photo: string | null;
  priceLevel: number | null;
  priceRange?: string | null;
  rating: number | null;
  reviews: number | null;
  hours: unknown;
  openNow?: boolean | null;
  opensAt?: string | null;
  closesAt?: string | null;
  timezone: string | null;
  zone: string | null;
  distanceKm: number | null;
  isPremier: boolean;
  isAd: boolean;
  /** Reserve shows when the place takes reservations and has a phone. */
  reservable?: boolean;
  lat: number | null;
  lng: number | null;
  /** A Google result Mesita has no profile for: no photo, Generate Profile. */
  googleOnly?: boolean;
  googleId?: string | null;
  offers?: OfferInput | null;
  area?: Area | null;
  lane?: string | null;
};

export const PAGE = 20;

/** The ranked ids of one page after the first. */
export function pageIds(order: readonly string[], firstPage: number, page: number): string[] {
  const from = firstPage + (page - 1) * PAGE;
  return order.slice(from, from + PAGE);
}

/** Each place once, whatever the pages repeat. */
export function uniquePlaces(pages: readonly (readonly CatalogPlace[])[]): CatalogPlace[] {
  return [...new Map(pages.flat().map((p) => [p.id, p])).values()];
}

export type Facts = {
  kind: string | null;
  price: string | null;
  rating: string | null;
  reviews: string | null;
  open: { now: boolean; when: string | null } | null;
  /** Kilometres only. The neighborhood stays off the card (MESITA-5041). */
  distance: string | null;
};

/** The words after Open or Closed. Tomorrow drops the clock so the row
 *  fits; a close later today, or an open place, keeps the hour. */
function hoursTail(openNow: boolean, when: string | null | undefined): string | null {
  const label = when?.trim();
  if (!label) return null;
  if (!openNow && /^tomorrow\b/i.test(label)) return "Open tomorrow";
  return openNow ? `until ${label}` : `opens ${label}`;
}

/** $ to $$$$ from a price range's low end ("$200–300MX" → $$): the web's
 *  priceSymbolsFromRange (home/place-facts.tsx). */
function priceFromRange(range: string | null | undefined): string | null {
  const low = Number(range?.match(/[\d.,]+/)?.[0]?.replace(/,/g, ""));
  if (!Number.isFinite(low) || low <= 0) return null;
  return "$".repeat(low < 200 ? 1 : low < 300 ? 2 : low < 500 ? 3 : 4);
}

/** A card's lines. A fact that is missing drops; nothing is guessed. The
 *  web's cardFacts with enrichPlaceOverview's fallbacks. */
export function factsOf(p: CatalogPlace): Facts {
  const kind = p.category?.trim() && p.category.trim().toLowerCase() !== "undefined" ? p.category : null;
  const state = computeOpenState(p.hours, p.timezone ?? undefined);
  const now = p.openNow ?? state.open_now;
  // The computed close first, then the column; none while open is a 24 h place.
  const closes = state.open_now === true ? state.closes_at || null : (state.closes_at || null) ?? p.closesAt ?? null;
  const opens = p.opensAt ?? (state.opens_at || null);
  const km = p.distanceKm;
  const distance = km !== null && km > 0 ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : null;
  return {
    kind,
    price: formatPlacePriceLevelSymbols(p.priceLevel) || priceFromRange(p.priceRange),
    rating: formatRating(p.rating),
    reviews: p.reviews && p.reviews > 0 ? formatCompactCount(p.reviews) : null,
    open: now === null || now === undefined ? null : { now, when: hoursTail(now, now ? closes : opens) },
    distance,
  };
}

export type Placeholder = { kind: "emoji"; emoji: string } | { kind: "initial"; text: string };

/** What a card draws with no photo: the web's placePlaceholder. */
export function placeholderOf(p: Pick<CatalogPlace, "name" | "googleType">): Placeholder {
  const emoji = googleTypeEmoji(p.googleType);
  if (emoji) return { kind: "emoji", emoji };
  return { kind: "initial", text: p.name.trim().slice(0, 1).toUpperCase() || "·" };
}

export type CardOffer = { key: "prepay" | "pay"; words: string };

/** The photo's offers, Prepay left and Pay right (the web's OfferDisplay,
 *  MESITA-5123): Medium's bonus where the place sells it, else the best
 *  standard voucher on sale; Pay is the highest cashback line. None for a
 *  Google-only row. */
export function cardOffers(p: Pick<CatalogPlace, "offers" | "googleOnly">): CardOffer[] {
  const offers = p.googleOnly ? null : p.offers;
  if (!offers) return [];
  const prepay = offers.sell.includes("voucher_1000")
    ? voucherPct(offers, "voucher_1000")
    : Math.max(0, ...Object.keys(STANDARD_BONUS).filter((k) => offers.sell.includes(k)).map((k) => voucherPct(offers, k)));
  const pay = offers.cashback_pct ?? 0;
  return [
    ...(prepay > 0 ? [{ key: "prepay" as const, words: `Prepay ${prepay}%` }] : []),
    ...(pay > 0 ? [{ key: "pay" as const, words: `Pay ${pay}%` }] : []),
  ];
}

/** `code`: the guest's share code (MESITA-5060), so the opens and new guests
 *  this link brings are counted. */
export function shareUrl(p: Pick<CatalogPlace, "id" | "slug">, code: string | null = null): string {
  const url = `https://mesita.ai/place/${encodeURIComponent(p.slug || p.id)}`;
  return code ? `${url}?s=${encodeURIComponent(code)}` : url;
}

export function readActiveLocation(raw: string | null): ActiveLocation | null {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<ActiveLocation> | null;
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    return { lat: v.lat, lng: v.lng, name: typeof v.name === "string" ? v.name : "Your location" };
  } catch {
    return null;
  }
}
