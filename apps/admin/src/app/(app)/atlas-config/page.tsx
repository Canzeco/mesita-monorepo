import { AlertTriangle } from "lucide-react";
import { getAtlasSettings } from "./actions";
import { AtlasClient } from "./AtlasClient";

// Atlas admin page.
// ADEA — Mesita's venue-profile research & enrichment engine (the "Atlas"
// operations area). Mirrors the reformatted ADEA Notion spec:
// Link → Contents → Analysis nodes, tiered T0–T5.

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
        ADEA
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
        Mesita&apos;s venue research &amp; enrichment engine. ADEA runs fresh
        whenever a venue is created or updated — Link resolves each source,
        Contents fetches from it, and Analysis perceives and reasons over
        everything to write the canonical profile. Each card below tunes one
        part of the pipeline.
      </p>
    </>
  );
}
