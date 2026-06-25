"use server";

import { efInvoke } from "@/lib/supabase-ef";

// Bulk create runs each Google Place ID through the SAME create pipeline as a
// single create: business-create-unit fetches the Google spine, synthesises
// the catalog row, inserts an unclaimed "web" listing, and hands the venue to
// Atlas (atlas-enrich-profile) for research + the image funnel. The admin
// operator's super-admin session authorises the call. The client invokes this
// once per Place ID (with small concurrency) so progress streams in.

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

  const r = await efInvoke<CreateUnitResponse>("business-create-unit", {
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
