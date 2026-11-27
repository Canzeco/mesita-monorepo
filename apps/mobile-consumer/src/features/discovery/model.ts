import { formatCompactCount, formatRating } from "@/generated/shared/lib/format";
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

export type CatalogPlace = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  photo: string | null;
  priceLevel: number | null;
  rating: number | null;
  reviews: number | null;
  hours: unknown;
  timezone: string | null;
  zone: string | null;
  distanceKm: number | null;
  isPremier: boolean;
  isAd: boolean;
  /** Reserve shows when the place takes reservations and has a phone. */
  reservable?: boolean;
  lat: number | null;
  lng: number | null;
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
  where: string | null;
};

/** A card's lines. A fact that is missing drops; nothing is guessed. */
export function factsOf(p: CatalogPlace): Facts {
  const kind = p.category?.trim() && p.category.trim().toLowerCase() !== "undefined" ? p.category : null;
  const state = computeOpenState(p.hours, p.timezone ?? undefined);
  const when = state.open_now ? state.closes_at : state.opens_at;
  const km = p.distanceKm;
  const distance = km !== null && km > 0 ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km` : null;
  const level = p.priceLevel ? Math.round(p.priceLevel) : 0;
  return {
    kind,
    price: level >= 1 && level <= 4 ? "$".repeat(level) : null,
    rating: formatRating(p.rating),
    reviews: p.reviews && p.reviews > 0 ? formatCompactCount(p.reviews) : null,
    open:
      state.open_now === null
        ? null
        : { now: state.open_now, when: when ? `${state.open_now ? "until" : "opens"} ${when}` : null },
    where: [distance, p.zone?.trim() || null].filter(Boolean).join(" · ") || null,
  };
}

export function shareUrl(p: Pick<CatalogPlace, "id" | "slug">): string {
  return `https://mesita.ai/place/${encodeURIComponent(p.slug || p.id)}`;
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
