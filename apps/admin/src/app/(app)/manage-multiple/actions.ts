"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Bulk create runs each Google Place ID through the SAME create pipeline as a
// single create: admin-create-unit fetches Google data, persists places +
// units + photos, then triggers the n8n Enricher webhook — deep enrichment
// runs ASYNC in the background. The admin operator's session authorises the
// call (admin allowlist). The client invokes this once per Place ID (with
// small concurrency) so progress streams in.
//
// For large batches the staggered queue (scheduled_project_creations rows
// drained by scheduler-run-project-creations) is the better fit once the
// scheduler is live; an admin enqueue EF would need building — the old
// admin-schedule-project-creations was removed in the 2026-07-03 audit.
// This path runs each create inline.

type CreateUnitOk = {
  ok: true;
  projectId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  /** The n8n Enricher webhook accepted the job — enrichment runs async. */
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

export async function createUnitFromPlaceId(
  placeId: string,
): Promise<CreateUnitResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreateUnitResponse>("admin-create-unit", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate: HTTP 409 with code place_already_exists (legacy:
    // venue_already_exists) and an `existing` object.
    const body = (r.data ?? {}) as CreateUnitErrorBody;
    if (
      r.status === 409 &&
      (body.code === "place_already_exists" || body.code === "venue_already_exists")
    ) {
      const name = body.existing?.name;
      return {
        ok: false,
        error: name ? `Already on Mesita: ${name}` : "Already on Mesita",
      };
    }
    return { ok: false, error: r.error };
  }

  const v = r.data.place ?? r.data.venue;
  if (!v?.id) return { ok: false, error: "No place returned" };
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
