import { getAtlasSettings } from "../../atlas-config/actions";
import { AtlasSettingsError } from "../../atlas-config/AtlasSettingsError";
import { AtlasConfigurationClient } from "../../atlas-config/AtlasClient";

export const dynamic = "force-dynamic";

export default async function AdeaConfigurationPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <AtlasConfigurationClient
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherInstagramDepth={result.data.atlasGatherInstagramDepth}
      initialGatherInstagramPosts={result.data.atlasGatherInstagramPosts}
      initialImageVisionEnabled={result.data.atlasImageVisionEnabled}
      initialSaveTotalImages={result.data.atlasSaveTotalImages}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
      initialImageAnalysisPrompt={result.data.atlasImageAnalysisPrompt}
      initialImageSortingPrompt={result.data.atlasImageSortingPrompt}
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialDiscoverWebsiteN={result.data.atlasDiscoverWebsiteN}
      initialDiscoverInstagramN={result.data.atlasDiscoverInstagramN}
      initialDiscoverFacebookN={result.data.atlasDiscoverFacebookN}
      initialDiscoverOpentableN={result.data.atlasDiscoverOpentableN}
      initialDiscoverUbereatsN={result.data.atlasDiscoverUbereatsN}
      initialUpdatedAt={result.data.updatedAt}
    />
  );
}
