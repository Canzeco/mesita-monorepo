"use server";

// Server actions for Models Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// Memo / Atlas config actions.
//
// Backed by the `models` section of admin-web-get-config /
// admin-web-update-config, which read and write the models_config jsonb blob
// on the public.app_config
// singleton. Live binding (MESITA-941): readers bind supabase / enricher.model /
// lineup / memo.* via _shared/models-config.ts; enricher.perplexity in the blob
// is still staged (Intaker uses atlas_perplexity_preset). Intaker text/image
// quality + search preset are atlas_* columns saved via the enricher section
// from this page (MESITA-1811). No client ever touches the DB.
//
// Types + catalogs live in ./types (not here) — "use server" modules may only
// export async functions to the client.

import { efInvoke } from "@/lib/supabase-ef";
import {
  updateAtlasConfig,
  type PerplexityPreset,
  type SynthesisQuality,
} from "../enricher-config/actions";
import {
  coerceModelsConfig,
  DEFAULT_INTAKER_MODEL_SETTINGS,
  type IntakerModelSettings,
  type ModelsConfig,
} from "./types";

type GetModelsConfigResult =
  | { ok: true; data: ModelsConfig }
  | { ok: false; error: string };

export async function getModelsConfig(): Promise<GetModelsConfigResult> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-get-config",
    { section: "models" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  // The EF returns { config: blob | null }; coerce merges null/partial → defaults.
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}

type UpdateModelsConfigResult =
  | { ok: true; data: ModelsConfig }
  | { ok: false; error: string };

export async function updateModelsConfig(
  config: ModelsConfig,
): Promise<UpdateModelsConfigResult> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-update-config",
    { section: "models", config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}

type AtlasModelFields = {
  atlasSynthesisQuality: SynthesisQuality;
  atlasVisionQuality: SynthesisQuality;
  atlasPerplexityPreset: PerplexityPreset;
};

type GetIntakerModelSettingsResult =
  | { ok: true; data: IntakerModelSettings }
  | { ok: false; error: string };

/** Intaker quality tiers + search preset — atlas_* on enrichment_config. */
export async function getIntakerModelSettings(): Promise<GetIntakerModelSettingsResult> {
  const r = await efInvoke<AtlasModelFields>("admin-web-get-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  const d = DEFAULT_INTAKER_MODEL_SETTINGS;
  return {
    ok: true,
    data: {
      synthesisQuality: r.data.atlasSynthesisQuality ?? d.synthesisQuality,
      visionQuality: r.data.atlasVisionQuality ?? d.visionQuality,
      perplexityPreset: r.data.atlasPerplexityPreset ?? d.perplexityPreset,
    },
  };
}

type UpdateIntakerModelSettingsResult =
  | { ok: true; data: IntakerModelSettings }
  | { ok: false; error: string };

export async function updateIntakerModelSettings(
  settings: IntakerModelSettings,
): Promise<UpdateIntakerModelSettingsResult> {
  const r = await updateAtlasConfig({
    synthesisQuality: settings.synthesisQuality,
    visionQuality: settings.visionQuality,
    perplexityPreset: settings.perplexityPreset,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      synthesisQuality: r.data.atlasSynthesisQuality,
      visionQuality: r.data.atlasVisionQuality ?? "economy",
      perplexityPreset: r.data.atlasPerplexityPreset ?? "pro-search",
    },
  };
}
