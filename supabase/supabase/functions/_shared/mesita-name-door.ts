// The ONE door through which the Intaker may write `mesita_name` (§8.4 v3).
//
// The Description function infers a clean Mesita display name; this door
// decides whether that inference may land. THE LAW (gate D2, 2026-08-29 —
// provenance, not equality-proxy):
//   write ONLY when the current mesita_name is
//     · NULL/blank (never named), or
//     · exactly the google_name copy the create door seeded, or
//     · exactly the LAST value THIS door wrote (provenance:
//       enrichment_sources.mesita_name_inferred) — the machine may keep
//       improving its own guesses as signals get richer.
//   An operator-chosen name matches none of those and is NEVER overwritten.
//
// Provenance lives in places.enrichment_sources.mesita_name_inferred (the
// diagnostics blob the enricher inspector already renders). places.name
// stays GENERATED — nothing here writes `name`.
//
// place-name-writes.test.ts scans enrich-path files for raw `mesita_name:`
// writes; the Intaker calls THIS module instead, which is the blessed door.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writePlace } from "./place-doc.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

export type MesitaNameDoorResult = {
  wrote: boolean;
  reason: "written" | "operator" | "empty" | "unchanged" | "read_failed";
};

const norm = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

export async function applyInferredMesitaName(
  admin: SupabaseClient,
  placeId: string,
  candidateRaw: unknown,
): Promise<MesitaNameDoorResult> {
  const max = ENRICH_FIELD_LIMITS.placeName?.max ?? 80;
  const candidate = norm(candidateRaw).slice(0, max);
  if (!candidate) return { wrote: false, reason: "empty" };

  const { data, error } = await admin
    .from("places")
    .select("mesita_name, google_name, enrichment_sources")
    .eq("id", placeId)
    .maybeSingle();
  if (error || !data) return { wrote: false, reason: "read_failed" };

  const current = norm(data.mesita_name);
  const google = norm(data.google_name);
  const sources = (data.enrichment_sources ?? {}) as Record<string, unknown>;
  const lastInferred = norm(sources.mesita_name_inferred);

  const machineOwned = !current || current === google ||
    (lastInferred !== "" && current === lastInferred);
  if (!machineOwned) return { wrote: false, reason: "operator" };
  if (current === candidate) {
    // Still record provenance so a later identical google rename cannot
    // reclassify this machine value as an operator's.
    if (lastInferred !== candidate) {
      await writePlace(admin, {
        table: "places",
        mode: "update",
        id: placeId,
        patch: {
          enrichment_sources: { ...sources, mesita_name_inferred: candidate },
        },
      });
    }
    return { wrote: false, reason: "unchanged" };
  }

  const res = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: {
      mesita_name: candidate,
      enrichment_sources: { ...sources, mesita_name_inferred: candidate },
    },
  });
  if (!res.ok) return { wrote: false, reason: "read_failed" };
  return { wrote: true, reason: "written" };
}
