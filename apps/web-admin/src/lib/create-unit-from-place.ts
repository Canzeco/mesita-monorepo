import { efInvoke } from "@/lib/supabase-ef";

// Shared create-place helper. Both the single-place console and the bulk
// creator run each Google Place ID through the SAME create pipeline:
// admin-web-create-project calls createMinimalPlace inline — Google identity
// data, the place + photo rows, then a `place_research` seed. Deep enrichment
// is NOT part of this call: the pg_cron poller drains that queue through
// supabase-cron-enrich-place-{research,analysis,contents} minutes later, so a
// created place comes back 'generating' and fills in over time. The admin
// operator's session authorises the call (admin allowlist). Callers invoke
// this once per Place ID (with small concurrency for bulk) so progress
// streams in.

export type CreateUnitOk = {
  ok: true;
  projectId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  /** The `place_research` seed landed — the cron poller will pick it up. */
  enrichmentTriggered: boolean;
};
export type CreateUnitErr = { ok: false; error: string };
export type CreateUnitResult = CreateUnitOk | CreateUnitErr;

type CreatedPlace = {
  id?: string;
  slug?: string | null;
  name?: string;
  status?: string;
};

type CreateUnitResponse = {
  place?: CreatedPlace;
  enrichment?: {
    enrichmentTriggered?: boolean;
    enrichmentAsync?: boolean;
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

  const r = await efInvoke<CreateUnitResponse>("admin-web-create-project", {
    placeId: id,
  });
  if (!r.ok) {
    // Duplicate: HTTP 409 with code place_already_exists and an `existing`
    // object. The code can arrive at either level — the wrapper lifts it when
    // the body parses, so check both.
    const body = (r.data ?? {}) as CreateUnitErrorBody;
    if (
      r.status === 409 &&
      (r.code === "place_already_exists" ||
        body.code === "place_already_exists")
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
  };
}
