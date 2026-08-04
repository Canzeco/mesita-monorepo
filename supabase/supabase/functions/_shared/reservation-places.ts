// Attaching the place summary to reservation rows.
//
// WHY THIS EXISTS: a PostgREST embed `place:places(...)` from `reservations`
// is IMPOSSIBLE — the FK chain is two hops,
//
//   reservations.project_id → projects.id → places.id  (units_place_fk)
//
// so the embed fails at runtime with "Could not find a relationship between
// 'reservations' and 'places' in the schema cache" (hit live 2026-07-27 the
// moment the consumer Reservations tab was ungated). `slug` isn't on `places`
// either — it lives on `projects`. Both facts make the one-query embed a trap;
// this helper does the explicit lookup instead, exactly like the call engine
// (supabase-edgefunc-reservation-call) already does for a single row.
//
// One extra query per list: projects embedded with its place — that direction
// DOES have a usable FK. Callers select `project_id` on their rows and get
// back the same flat `place` shape clients already speak.
//
// NOT reservation-only despite the filename: EVERY table that points at
// projects hits this same wall — tickets, coupons, saved_places all FK to
// projects, so they use this helper too. The summary is a SUPERSET of what
// those callers need (extra keys are harmless); note which side each column
// lives on, because the old embeds got that wrong as well:
//   places   → name, category, photos, address, price_level, lat, lng
//   projects → slug, listing_type, fiscal_type, the four promo rate columns
//
// The rate columns ride along (MESITA-869) so a consumer surface can quote
// THIS place's real numbers. A membership writes them as one preset, so the
// client recovers the strategy by exact match (lib/promo-rates.ts
// strategyForPromoMatrix) — no rates blob, no extra EF, no extra query.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PlaceSummary = {
  id: string;
  /** From projects. */
  slug: string | null;
  listing_type: string | null;
  fiscal_type: string | null;
  /** From projects — the v4 preset the place is running (MESITA-869). */
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  /** From places. */
  name: string | null;
  category: string | null;
  photos: string[] | null;
  address: string | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
};

type RowWithProject = { project_id?: string | null };

/**
 * Returns the rows with `place` populated (null when the place is missing).
 * Order and every other field are preserved.
 */
export async function attachPlaces<T extends RowWithProject>(
  admin: SupabaseClient,
  rows: T[],
): Promise<Array<T & { place: PlaceSummary | null }>> {
  const ids = [...new Set(rows.map((r) => r.project_id).filter((v): v is string => !!v))];
  const byId = new Map<string, PlaceSummary>();

  if (ids.length > 0) {
    // projects.id → places.id is a real FK, so THIS embed resolves. slug comes
    // from projects; the rest from places.
    const { data } = await admin
      .from("projects")
      .select(
        "id, slug, listing_type, fiscal_type, " +
          "welcome_free_rate, welcome_premium_rate, free_rate, premium_rate, " +
          "place:places(id, name, category, photos, address, price_level, lat, lng)",
      )
      .in("id", ids);
    type Row = {
      id: string;
      slug: string | null;
      listing_type: string | null;
      fiscal_type: string | null;
      welcome_free_rate: number | null;
      welcome_premium_rate: number | null;
      free_rate: number | null;
      premium_rate: number | null;
      place:
        | {
          id: string;
          name: string | null;
          category: string | null;
          photos: string[] | null;
          address: string | null;
          price_level: number | null;
          lat: number | null;
          lng: number | null;
        }
        | null;
    };
    for (const p of (data ?? []) as unknown as Row[]) {
      byId.set(p.id, {
        id: p.id,
        slug: p.slug ?? null,
        listing_type: p.listing_type ?? null,
        fiscal_type: p.fiscal_type ?? null,
        welcome_free_rate: p.welcome_free_rate ?? null,
        welcome_premium_rate: p.welcome_premium_rate ?? null,
        free_rate: p.free_rate ?? null,
        premium_rate: p.premium_rate ?? null,
        name: p.place?.name ?? null,
        category: p.place?.category ?? null,
        photos: p.place?.photos ?? null,
        address: p.place?.address ?? null,
        price_level: p.place?.price_level ?? null,
        lat: p.place?.lat ?? null,
        lng: p.place?.lng ?? null,
      });
    }
  }

  return rows.map((r) => ({
    ...r,
    place: (r.project_id ? byId.get(r.project_id) : undefined) ?? null,
  }));
}
