import { getAtlasSettings } from "../actions";
import { ErrorNote } from "@/components/ErrorNote";
import { AtlasCalculatorClient } from "../AtlasClient";

export default async function EnricherCalculatorPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <ErrorNote message={result.error} size="page" />;

  return (
    <AtlasCalculatorClient
      initialSynthesisQuality={result.data.atlasSynthesisQuality}
      initialVisionQuality={result.data.atlasVisionQuality ?? "economy"}
      initialGatherGoogleImages={result.data.atlasGatherGoogleImages}
      initialGatherInstagramDepth={result.data.atlasGatherInstagramDepth}
      initialAnalyzeGoogleImages={result.data.atlasAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={result.data.atlasAnalyzeInstagramImages}
      initialLinks={{
        website: result.data.atlasDiscoverWebsiteN,
        instagram: result.data.atlasDiscoverInstagramN,
        facebook: result.data.atlasDiscoverFacebookN,
        opentable: result.data.atlasDiscoverOpentableN,
        ubereats: result.data.atlasDiscoverUbereatsN,
      }}
    />
  );
}
