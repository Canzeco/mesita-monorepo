import { getAtlasSettings } from "../../atlas-config/actions";
import { AtlasSettingsError } from "../../atlas-config/AtlasSettingsError";
import { AtlasCalculatorClient } from "../../atlas-config/AtlasClient";

export const dynamic = "force-dynamic";

export default async function AdeaCalculatorPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return (
    <AtlasCalculatorClient
      initialSourceTierCeiling={result.data.atlasSourceTierCeiling}
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialImageVisionEnabled={result.data.atlasImageVisionEnabled}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeWebsiteImages={result.data.atlasAnalyzeWebsiteImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
    />
  );
}
