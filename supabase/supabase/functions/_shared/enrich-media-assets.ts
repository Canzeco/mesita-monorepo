// Media-asset helpers for the Intaker contents stage.
// Extracted from enrich-pipeline.ts (pure transforms, no I/O).

import type { MediaAssetPayload } from "./enrich-config.ts";
import type { AnalysisPayload, GatheredPayload } from "./enrich-pipeline.ts";

// Serialise a Map to a jsonb-safe plain object.
export function mapToObject<V>(m: Map<string, V> | null | undefined): Record<string, V> {
  const out: Record<string, V> = {};
  if (m) for (const [k, v] of m.entries()) out[k] = v;
  return out;
}

// Build the media-asset payload rows for _shared/store-place-images from the
// analysis output + research metadata.
export function buildMediaAssets(
  gathered: GatheredPayload,
  analysis: AnalysisPayload,
): MediaAssetPayload[] {
  return analysis.saved.map((img) => {
    const im = gathered.instagramAssetMeta[img.url];
    return {
      source: img.source,
      source_url: img.url,
      likes_count: im?.likes_count ?? null,
      caption: im?.caption ?? null,
      analysis: analysis.imageAnalysisByUrl[img.url] ?? null,
      source_metadata: im?.source_metadata ?? null,
    };
  });
}
