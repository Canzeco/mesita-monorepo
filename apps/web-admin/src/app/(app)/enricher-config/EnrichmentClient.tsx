"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import type {
  EnrichmentTriggersConfig,
  EnrichmentTriggersMeta,
  PerplexityPreset,
  SynthesisQuality,
} from "./actions";
import {
  DiscoverySection,
  ImageFunnelSection,
  ModelsSection,
  QuietStepsSection,
  ReviewsSection,
} from "./config-sections";
import { RunsSection } from "./RunsSection";
import { CostSection } from "./CostSection";
import { Collapsible, SectionCard } from "./atlas-ui";

// The Enrichment console — ONE page, no tab strip (Pato, 2026-08-21: "only one
// tab in that section"). It was three tabs: Config, Triggers, Calculator.
//
// AFTER RUNS AND MODELS, THE PAGE IS THE QUEUE, IN QUEUE ORDER: 4 Links,
// 5–6 Social & Images, 8 Reviews, then a map of every function with no knob.
// The queue is ten functions numbered 0–9 plus two semantic functions outside
// it (MESITA-1230 → the ten-function respec); only four own knobs.
// It used to be grouped by subsystem — Links, Reviews, Images — which is the
// order the code grew in, not the order a run happens in. An operator tuning
// "why are the photos wrong" had to know that Images runs after Social, which
// the page never said. Numbering the boxes and sorting them by the queue means
// the page reads the way a run does.
//
// Models sits above the steps rather than inside one because each of the four
// serves several: Text drives function 9 and the image-rank leg, Search drives
// Agent X at 3 and Agent Y at 4. Filing a shared model under one step would
// make the other steps look knob-less when they are not.
//
// Order is deliberate. RUNS leads because it is the page's kill switch: a
// disabled on_create row hard-skips the first-run pipeline, a disabled
// on_schedule row makes the */15 cron queue nothing, and its columns are the
// only fleet-wide way to stop $$ Reviews / Links / Social / Images spend. The
// same reason the Reservations kill switch leads its page.
//
// The CALCULATOR is one box at the bottom, collapsed — it is by far the tallest
// thing here, and "one page" must not mean "one endless page". It has no Save
// (pure estimator), so it adds no save conflict; it is keyed on `updatedAt` so
// it re-seeds after any save above rather than quietly pricing stale numbers.
//
// Every box keeps its OWN save scope and its own dirty/ok/error. Collapsible is
// a native <details>, so children stay mounted — never swap it for
// `{open && <Section/>}`, which throws away an operator's unsaved edits on
// collapse with no warning.

export function EnrichmentClient(props: {
  initialGatherGoogleImages: number;
  initialGatherInstagramDepth: number;
  initialGatherReviews: number;
  initialImageVisionEnabled: boolean;
  initialSaveImagesToStorage: boolean;
  initialSaveTotalImages: number;
  initialAnalyzeGoogleImages: number;
  initialAnalyzeInstagramImages: number;
  initialImageAnalysisPrompt: string;
  initialImageSortingPrompt: string;
  initialSynthesisQuality: SynthesisQuality;
  initialVisionQuality: SynthesisQuality;
  initialPerplexityPreset: PerplexityPreset;
  initialPerRunCostCapUsd: number;
  initialDiscoverWebsiteN: number;
  initialDiscoverInstagramN: number;
  initialDiscoverFacebookN: number;
  initialDiscoverOpentableN: number;
  initialDiscoverUbereatsN: number;
  initialUpdatedAt: string | null;
  initialTriggers: EnrichmentTriggersConfig;
  triggersMeta: EnrichmentTriggersMeta;
}) {
  const [updatedAt, setUpdatedAt] = useState(props.initialUpdatedAt);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {updatedAt && (
        <p className="text-muted-foreground type-label">
          Settings last changed{" "}
          {new Date(updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

      <RunsSection
        initialConfig={props.initialTriggers}
        meta={props.triggersMeta}
      />
      <ModelsSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialVisionQuality={props.initialVisionQuality}
        initialPerplexityPreset={props.initialPerplexityPreset}
        initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
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
      <ImageFunnelSection
        initialGatherGoogleImages={props.initialGatherGoogleImages}
        initialGatherInstagramDepth={props.initialGatherInstagramDepth}
        initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
        initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
        initialSaveTotalImages={props.initialSaveTotalImages}
        initialImageVisionEnabled={props.initialImageVisionEnabled}
        initialSaveImagesToStorage={props.initialSaveImagesToStorage}
        initialImageAnalysisPrompt={props.initialImageAnalysisPrompt}
        initialImageSortingPrompt={props.initialImageSortingPrompt}
        onSaved={setUpdatedAt}
      />
      <ReviewsSection
        initialGatherReviews={props.initialGatherReviews}
        onSaved={setUpdatedAt}
      />
      <QuietStepsSection />

      {/* One box, bottom, closed. Pato: "leave it at the bottom of the
          configuration, but as one box, not as one fucking giant tab." */}
      <SectionCard
        icon={<Calculator className="h-4 w-4" />}
        title="Calculator"
        subtitle="What one run costs at the settings above."
      >
        <Collapsible summary="Price a run">
          <CostSection
            key={updatedAt ?? "seed"}
            initialSynthesisQuality={props.initialSynthesisQuality}
            initialVisionQuality={props.initialVisionQuality}
            initialGatherGoogleImages={props.initialGatherGoogleImages}
            initialGatherInstagramDepth={props.initialGatherInstagramDepth}
            initialAnalyzeGoogleImages={props.initialAnalyzeGoogleImages}
            initialAnalyzeInstagramImages={props.initialAnalyzeInstagramImages}
            initialLinks={{
              website: props.initialDiscoverWebsiteN,
              instagram: props.initialDiscoverInstagramN,
              facebook: props.initialDiscoverFacebookN,
              opentable: props.initialDiscoverOpentableN,
              ubereats: props.initialDiscoverUbereatsN,
            }}
          />
        </Collapsible>
      </SectionCard>
    </div>
  );
}
