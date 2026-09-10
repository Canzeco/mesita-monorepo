// _shared/postgrest.ts — the two places PostgREST's shape leaks into a caller.
//
// Neither is domain logic. Both are the transport showing through, which is
// why they kept getting rewritten wherever a query got big enough to hit them.

/**
 * supabase-js types a to-one embed as `T | T[] | null` — which of the two you
 * get depends on the relationship metadata PostgREST reports, not on the row,
 * so a `select("…, place:places(*)")` is `T` in one endpoint and `T[]` in
 * another against the same table. Normalise to the first object either way.
 */
export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

/**
 * How many ids to put in one `.in()` filter.
 *
 * An `in` list rides in the URL, so a long one is a request that gets rejected
 * for its length rather than a slow query. 200 is what the two id-scoped
 * readers settled on independently.
 */
export const ID_CHUNK = 200;

/**
 * Cut `xs` into `size`-long slices for chunked `.in()` reads.
 *
 * An empty input yields NO chunks, not one empty chunk — so a caller looping
 * over the result issues ZERO queries instead of one with an empty filter,
 * which matters because an empty catalog is the common case, not the edge.
 */
export function chunked<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
