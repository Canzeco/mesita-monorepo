"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Bulk create runs each Google Place ID through the SAME synchronous create
// pipeline as a single create: admin-create-project awaits atlas-get-enriched-place
// (read-only enrichment) then persists places + units via enricher-save-project-data
// and ranked images via enricher-save-place-media. The admin operator's session
// authorises the call (admin allowlist). The client invokes this once per Place
// ID (with small concurrency) so progress streams in.
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
  enriched: boolean;
};
type CreateUnitErr = { ok: false; error: string };
type CreateUnitResult = CreateUnitOk | CreateUnitErr;

type CreateUnitResponse = {
  place?: { id?: string; name?: string; slug?: string | null };
  enrichment?: { photoCount?: number; profileEnriched?: boolean };
};

export async function createUnitFromPlaceId(
  placeId: string,
): Promise<CreateUnitResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreateUnitResponse>("admin-create-project", {
    placeId: id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const v = r.data.place;
  if (!v?.id) return { ok: false, error: "No place returned" };
  return {
    ok: true,
    projectId: v.id,
    name: v.name ?? "(unnamed)",
    slug: v.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enriched: r.data.enrichment?.profileEnriched ?? false,
  };
}
