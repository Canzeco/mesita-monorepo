// A failed run is not a profile write. Render sends this before the task
// exits so a place does not stay enriching. The row changes only while it
// is still generating: a finished write that already landed ready is left
// alone. A place that already has enriched_at goes back to ready. One that
// never finished goes to failed. Either value turns enriching off.

export type EnrichmentStop =
  | { kind: "stop"; placeId: string }
  | { kind: "not-stop" }
  | { kind: "invalid"; error: string };

export function enrichmentStop(body: unknown): EnrichmentStop {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { kind: "not-stop" };
  }
  const raw = body as { placeId?: unknown; stop?: unknown; patch?: unknown };
  if (raw.stop !== true) return { kind: "not-stop" };
  if ("patch" in raw) return { kind: "invalid", error: "a stop does not carry a profile" };
  const placeId = typeof raw.placeId === "string" ? raw.placeId.trim() : "";
  if (!placeId) return { kind: "invalid", error: "placeId is required" };
  return { kind: "stop", placeId };
}

/** null means the row is no longer enriching, so the stop writes nothing. */
export function contentStateAfterStop(row: {
  content_state: string | null;
  enriched_at: string | null;
}): "ready" | "failed" | null {
  if (row.content_state !== "generating") return null;
  return row.enriched_at && row.enriched_at.trim() ? "ready" : "failed";
}
