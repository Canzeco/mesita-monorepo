import { efInvoke } from "@/lib/supabase-ef";

// Shared create-place helper. Both the single-place console and the bulk
// creator run each Google Place ID through the SAME create pipeline:
// admin-web-create-project fetches Google data and persists a minimal
// 'generating' place; deep enrichment then runs async in the Enricher cron
// pipeline (supabase-cron-enrich-place-*). The admin operator's session
// authorises the call (admin allowlist). Callers invoke this once per Place ID
// (with small concurrency for bulk) so progress streams in.

type CreatePlaceOk = {
  ok: true;
  projectId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  /** The create call enqueued async enrichment (Enricher cron pipeline). */
  enrichmentTriggered: boolean;
  enrichmentError: string | null;
};
type CreatePlaceErr = { ok: false; error: string };
type CreatePlaceResult = CreatePlaceOk | CreatePlaceErr;

type CreatedPlace = {
  id?: string;
  slug?: string | null;
  name?: string;
  status?: string;
};

type CreatePlaceResponse = {
  place?: CreatedPlace;
  enrichment?: {
    enrichmentTriggered?: boolean;
    enrichmentAsync?: boolean;
    enrichmentError?: string | null;
    photoCount?: number;
    channelCount?: number;
  };
};

type CreatePlaceErrorBody = {
  code?: string;
  error?: string;
  existing?: { id?: string; slug?: string | null; name?: string };
};

// HTTP 409 with either code (place_already_exists is current, venue_already_exists legacy).
const DUPLICATE_PLACE_CODES = new Set([
  "place_already_exists",
  "venue_already_exists",
]);

export async function createPlaceFromGooglePlaceId(
  placeId: string,
): Promise<CreatePlaceResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreatePlaceResponse>("admin-web-create-project", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate error responses carry an `existing` object.
    const body = (r.data ?? {}) as CreatePlaceErrorBody;
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

  const place = r.data.place;
  if (!place?.id) return { ok: false, error: "No place returned" };
  return {
    ok: true,
    projectId: place.id,
    name: place.name ?? "(unnamed)",
    slug: place.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enrichmentTriggered: r.data.enrichment?.enrichmentTriggered ?? false,
    enrichmentError: r.data.enrichment?.enrichmentError ?? null,
  };
}
