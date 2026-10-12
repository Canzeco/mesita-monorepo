import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { normalizeTier } from "@/lib/synthesis-quality";
import { getAtlasSettings } from "./actions";
import { CrenupClient } from "./CrenupClient";
import { type CrenupSettings } from "./crenup-guards";
import { INTAKE_PARENT } from "./nav";

// How a place becomes a profile, as one page: Intake (MESITA-2159 merged
// Creation and Enrichment) — Models · Create · Enrich · Functions. Search
// eligibility is Discovery › Map, not here.
//
// One GET, seeded server-side. A failed load blocks Save so
// client defaults cannot overwrite the live singleton (MESITA-737).

const SETTINGS_FALLBACK: CrenupSettings = {
  gatherGoogleImages: 10,
  gatherInstagramDepth: 10,
  gatherReviews: 100,
  imageVisionEnabled: true,
  saveImagesToStorage: true,
  saveTotalImages: 10,
  analyzeGoogleImages: 10,
  analyzeInstagramImages: 10,
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

export async function CrenupPage() {
  const settings = await getAtlasSettings();
  const title = INTAKE_PARENT.label;

  return (
    <ConfigPageLayout eyebrow={`Operations · ${title}`} title={title}>
    <CrenupClient
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
              synthesisQuality: normalizeTier(settings.data.atlasSynthesisQuality),
              visionQuality: normalizeTier(settings.data.atlasVisionQuality),
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
      // Read-only, straight from `_shared/crenup-prompts.ts`. No fallback: a
      // prompt the console invented would be worse than one it cannot show.
      prompts={settings.ok ? (settings.data.crenupPromptsMeta ?? []) : []}
    />
    </ConfigPageLayout>
  );
}
