import { getAtlasSettings } from "../actions";
import { AtlasSettingsError } from "@/components/AtlasSettingsError";
import { AtlasConfigurationClient } from "../AtlasClient";

export const dynamic = "force-dynamic";

export default async function EnricherConfigPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <AtlasConfigurationClient
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherInstagramDepth={result.data.atlasGatherInstagramDepth}
      initialGatherReviews={result.data.atlasGatherReviews}
      initialImageVisionEnabled={result.data.atlasImageVisionEnabled}
      initialSaveImagesToStorage={result.data.atlasSaveImagesToStorage}
      initialSaveTotalImages={result.data.atlasSaveTotalImages}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
      initialImageAnalysisPrompt={result.data.atlasImageAnalysisPrompt}
      initialImageSortingPrompt={result.data.atlasImageSortingPrompt}
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialPerplexityPreset={result.data.atlasPerplexityPreset ?? "pro-search"}
      initialPerRunCostCapUsd={result.data.atlasPerRunCostCapUsd ?? 1}
      initialDiscoverWebsiteN={result.data.atlasDiscoverWebsiteN}
      initialDiscoverInstagramN={result.data.atlasDiscoverInstagramN}
      initialDiscoverFacebookN={result.data.atlasDiscoverFacebookN}
      initialDiscoverOpentableN={result.data.atlasDiscoverOpentableN}
      initialDiscoverUbereatsN={result.data.atlasDiscoverUbereatsN}
      initialUpdatedAt={result.data.updatedAt}
    />
  );
}
