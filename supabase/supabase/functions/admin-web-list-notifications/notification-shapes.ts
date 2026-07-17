// supabase-js types a to-one embed as `T | T[] | null` depending on the
// relationship metadata; normalise to the first object either way.
export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

export type PlaceRef = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  categoryLabel: string | null;
  googlePlaceId: string | null;
} | null;

export type PlaceShape = {
  id: string;
  // `slug` is a projects-only column — the base public.places table has none.
  // Sources embedded via the places FK (steps) can't select it, so it's
  // optional here and defaults to null in placeRef. The claims source hops
  // through projects and DOES carry it (see projectPlaceRef).
  slug?: string | null;
  name: string | null;
  address: string | null;
  category_label: string | null;
  google_place_id: string | null;
};

export function placeRef(v: PlaceShape | null): PlaceRef {
  if (!v) return null;
  return {
    id: v.id,
    slug: v.slug ?? null,
    name: v.name ?? "(unnamed place)",
    address: v.address,
    categoryLabel: v.category_label,
    googlePlaceId: v.google_place_id,
  };
}

// A place profile reached by hopping project_verifications → projects → places.
// `slug` comes from the projects entity; the profile fields come from the
// nested places embed. Shared PK means projects.id === places.id, so we key
// the ref on the projects id.
export type ProjectPlaceShape = {
  id: string;
  slug: string | null;
  place:
    | Omit<PlaceShape, "id" | "slug">
    | Array<Omit<PlaceShape, "id" | "slug">>
    | null;
};

export function projectPlaceRef(p: ProjectPlaceShape | null): PlaceRef {
  if (!p) return null;
  const pl = one(p.place);
  return {
    id: p.id,
    slug: p.slug ?? null,
    name: pl?.name ?? "(unnamed place)",
    address: pl?.address ?? null,
    categoryLabel: pl?.category_label ?? null,
    googlePlaceId: pl?.google_place_id ?? null,
  };
}

export function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}
