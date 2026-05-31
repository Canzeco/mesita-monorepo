import { AlertTriangle } from "lucide-react";
import { getAtlasSettings } from "./actions";
import { AtlasClient } from "./AtlasClient";

// Atlas admin page.
// Mesita Atlas — Venue profile research and enrichment operations.

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
        initialSourceTierCeiling={result.data.atlasSourceTierCeiling}
        initialSourceOverrides={result.data.atlasSourceOverrides}
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
      <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
        Venue profile research &amp; enrichment. Atlas runs when a venue is
        created or updated, fetching fresh from every configured source.
      </p>
      <p className="text-muted-foreground/80 mt-3 max-w-3xl text-sm leading-relaxed">
        <span className="text-foreground font-medium">The pipeline, in order:</span>{" "}
        ① pick the sources to run (by tier) → ② pull their data (Google is the
        spine; reviews via Apify) → ③ pre-select &amp; save the best images per
        source → ④ vision-analyze and rank those images → ⑤ synthesize
        everything into the canonical profile. Each section below tunes one of
        those steps.
      </p>
    </>
  );
}
