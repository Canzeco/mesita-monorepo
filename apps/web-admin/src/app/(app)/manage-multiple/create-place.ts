import { efInvoke } from "@/lib/supabase-ef";

// Create-place helper, behind actions.ts for the Create box and Single Place.
// It runs each Google Place ID through the create pipeline:
// admin-web-create-place fetches Google data and persists the ugly
// profile (ready, not Enriched). Enricher is not queued — Enrich is a second
// call. The admin operator's session authorises the call (admin allowlist).
// Callers invoke this once per Place ID.

type CreatePlaceOk = {
  ok: true;
  placeId: string;
  name: string;
  /** Already on Mesita — the batch continues; this row was not re-created. */
  alreadyExisted: boolean;
  /** The create call enqueued async enrichment (Enricher cron pipeline). */
  enrichmentTriggered: boolean;
};
type CreatePlaceErr = { ok: false; error: string };
type CreatePlaceResult = CreatePlaceOk | CreatePlaceErr;

type CreatedPlace = {
  id?: string;
  name?: string;
};

type CreatePlaceResponse = {
  place?: CreatedPlace;
  enrichment?: {
    enrichmentTriggered?: boolean;
  };
};

type CreatePlaceErrorBody = {
  existing?: { id?: string; name?: string };
};

export async function createPlaceFromGooglePlaceId(
  placeId: string,
): Promise<CreatePlaceResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreatePlaceResponse>("admin-web-create-place", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate error responses carry an `existing` object.
    const body = (r.data ?? {}) as CreatePlaceErrorBody;
    if (r.status === 409 && r.code === "place_already_exists") {
      const existingId = body.existing?.id;
      if (!existingId) {
        return { ok: false, error: "This place is already on Mesita." };
      }
      return {
        ok: true,
        alreadyExisted: true,
        placeId: existingId,
        name: body.existing?.name ?? "(already on Mesita)",
        enrichmentTriggered: false,
      };
    }
    return { ok: false, error: r.error };
  }

  const place = r.data.place;
  if (!place?.id) return { ok: false, error: "No place returned" };
  return {
    ok: true,
    alreadyExisted: false,
    placeId: place.id,
    name: place.name ?? "(unnamed)",
    enrichmentTriggered: r.data.enrichment?.enrichmentTriggered ?? false,
  };
}
