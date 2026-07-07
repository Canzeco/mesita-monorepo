"use client";

import { useState } from "react";
import type { SynthesisQuality } from "./actions";
import { PipelineStrip, StepsOverviewSection } from "./enricher-catalog";
import {
  GatherSection,
  ModelsSection,
  VisionParamsSection,
} from "./config-sections";
import { CostSection } from "./CostSection";

// Atlas / Enricher admin console. This file wires the two page entry points —
// the full configuration view and the standalone cost calculator — to their
// section modules:
//   • enricher-catalog  — read-only pipeline map (steps, nodes, method chips)
//   • config-sections   — the editable Gather / Photo Analysis / Models cards
//   • CostSection       — the cost + runtime estimate (inline card & calculator)
//   • atlas-ui          — the shared card / control / disclosure primitives

export function AtlasConfigurationClient(props: {
  initialGatherGoogleImages: number;
  initialGatherInstagramPosts: number;
  initialImageVisionEnabled: boolean;
  initialSaveTotalImages: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
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

      <PipelineStrip />

      <StepsOverviewSection />
      <GatherSection
        initialGatherGoogleImages={props.initialGatherGoogleImages}
        initialGatherInstagramPosts={props.initialGatherInstagramPosts}
        onSaved={setUpdatedAt}
      />
      <VisionParamsSection
        initialImageVisionEnabled={props.initialImageVisionEnabled}
        initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
        initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
        initialSaveTotalImages={props.initialSaveTotalImages}
        initialImageAnalysisPrompt={props.initialImageAnalysisPrompt}
        initialImageSortingPrompt={props.initialImageSortingPrompt}
        onSaved={setUpdatedAt}
      />
      <ModelsSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialVisionQuality={props.initialVisionQuality}
        onSaved={setUpdatedAt}
      />
    </div>
  );
}

export function AtlasCalculatorClient(props: {
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialImageVisionEnabled: boolean;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
}) {
  return (
    <CostSection
      standalone
      initialSynthesisQuality={props.initialSynthesisQuality}
      initialVisionQuality={props.initialVisionQuality}
      initialImageVisionEnabled={props.initialImageVisionEnabled}
      initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
      initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
    />
  );
}
