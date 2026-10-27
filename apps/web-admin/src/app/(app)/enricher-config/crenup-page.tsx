import { ConfigPageLayout } from "@/components/ConfigPageLayout";
import { normalizeTier } from "@/lib/synthesis-quality";
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
  requestThreshold: 10,
  createOnOpenConsumer: true,
  createOnOpenAdmin: true,
  consumerCreatesPerDay: 1000,
};

const TITLE: Record<CrenupView, string> = {
  creation: "Creating",
  enrichment: "Enriching",
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
              gatherGoogleImages: settings.data.enrichGatherGoogleImages,
              gatherInstagramDepth: settings.data.enrichGatherInstagramDepth,
              gatherReviews: settings.data.enrichGatherReviews,
              imageVisionEnabled: settings.data.enrichImageVisionEnabled,
              saveImagesToStorage: settings.data.enrichSaveImagesToStorage,
              saveTotalImages: settings.data.enrichSaveTotalImages,
              analyzeGoogleImages: settings.data.enrichAnalyzeGoogleImages,
              analyzeInstagramImages:
                settings.data.enrichAnalyzeInstagramImages,
              imageAnalysisPrompt: settings.data.enrichImageAnalysisPrompt,
              imageSortingPrompt: settings.data.enrichImageSortingPrompt,
              synthesisQuality: normalizeTier(settings.data.enrichSynthesisQuality),
              visionQuality: normalizeTier(settings.data.enrichVisionQuality),
              perplexityPreset:
                settings.data.enrichPerplexityPreset ?? "pro-search",
              discoverWebsiteN: settings.data.enrichDiscoverWebsiteN,
              discoverInstagramN: settings.data.enrichDiscoverInstagramN,
              discoverFacebookN: settings.data.enrichDiscoverFacebookN,
              discoverOpentableN: settings.data.enrichDiscoverOpentableN,
              discoverUbereatsN: settings.data.enrichDiscoverUbereatsN,
              requestThreshold: settings.data.enrichRequestThreshold ?? 10,
              createOnOpenConsumer: settings.data.enrichCreateOnOpenConsumer !== false,
              createOnOpenAdmin: settings.data.enrichCreateOnOpenAdmin !== false,
              consumerCreatesPerDay: settings.data.enrichConsumerCreatesPerDay ?? 1000,
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
