"use client";

import { useState } from "react";
import type { PerplexityPreset, SynthesisQuality } from "./actions";
import {
  DiscoverySection,
  ImageFunnelSection,
  ModelsSection,
  ReviewsSection,
} from "./config-sections";
import { CostSection } from "./CostSection";
import type { LinkCounts } from "./cost-model";

// Atlas / Enricher admin console. This file wires the two page entry points —
// the full configuration view and the standalone cost calculator — to their
// section modules:
//   • config-sections   — the three editable boxes: Models, Links, Images
//   • CostSection       — the standalone cost + runtime calculator (Enricher Calculator)
//   • atlas-ui          — the shared card / control / disclosure primitives

export function AtlasConfigurationClient(props: {
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialGatherReviews: number;
  initialSaveImagesToStorage: boolean;
  initialSaveTotalImages: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialPerplexityPreset: PerplexityPreset;
  initialDiscoverWebsiteN: number;
  initialDiscoverInstagramN: number;
  initialDiscoverFacebookN: number;
  initialDiscoverOpentableN: number;
  initialDiscoverUbereatsN: number;
  initialUpdatedAt: string | null;
}) {
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {updatedAt && (
        <p className="text-muted-foreground text-[11px]">
          Settings last changed{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      <ModelsSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialVisionQuality={props.initialVisionQuality}
        initialPerplexityPreset={props.initialPerplexityPreset}
        onSaved={setUpdatedAt}
      />
      <DiscoverySection
        initialWebsiteN={props.initialDiscoverWebsiteN}
        initialInstagramN={props.initialDiscoverInstagramN}
        initialFacebookN={props.initialDiscoverFacebookN}
        initialOpentableN={props.initialDiscoverOpentableN}
        initialUbereatsN={props.initialDiscoverUbereatsN}
        onSaved={setUpdatedAt}
      />
      <ReviewsSection
        initialGatherReviews={props.initialGatherReviews}
        onSaved={setUpdatedAt}
      />
      <ImageFunnelSection
        initialGatherGoogleImages={props.initialGatherGoogleImages}
        initialGatherInstagramDepth={props.initialGatherInstagramDepth}
        initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
        initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
        initialSaveTotalImages={props.initialSaveTotalImages}
        initialSaveImagesToStorage={props.initialSaveImagesToStorage}
        initialImageAnalysisPrompt={props.initialImageAnalysisPrompt}
        initialImageSortingPrompt={props.initialImageSortingPrompt}
        onSaved={setUpdatedAt}
      />
    </div>
  );
}

export function AtlasCalculatorClient(props: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialLinks: LinkCounts;
}) {
  return (
    <CostSection
      initialSynthesisQuality={props.initialSynthesisQuality}
      initialVisionQuality={props.initialVisionQuality}
      initialGatherGoogleImages={props.initialGatherGoogleImages}
      initialGatherInstagramDepth={props.initialGatherInstagramDepth}
      initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
      initialLinks={props.initialLinks}
    />
  );
}
