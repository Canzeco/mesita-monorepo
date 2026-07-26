import { getAtlasSettings } from "../actions";
import { AtlasSettingsError } from "@/components/AtlasSettingsError";
import { AtlasCalculatorClient } from "../AtlasClient";

// Enricher Config · Playground — price and time one enrichment run at the current
// settings. (Renamed from "Calculator"; the run-cost estimator is this section's
// interactive playground.)
export const dynamic = "force-dynamic";

export default async function EnricherPlaygroundPage() {
  const result = await getAtlasSettings();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

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
