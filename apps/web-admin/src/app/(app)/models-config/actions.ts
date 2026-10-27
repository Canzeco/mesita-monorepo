"use server";

// Server actions for Models Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// other config pages.
//
// models_config: the `models` section of admin-web-get-config /
// admin-web-update-config (whole blob). The Enricher's three picks live on
// enrichment_config and go through the `enricher` section as a PATCH of only
// the changed fields (MESITA-2126). Tiers are normalized here, on the way in
// and on the way out, so a stored legacy "high" never reaches the page and
// never makes it look dirty. No client ever touches the DB.
//
// Types + catalogs live in ./types (not here) — "use server" modules may only
// export async functions to the client.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { normalizeTier } from "@/lib/synthesis-quality";
import {
  updateAtlasConfig,
  type PerplexityPreset,
} from "../enricher-config/actions";
import {
  coerceModelsConfig,
  type EnricherModelSettings,
  type ModelsConfig,
} from "./types";

export async function getModelsConfig(): Promise<ActionResult<{ data: ModelsConfig }>> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-get-config",
    { section: "models" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  // The EF returns { config: blob | null }; coerce merges null/partial → defaults.
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}

export async function updateModelsConfig(
  config: ModelsConfig,
): Promise<ActionResult<{ data: ModelsConfig }>> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-update-config",
    { section: "models", config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}

type AtlasModelFields = {
  enrichSynthesisQuality?: unknown;
  enrichVisionQuality?: unknown;
  enrichPerplexityPreset?: PerplexityPreset | null;
};

function toSettings(d: AtlasModelFields): EnricherModelSettings {
  return {
    synthesisQuality: normalizeTier(d.enrichSynthesisQuality),
    visionQuality: normalizeTier(d.enrichVisionQuality),
    perplexityPreset: d.enrichPerplexityPreset ?? "pro-search",
  };
}

/** Enricher quality tiers + search preset — enrichment_config, tiers normalized. */
export async function getEnricherModelSettings(): Promise<
  ActionResult<{ data: EnricherModelSettings }>
> {
  const r = await efInvoke<AtlasModelFields>("admin-web-get-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: toSettings(r.data) };
}

/** PATCH only the fields that changed; returns the stored settings, normalized. */
export async function updateEnricherModelSettings(
  patch: Partial<EnricherModelSettings>,
): Promise<ActionResult<{ data: EnricherModelSettings }>> {
  const r = await updateAtlasConfig(patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: toSettings(r.data) };
}
