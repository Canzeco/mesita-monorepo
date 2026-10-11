// Persist business-console corrections: write the pin (MESITA-2029).
//
// A business edit is authoritative for its own place. The Enricher must not
// clobber it on the next scheduled run — so every correctable field the
// console writes gets a `business`-sourced pin in `enrichment_sources.pins`.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  buildFieldPin,
  carryFieldPins,
  correctableFieldsInPatch,
  mergeFieldPin,
  readFieldPins,
} from "./enrich-corrections.ts";

export async function persistBusinessFieldPins(
  admin: SupabaseClient,
  placeId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fields = correctableFieldsInPatch(patch);
  if (fields.length === 0) return { ok: true };

  const { data: row, error: readErr } = await admin
    .from("place_profiles")
    .select("enrichment_sources")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: "place_profiles row missing" };

  const nowIso = new Date().toISOString();
  let pins = readFieldPins(
    (row as { enrichment_sources?: unknown }).enrichment_sources,
  );
  for (const field of fields) {
    pins = mergeFieldPin(
      pins,
      field,
      buildFieldPin("business", 1, nowIso),
    );
  }

  const rawSources = (row as { enrichment_sources?: unknown }).enrichment_sources;
  const baseSources = rawSources && typeof rawSources === "object"
    ? { ...(rawSources as Record<string, unknown>) }
    : {};
  const sources = carryFieldPins(baseSources, pins);

  const { error: writeErr } = await admin
    .from("place_profiles")
    .update({ enrichment_sources: sources })
    .eq("id", placeId);
  if (writeErr) return { ok: false, error: writeErr.message };
  return { ok: true };
}
