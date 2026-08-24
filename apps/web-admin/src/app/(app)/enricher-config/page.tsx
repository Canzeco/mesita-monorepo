import { getSourcingConfig } from "../sourcing-config/actions";
import { DEFAULT_CONFIG } from "../sourcing-config/catalog";
import { getAtlasSettings } from "./actions";
import { IntakeClient, type IntakeSettings } from "./IntakeClient";

// INTAKE — how a place gets into Mesita and becomes a profile, on one page.
// Five sections in Pato's order (MESITA-1287): the sourcing gate · Create
// explained · Enrich explained · the twelve functions with their params ·
// the shared models and the cost ceiling.
//
// TWO READS, seeded server-side so the page renders with real values and no
// spinner. Either can fail on its own: a failed half renders its own note and
// blocks Save, because a whole-blob write from a failed load would overwrite
// the live singleton with defaults (MESITA-737).
export const dynamic = "force-dynamic";

const SETTINGS_FALLBACK: IntakeSettings = {
  gatherGoogleImages: 10,
  gatherInstagramDepth: 30,
  gatherReviews: 100,
  imageVisionEnabled: true,
  saveImagesToStorage: true,
  saveTotalImages: 10,
  analyzeGoogleImages: 10,
  analyzeInstagramImages: 20,
  imageAnalysisPrompt: "",
  imageSortingPrompt: "",
  synthesisQuality: "economy",
  visionQuality: "economy",
  perplexityPreset: "pro-search",
  perRunCostCapUsd: 1,
  discoverWebsiteN: 5,
  discoverInstagramN: 5,
  discoverFacebookN: 3,
  discoverOpentableN: 3,
  discoverUbereatsN: 0,
};

export default async function IntakePage() {
  const [sourcing, settings] = await Promise.all([
    getSourcingConfig(),
    getAtlasSettings(),
  ]);

  return (
    <IntakeClient
      initialSourcing={sourcing.ok ? sourcing.config : DEFAULT_CONFIG}
      sourcingUpdatedAt={sourcing.ok ? sourcing.updatedAt : null}
      sourcingLoadError={sourcing.ok ? null : sourcing.error}
      initialSettings={
        settings.ok
          ? {
              gatherGoogleImages: settings.data.atlasGatherGoogleImages,
              gatherInstagramDepth: settings.data.atlasGatherInstagramDepth,
              gatherReviews: settings.data.atlasGatherReviews,
              imageVisionEnabled: settings.data.atlasImageVisionEnabled,
              saveImagesToStorage: settings.data.atlasSaveImagesToStorage,
              saveTotalImages: settings.data.atlasSaveTotalImages,
              analyzeGoogleImages: settings.data.atlasAnalyzeGoogleImages,
              analyzeInstagramImages:
                settings.data.atlasAnalyzeInstagramImages,
              imageAnalysisPrompt: settings.data.atlasImageAnalysisPrompt,
              imageSortingPrompt: settings.data.atlasImageSortingPrompt,
              synthesisQuality: settings.data.atlasSynthesisQuality,
              visionQuality: settings.data.atlasVisionQuality ?? "economy",
              perplexityPreset:
                settings.data.atlasPerplexityPreset ?? "pro-search",
              perRunCostCapUsd: settings.data.atlasPerRunCostCapUsd ?? 1,
              discoverWebsiteN: settings.data.atlasDiscoverWebsiteN,
              discoverInstagramN: settings.data.atlasDiscoverInstagramN,
              discoverFacebookN: settings.data.atlasDiscoverFacebookN,
              discoverOpentableN: settings.data.atlasDiscoverOpentableN,
              discoverUbereatsN: settings.data.atlasDiscoverUbereatsN,
            }
          : SETTINGS_FALLBACK
      }
      settingsUpdatedAt={settings.ok ? settings.data.updatedAt : null}
      settingsLoadError={settings.ok ? null : settings.error}
    />
  );
}
