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
  DescriptionSection,
  DetailsSection,
  DiscoverySection,
  MenuSection,
  ModelsSection,
  PulseSection,
  ReviewsSection,
  SeedSection,
  SemanticNameSection,
  SemanticSummarySection,
  SerpSection,
  SocialImagesSections,
} from "./config-sections";
import { RunsSection } from "./RunsSection";
import { CostSection } from "./CostSection";
import { Collapsible, SectionCard } from "./atlas-ui";

// The Enrichment console — ONE page, no tab strip (Pato, 2026-08-21: "only one
// tab in that section"). It was three tabs: Config, Triggers, Calculator.
//
// ONE BOX PER FUNCTION, IN QUEUE ORDER (Pato, 2026-08-23). The queue is ten
// functions numbered 0-9 plus two semantic functions outside it, and all twelve
// get a card: 0 seed · 1 pulse · 2 details · 3 serp · 4 links · 5 social ·
// 6 images · 7 menu · 8 reviews · 9 description · ◇ name · ◇ summary.
//
// Only five own knobs. The other seven are cards anyway, because a page that
// shows only the tunable functions reads like the pipeline has five — an
// operator asking "where do I change the hours" needs to find 2 · Details and
// be told the answer is nowhere, not fail to find it and assume another page
// hides it. They were one collapsed "the rest of the pipeline" list until now,
// which made them look like footnotes to the tunable ones rather than equal
// members of the same queue.
//
// The order is the RUN's order, not the order the code grew in. Grouped by
// subsystem — Links, Reviews, Images — an operator tuning "why are the photos
// wrong" had to already know that Images runs after Social, which the page
// never said.
//
// Models sits after the functions rather than inside one because each of the
// four serves several: Text drives 9 and the image-rank leg of 6, Search drives
// Agent X at 3 and Agent Y at 4. Filing a shared model under one function would
// make the others look knob-less when they are not, so those cards point at it
// instead.
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

      {/* ══ THE QUEUE — one box per function, 0 → 9, then the semantic pair ══ */}
      <SeedSection />
      <PulseSection />
      <DetailsSection />
      <SerpSection />
      <DiscoverySection
        initialWebsiteN={props.initialDiscoverWebsiteN}
        initialInstagramN={props.initialDiscoverInstagramN}
        initialFacebookN={props.initialDiscoverFacebookN}
        initialOpentableN={props.initialDiscoverOpentableN}
        initialUbereatsN={props.initialDiscoverUbereatsN}
        onSaved={setUpdatedAt}
      />
      {/* 5 and 6 are two cards over ONE funnel state — the Instagram collect
          depth at 5 bounds the analyze cap at 6, so the chain is normalized as
          a whole and either card's Save persists all of it. */}
      <SocialImagesSections
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
      <MenuSection />
      <ReviewsSection
        initialGatherReviews={props.initialGatherReviews}
        onSaved={setUpdatedAt}
      />
      <DescriptionSection />
      <SemanticNameSection />
      <SemanticSummarySection />

      {/* ══ Shared across functions — see the header on why it is not inside one ══ */}
      <ModelsSection
        initialSynthesisQuality={props.initialSynthesisQuality}
        initialVisionQuality={props.initialVisionQuality}
        initialPerplexityPreset={props.initialPerplexityPreset}
        initialPerRunCostCapUsd={props.initialPerRunCostCapUsd}
        onSaved={setUpdatedAt}
      />

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
