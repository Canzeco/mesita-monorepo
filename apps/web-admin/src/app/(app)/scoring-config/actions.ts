import { efInvoke } from "@/lib/supabase-ef";

// Sample places for the Scoring Config simulator's worked examples.
//
// Clients never touch the DB — this goes through `admin-web-search-places`,
// the same EF the Manage Single catalog uses. An empty query returns the
// most-recently-touched places, so we over-fetch and shuffle rather than
// ordering by recency: the simulator is meant to show a spread of real places,
// not the five someone edited this morning.
//
// NOT a "use server" module: only the page (a server component) calls this, and
// that directive would forbid every non-async export — the SAMPLE_MAX const
// below included, which fails the build rather than typecheck. Nothing else is
// needed to keep it off the client: `efInvoke` pulls in next/headers, so a
// client import fails on its own.

/** Max examples rendered. Beyond ~10 the matrix stops being readable. */
export const SAMPLE_MAX = 10;

/** How many to pull before shuffling. The EF caps `limit` at 50. */
const POOL = 50;

export type SamplePlace = {
  id: string;
  name: string;
  categoryLabel: string | null;
  googleStars: number | null;
  googleReviews: number | null;
};

type Hit = {
  id: string;
  name: string;
  category_label: string | null;
  category: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
};

export type SampleResult =
  | { ok: true; places: SamplePlace[] }
  | { ok: false; error: string };

export async function sampleplaces(): Promise<SampleResult> {
  const r = await efInvoke<{ places: Hit[] }>("admin-web-search-places", {
    query: "",
    limit: POOL,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const rows = Array.isArray(r.data?.places) ? r.data.places : [];

  // Fisher-Yates over a copy, then take the head. A random sample, not the
  // newest — the whole point of the examples is that they differ from run to
  // run and from each other.
  const pool = [...rows];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return {
    ok: true,
    places: pool.slice(0, SAMPLE_MAX).map((p) => ({
      id: p.id,
      name: p.name,
      categoryLabel: p.category_label ?? p.category ?? null,
      googleStars: typeof p.google_stars_overall === "number" ? p.google_stars_overall : null,
      googleReviews: typeof p.google_review_count === "number" ? p.google_review_count : null,
    })),
  };
}
