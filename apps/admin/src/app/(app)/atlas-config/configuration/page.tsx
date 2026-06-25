import { getAtlasSettings } from "../actions";
import { AtlasSettingsError } from "../AtlasSettingsError";
import { AtlasConfigurationClient } from "../AtlasClient";

export const dynamic = "force-dynamic";

export default async function AdeaConfigurationPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <AtlasConfigurationClient
      initialSourceTierCeiling={result.data.atlasSourceTierCeiling}
      initialWebsiteCrawlMaxPages={result.data.atlasWebsiteCrawlMaxPages}
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherWebsiteImages={result.data.atlasGatherWebsiteImages}
      initialGatherInstagramPosts={result.data.atlasGatherInstagramPosts}
      initialImageVisionEnabled={result.data.atlasImageVisionEnabled}
      initialSaveTotalImages={result.data.atlasSaveTotalImages}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeWebsiteImages={result.data.atlasAnalyzeWebsiteImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
      initialImageAnalysisPrompt={result.data.atlasImageAnalysisPrompt}
      initialImageSortingPrompt={result.data.atlasImageSortingPrompt}
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialUpdatedAt={result.data.updatedAt}
    />
  );
}
