import { getAtlasSettings } from "../actions";
import { ErrorNote } from "@/components/ErrorNote";
import { AtlasConfigurationClient } from "../AtlasClient";

export default async function EnricherConfigPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <ErrorNote message={result.error} size="page" />;

  return (
    <AtlasConfigurationClient
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherInstagramDepth={result.data.atlasGatherInstagramDepth}
      initialGatherReviews={result.data.atlasGatherReviews}
      initialSaveImagesToStorage={result.data.atlasSaveImagesToStorage}
      initialSaveTotalImages={result.data.atlasSaveTotalImages}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
      initialImageAnalysisPrompt={result.data.atlasImageAnalysisPrompt}
      initialImageSortingPrompt={result.data.atlasImageSortingPrompt}
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialPerplexityPreset={result.data.atlasPerplexityPreset ?? "pro-search"}
      initialDiscoverWebsiteN={result.data.atlasDiscoverWebsiteN}
      initialDiscoverInstagramN={result.data.atlasDiscoverInstagramN}
      initialDiscoverFacebookN={result.data.atlasDiscoverFacebookN}
      initialDiscoverOpentableN={result.data.atlasDiscoverOpentableN}
      initialDiscoverUbereatsN={result.data.atlasDiscoverUbereatsN}
      initialUpdatedAt={result.data.updatedAt}
    />
  );
}
