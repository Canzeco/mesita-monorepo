// The ONE door through which the Enricher may write `place_profiles.name`
// (§8.4 v3; MESITA-2828: `name` is the stored Mesita name, `mesita_name` is gone).
//
// The Description function infers a clean Mesita name; this door decides
// whether that inference may land. THE LAW (gate D2; MESITA-2829):
//   the operator's name is NEVER overwritten. An operator edit records `name`
//   in enrichment_sources.operator_fields (_shared/operator-fields.ts); while
//   the mark stands the door writes nothing, and the operator's Reset on
//   Basics clears it so the next inference lands again.
//   Until 2026-10-27 the gate was provenance (blank / Google's copy / the
//   door's own last value); the explicit mark replaces it, so a Reset can
//   hand the name back to the machine.
//
// Provenance still lives in place_profiles.enrichment_sources.name_inferred
// (the diagnostics blob the enricher inspector renders).
//
// place-name-writes.test.ts scans enrich-path files for raw `name:` writes;
// the Enricher calls THIS module instead, which is the blessed door.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writePlace } from "./place-doc.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { readOperatorFields } from "./operator-fields.ts";

export type PlaceNameDoorResult = {
  wrote: boolean;
  reason: "written" | "operator" | "empty" | "unchanged" | "read_failed";
};

/** Where the door keeps the last name it wrote. */
export const NAME_INFERRED_KEY = "name_inferred";

const norm = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

export async function applyInferredPlaceName(
  admin: SupabaseClient,
  placeId: string,
  candidateRaw: unknown,
): Promise<PlaceNameDoorResult> {
  const max = ENRICH_FIELD_LIMITS.placeName?.max ?? 80;
  const candidate = norm(candidateRaw).slice(0, max);
  if (!candidate) return { wrote: false, reason: "empty" };

  const { data, error } = await admin
    .from("place_profiles")
    .select("name, enrichment_sources")
    .eq("id", placeId)
    .maybeSingle();
  if (error || !data) return { wrote: false, reason: "read_failed" };

  const current = norm(data.name);
  const sources = (data.enrichment_sources ?? {}) as Record<string, unknown>;
  const lastInferred = norm(sources[NAME_INFERRED_KEY]);

  if (readOperatorFields(sources).includes("name")) {
    return { wrote: false, reason: "operator" };
  }
  if (current === candidate) {
    // Still record provenance so a later identical google rename cannot
    // reclassify this machine value as an operator's.
    if (lastInferred !== candidate) {
      await writePlace(admin, {
        table: "place_profiles",
        mode: "update",
        id: placeId,
        patch: {
          enrichment_sources: { ...sources, [NAME_INFERRED_KEY]: candidate },
        },
      });
    }
    return { wrote: false, reason: "unchanged" };
  }

  const res = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: {
      name: candidate,
      enrichment_sources: { ...sources, [NAME_INFERRED_KEY]: candidate },
    },
  });
  if (!res.ok) return { wrote: false, reason: "read_failed" };
  return { wrote: true, reason: "written" };
}
