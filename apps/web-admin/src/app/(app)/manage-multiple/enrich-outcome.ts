// What one Deep Enrich start means for each place it carried (MESITA-3942).
// The EF answers `skipped` for places with an owner and places a run already
// holds; those were NOT started, so they must never read as started.

export type EnrichOutcome =
  | { ok: true; data: "started" | "skipped" }
  | { ok: false; error: string };

export type EnrichStart =
  | { ok: true; data: { skipped: string[] } }
  | { ok: false; error: string };

/** One result per place in the chunk, keyed by the Mesita place id. */
export function enrichOutcomes(
  chunk: string[],
  r: EnrichStart,
): Array<readonly [string, EnrichOutcome]> {
  if (!r.ok) return chunk.map((id) => [id, { ok: false, error: r.error }] as const);
  const skipped = new Set(r.data.skipped);
  return chunk.map(
    (id) => [id, { ok: true, data: skipped.has(id) ? "skipped" : "started" }] as const,
  );
}
