import { efInvoke } from "@/lib/supabase-ef";

// Shared create-place helper. Both the single-place console and the bulk
// creator run each Google Place ID through the SAME create pipeline:
// admin-web-create-project fetches Google data and persists a minimal
// 'generating' place; deep enrichment then runs async in the Enricher cron
// pipeline (supabase-cron-enrich-place-*). The admin operator's session
// authorises the call (admin allowlist). Callers invoke this once per Place ID
// (with small concurrency for bulk) so progress streams in.

type CreateUnitOk = {
  ok: true;
  projectId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  /** The create call enqueued async enrichment (Enricher cron pipeline). */
  enrichmentTriggered: boolean;
  enrichmentError: string | null;
};
type CreateUnitErr = { ok: false; error: string };
type CreateUnitResult = CreateUnitOk | CreateUnitErr;

type CreatedPlace = {
  id?: string;
  slug?: string | null;
  name?: string;
  status?: string;
};

type CreateUnitResponse = {
  place?: CreatedPlace;
  /** Legacy alias of `place` — same object. */
  venue?: CreatedPlace;
  enrichment?: {
    enrichmentTriggered?: boolean;
    enrichmentAsync?: boolean;
    enrichmentError?: string | null;
    photoCount?: number;
    channelCount?: number;
  };
};

type CreateUnitErrorBody = {
  code?: string;
  error?: string;
  existing?: { id?: string; slug?: string | null; name?: string };
};

// HTTP 409 with either code (place_already_exists is current, venue_already_exists legacy).
const DUPLICATE_PLACE_CODES = new Set([
  "place_already_exists",
  "venue_already_exists",
]);

export async function createUnitFromPlaceId(
  placeId: string,
): Promise<CreateUnitResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreateUnitResponse>("admin-web-create-project", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate error responses carry an `existing` object.
    const body = (r.data ?? {}) as CreateUnitErrorBody;
    if (
      r.status === 409 &&
      (DUPLICATE_PLACE_CODES.has(r.code ?? "") ||
        DUPLICATE_PLACE_CODES.has(body.code ?? ""))
    ) {
      const name = body.existing?.name;
      return {
        ok: false,
        error: name
          ? `${name} is already on Mesita.`
          : "This place is already on Mesita.",
      };
    }
    return { ok: false, error: r.error };
  }

  const v = r.data.place;
  if (!v?.id) return { ok: false, error: "No unit returned" };
  return {
    ok: true,
    projectId: v.id,
    name: v.name ?? "(unnamed)",
    slug: v.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enrichmentTriggered: r.data.enrichment?.enrichmentTriggered ?? false,
    enrichmentError: r.data.enrichment?.enrichmentError ?? null,
  };
}
