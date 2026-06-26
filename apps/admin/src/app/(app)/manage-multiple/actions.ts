"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Bulk create runs each Google Place ID through the SAME synchronous create
// pipeline as a single create: admin-create-unit awaits atlas-get-enriched-place
// (read-only enrichment) then persists places + units via atlas-save-unit-data
// and ranked images via atlas-save-place-media. The admin operator's session
// authorises the call (admin allowlist). The client invokes this once per Place
// ID (with small concurrency) so progress streams in.
//
// For large batches the staggered queue (admin-schedule-multiple-units-creation)
// is the better fit once the scheduler is live; this path runs each create inline.

type CreateUnitOk = {
  ok: true;
  venueId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  enriched: boolean;
};
type CreateUnitErr = { ok: false; error: string };
type CreateUnitResult = CreateUnitOk | CreateUnitErr;

type CreateUnitResponse = {
  venue?: { id?: string; name?: string; slug?: string | null };
  enrichment?: { photoCount?: number; profileEnriched?: boolean };
};

export async function createUnitFromPlaceId(
  placeId: string,
): Promise<CreateUnitResult> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreateUnitResponse>("admin-create-unit", {
    placeId: id,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const v = r.data.venue;
  if (!v?.id) return { ok: false, error: "No venue returned" };
  return {
    ok: true,
    venueId: v.id,
    name: v.name ?? "(unnamed)",
    slug: v.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enriched: r.data.enrichment?.profileEnriched ?? false,
  };
}
