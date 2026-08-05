import { getAtlasSettings } from "../../enricher-config/actions";
import { EnrichTab, type EnrichCostSeed } from "../EnrichTab";

export const dynamic = "force-dynamic";

export default async function ManageMultipleEnrichPage() {
  const settings = await getAtlasSettings();
  const costSeed: EnrichCostSeed | null = settings.ok
    ? {
        quality: settings.data.atlasSynthesisQuality,
        imageModel: settings.data.atlasVisionQuality ?? "economy",
        gCollect: settings.data.atlasGatherGoogleImages,
        igCollect: settings.data.atlasGatherInstagramDepth,
        gAnalyze: Math.min(
          settings.data.atlasAnalyzeGoogleImages,
          settings.data.atlasGatherGoogleImages,
        ),
        igAnalyze: Math.min(
          settings.data.atlasAnalyzeInstagramImages,
          settings.data.atlasGatherInstagramDepth,
        ),
        links: {
          website: settings.data.atlasDiscoverWebsiteN,
          instagram: settings.data.atlasDiscoverInstagramN,
          facebook: settings.data.atlasDiscoverFacebookN,
          opentable: settings.data.atlasDiscoverOpentableN,
          ubereats: settings.data.atlasDiscoverUbereatsN,
        },
      }
    : null;

  return <EnrichTab costSeed={costSeed} />;
}
