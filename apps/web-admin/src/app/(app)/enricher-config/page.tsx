import { getAtlasSettings } from "./actions";
import { IntakeClient } from "./IntakeClient";
import { type IntakeSettings } from "./intake-guards";

// INTAKE — how a place becomes a profile. Four modules: Models · Create ·
// Enrich · Functions. Search eligibility is Discovery › Map, not this page.
//
// One GET, seeded server-side. A failed load blocks Save so client
// defaults cannot overwrite the live singleton (MESITA-737).
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
  discoverWebsiteN: 5,
  discoverInstagramN: 5,
  discoverFacebookN: 3,
  discoverOpentableN: 3,
  discoverUbereatsN: 0,
  requestThreshold: 5,
};

export default async function IntakePage() {
  const settings = await getAtlasSettings();

  return (
    <IntakeClient
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
              discoverWebsiteN: settings.data.atlasDiscoverWebsiteN,
              discoverInstagramN: settings.data.atlasDiscoverInstagramN,
              discoverFacebookN: settings.data.atlasDiscoverFacebookN,
              discoverOpentableN: settings.data.atlasDiscoverOpentableN,
              discoverUbereatsN: settings.data.atlasDiscoverUbereatsN,
              requestThreshold: settings.data.atlasRequestThreshold ?? 5,
            }
          : SETTINGS_FALLBACK
      }
      settingsUpdatedAt={settings.ok ? settings.data.updatedAt : null}
      settingsLoadError={settings.ok ? null : settings.error}
    />
  );
}
