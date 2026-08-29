import { efInvoke } from "@/lib/supabase-ef";

// Shared create-place helper. Both the single-place console and the bulk
// creator run each Google Place ID through the SAME create pipeline:
// admin-web-create-project fetches Google data and persists the ugly
// profile (ready, not Enriched). Intaker is not queued — Enrich /
// Create+Enrich is a second call. The admin operator's session authorises
// the call (admin allowlist). Callers invoke this once per Place ID.

type CreatePlaceOk = {
  ok: true;
  projectId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  /** Already on Mesita — the batch continues; this row was not re-created. */
  alreadyExisted: boolean;
  /** The create call enqueued async enrichment (Intaker cron pipeline). */
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
      const existingId = body.existing?.id;
      if (!existingId) {
        return { ok: false, error: "This place is already on Mesita." };
      }
      return {
        ok: true,
        alreadyExisted: true,
        projectId: existingId,
        name: body.existing?.name ?? "(already on Mesita)",
        slug: body.existing?.slug ?? null,
        photoCount: 0,
        enrichmentTriggered: false,
        enrichmentError: null,
      };
    }
    return { ok: false, error: r.error };
  }

  const place = r.data.place;
  if (!place?.id) return { ok: false, error: "No place returned" };
  return {
    ok: true,
    alreadyExisted: false,
    projectId: place.id,
    name: place.name ?? "(unnamed)",
    slug: place.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enrichmentTriggered: r.data.enrichment?.enrichmentTriggered ?? false,
    enrichmentError: r.data.enrichment?.enrichmentError ?? null,
  };
}
