// Persist business-console corrections: write the pin (MESITA-2029).
//
// A business edit is authoritative for its own place. The Enricher must not
// clobber it on the next scheduled run — so every correctable field the
// console writes gets a `business`-sourced pin in `enrichment_sources.pins`.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  autoApplies,
  buildFieldPin,
  carryFieldPins,
  type CorrectionSource,
  type CorrectableField,
  correctableFieldsInPatch,
  type FieldProposal,
  mergeFieldPin,
  readFieldPins,
} from "./enrich-corrections.ts";

type Admin = SupabaseClient;

export async function persistFieldPinsForFields(
  admin: Admin,
  placeId: string,
  fields: CorrectableField[],
  source: CorrectionSource,
  confidence: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
      buildFieldPin(source, confidence, nowIso),
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

export async function persistBusinessFieldPins(
  admin: Admin,
  placeId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fields = correctableFieldsInPatch(patch);
  return await persistFieldPinsForFields(admin, placeId, fields, "business", 1);
}

/** Queue or apply a proposal from any trusted writer (reservationist, Ojo, …). */
export async function submitFieldProposal(
  admin: Admin,
  proposal: FieldProposal,
): Promise<
  | { ok: true; status: "applied" | "pending"; proposalId?: string }
  | { ok: false; error: string }
> {
  if (autoApplies(proposal)) {
    const profilePatch: Record<string, unknown> = {};
    if (proposal.field === "reservation_target") {
      if (
        proposal.value && typeof proposal.value === "object" &&
        !Array.isArray(proposal.value)
      ) {
        const v = proposal.value as Record<string, unknown>;
        if ("channel" in v) profilePatch.reservation_channel = v.channel;
        if ("value" in v) profilePatch.reservation_target = v.value;
      } else {
        profilePatch.reservation_target = proposal.value;
      }
    } else {
      profilePatch[proposal.field] = proposal.value;
    }

    const pinRes = await persistFieldPinsForFields(
      admin,
      proposal.placeId,
      [proposal.field],
      proposal.source,
      proposal.confidence,
    );
    if (!pinRes.ok) return pinRes;

    if (Object.keys(profilePatch).length > 0) {
      const { error: updErr } = await admin
        .from("place_profiles")
        .update(profilePatch)
        .eq("id", proposal.placeId);
      if (updErr) return { ok: false, error: updErr.message };
    }

    const { data: inserted, error: insErr } = await admin
      .from("place_field_proposals")
      .insert({
        place_id: proposal.placeId,
        field: proposal.field,
        proposed_value: proposal.value,
        source: proposal.source,
        confidence: proposal.confidence,
        evidence: proposal.evidence,
        observed_at: proposal.observedAt,
        status: "applied",
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true, status: "applied", proposalId: inserted?.id as string };
  }

  const { data: queued, error: qErr } = await admin
    .from("place_field_proposals")
    .insert({
      place_id: proposal.placeId,
      field: proposal.field,
      proposed_value: proposal.value,
      source: proposal.source,
      confidence: proposal.confidence,
      evidence: proposal.evidence,
      observed_at: proposal.observedAt,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };
  return { ok: true, status: "pending", proposalId: queued?.id as string };
}
