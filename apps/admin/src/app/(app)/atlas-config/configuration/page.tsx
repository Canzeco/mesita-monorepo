import { getAtlasSettings } from "../actions";
import { AtlasSettingsError } from "../AtlasSettingsError";
import { AtlasConfigurationClient } from "../AtlasClient";

export const dynamic = "force-dynamic";

export default async function AtlasParametersPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <AtlasConfigurationClient
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherInstagramDepth={result.data.atlasGatherInstagramDepth}
      initialSaveImagesToStorage={result.data.atlasSaveImagesToStorage}
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
