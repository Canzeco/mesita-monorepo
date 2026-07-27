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
// One extra query per list: projects (slug) embedded with its place — that
// direction DOES have a usable FK. Callers select `project_id` on the
// reservation rows and get back the same `place` shape clients already speak.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PlaceSummary = {
  id: string;
  slug: string | null;
  name: string | null;
  category: string | null;
  photos: string[] | null;
  address: string | null;
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
      .select("id, slug, place:places(id, name, category, photos, address)")
      .in("id", ids);
    type Row = {
      id: string;
      slug: string | null;
      place:
        | {
          id: string;
          name: string | null;
          category: string | null;
          photos: string[] | null;
          address: string | null;
        }
        | null;
    };
    for (const p of (data ?? []) as unknown as Row[]) {
      byId.set(p.id, {
        id: p.id,
        slug: p.slug ?? null,
        name: p.place?.name ?? null,
        category: p.place?.category ?? null,
        photos: p.place?.photos ?? null,
        address: p.place?.address ?? null,
      });
    }
  }

  return rows.map((r) => ({
    ...r,
    place: (r.project_id ? byId.get(r.project_id) : undefined) ?? null,
  }));
}
