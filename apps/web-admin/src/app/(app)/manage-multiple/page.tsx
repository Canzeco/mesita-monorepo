import { getAtlasSettings } from "../enricher-config/actions";
import { MultiplePlacesClient } from "./MultiplePlacesClient";
import type { EnrichCostSeed } from "./EnrichTab";

// The whole tool, one page (Pato 2026-08-22). Was an index redirect to /search
// back when Search, Create and Enrich were three tabs — they are three steps of
// one pipeline, so they are three sections now.
//
// The Enricher's cost seed is read here so step 3 can price a run before it is
// queued; a failed read degrades to null and that step says it cannot price,
// rather than the page failing.
export const dynamic = "force-dynamic";

export default async function ManageMultiplePlacesPage() {
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

  return <MultiplePlacesClient costSeed={costSeed} />;
}
