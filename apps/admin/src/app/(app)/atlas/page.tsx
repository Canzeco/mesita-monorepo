import { AlertTriangle } from "lucide-react";
import { getAtlasSettings } from "./actions";
import { AtlasClient } from "./AtlasClient";

// Atlas admin page.
// Mesita Atlas — Venue profile research and enrichment operations.
//
// Single toggle (pre-read snapshots) plus a "snapshot all venues" button.
// The toggle controls whether Atlas EFs read prior research snapshots
// before fetching anything new during a venue create/update. Snapshots
// are written EITHER WAY — the toggle only gates pre-read behavior.

export const dynamic = "force-dynamic";

export default async function AtlasPage() {
  const result = await getAtlasSettings();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-6xl px-8 pt-12 pb-14">
        <Header />
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-8 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{result.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-8 pt-12 pb-14">
      <Header />
      <AtlasClient
        initialPreReadEnabled={result.data.atlasPreReadSnapshots}
        initialSaveSnapshots={result.data.atlasSaveSnapshots}
        initialSnapshotOnBusinessEdit={result.data.atlasSnapshotOnBusinessEdit}
        initialGoogleImages={result.data.atlasResearchGoogleImages}
        initialInstagramPosts={result.data.atlasResearchInstagramPosts}
        initialFacebookPosts={result.data.atlasResearchFacebookPosts}
        initialSourceTierCeiling={result.data.atlasSourceTierCeiling}
        initialSourceOverrides={result.data.atlasSourceOverrides}
        initialSerpOnlyWhenThin={result.data.atlasSerpOnlyWhenThin}
        initialGoogleReviews={result.data.atlasGoogleReviews}
        initialWebsiteCrawlMaxPages={result.data.atlasWebsiteCrawlMaxPages}
        initialReviewsPerSite={result.data.atlasReviewsPerSite}
        initialImageVisionEnabled={result.data.atlasImageVisionEnabled}
        initialMaxImagesAnalyzed={result.data.atlasMaxImagesAnalyzed}
        initialPerSourceAiSummary={result.data.atlasPerSourceAiSummary}
        initialSynthesisQuality={result.data.atlasSynthesisQuality}
        initialPerRunCostCapUsd={result.data.atlasPerRunCostCapUsd}
        initialUpdatedAt={result.data.updatedAt}
      />
    </div>
  );
}

function Header() {
  return (
    <>
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Operations · Atlas
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Mesita Atlas
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
        Venue profile research and enrichment operations. Atlas runs only
        when Core asks for a venue profile (on create / update). Before
        any external API call, it reads prior snapshots in Storage and
        only fetches what&apos;s missing. Every run is saved permanently
        so future updates get progressively cheaper.
      </p>
    </>
  );
}
