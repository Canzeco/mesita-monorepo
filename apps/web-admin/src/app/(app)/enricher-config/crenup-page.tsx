import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { getAtlasSettings } from "./actions";
import { CrenupClient } from "./CrenupClient";
import type { CrenupView } from "./SectionStrip";
import { type CrenupSettings } from "./crenup-guards";

// How a place becomes a profile, as two pages (MESITA-2083):
// Creation (Models · Create) and Enrichment (Enrich ·
// Functions). Search eligibility is Discovery › Map, not here.
//
// One GET, seeded server-side, for either page. A failed load blocks Save so
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

const TITLE: Record<CrenupView, string> = {
  creation: "Creation",
  enrichment: "Enrichment",
};

export async function CrenupPage({ view }: { view: CrenupView }) {
  const settings = await getAtlasSettings();

  return (
    <ConfigPageLayout eyebrow={`Operations · ${TITLE[view]}`} title={TITLE[view]}>
    <CrenupClient
      view={view}
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
      // Read-only, straight from `_shared/crenup-prompts.ts`. No fallback: a
      // prompt the console invented would be worse than one it cannot show.
      prompts={settings.ok ? (settings.data.crenupPromptsMeta ?? []) : []}
    />
    </ConfigPageLayout>
  );
}
