"use client";

// Manage Multiple Places — ONE page (Pato, 2026-08-22: "all into one page. not
// three subpages").
//
// It was three tabs, and the tabs were hiding the shape of the thing. Search,
// Create and Enrich are not three tools an operator picks between — they are
// one PIPELINE, run in order:
//
//   queries → Place IDs → places → enrichment runs
//
// Each tab held its own local state and nothing was shared, so the handoff was
// manual: run a search, copy the IDs, switch tab, paste, create, switch tab,
// paste again. The tab strip made three steps of one job look like three jobs,
// and made the only thing connecting them — the IDs — the operator's problem.
//
// Stacked in order, the pipeline is the page. Two handoffs are buttons:
// Search → Create (new Google IDs) and Create → Enrich (minted Mesita IDs).
// The sticky rail keeps all three named while you work any step.
//
// The button sends only places NOT already in Mesita. Sending the rest would
// queue creates for places that already exist — work the operator would then
// have to read past in the results.

import { useState } from "react";
import { ListPlus } from "lucide-react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { CreateTab } from "./CreateTab";
import { EnrichTab, type EnrichCostSeed } from "./EnrichTab";
import { PIPELINE_STEPS } from "./pipeline";
import { PipelineNav } from "./PipelineNav";

// THE CARD, not a bare section (design pass 2026-08-22). This page was the
// only one in the console whose content floated directly on the page
// background: no border, no card, no icon chip, a plain `font-semibold`
// heading where every other page uses the Fraunces `SectionCard` title. Two
// adjacent entries in the same MANAGE rail group shared zero vocabulary, and
// that — not the spacing — is why the page read as unfinished next to Single
// Place.
//
// The step NUMBER takes the icon-chip slot rather than sitting beside it as a
// second circle. `SectionCard` already reserves a 36px tinted square there,
// so the number gets the affordance the system already has instead of
// introducing a competing one. Each step takes its own tint, per the palette's
// keep-siblings-different rule.
function Step({
  n,
  id,
  title,
  blurb,
  tint,
  children,
}: {
  n: number;
  id?: string;
  title: string;
  blurb: string;
  tint: Tint;
  children: React.ReactNode;
}) {
  // The id rides the wrapper, not SectionCard: `scroll-mt-24` only offsets the
  // element that scrollIntoView actually targets, and step 2's "send to
  // create" jump would otherwise land under the sticky page header.
  return (
    <div id={id} className="scroll-mt-36">
      <SectionCard
        tint={tint}
        title={title}
        subtitle={blurb}
        icon={
          <span className="text-sm font-semibold tabular-nums" aria-hidden>
            {n}
          </span>
        }
      >
        <div className="mt-5">{children}</div>
      </SectionCard>
    </div>
  );
}

export function MultiplePlacesClient({
  costSeed,
}: {
  costSeed: EnrichCostSeed | null;
}) {
  // The ONE lifted piece: step 1's output is step 2's input. Controlled rather
  // than seeded-through-an-effect, so there is no setState-in-effect to sync
  // and no remount that would discard step 2's per-row results.
  const [createText, setCreateText] = useState("");
  const [enrichText, setEnrichText] = useState("");
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PipelineNav />
      <Step
        n={PIPELINE_STEPS[0].n}
        id={PIPELINE_STEPS[0].id}
        tint="sky"
        title={PIPELINE_STEPS[0].label}
        blurb="One Google Places query per line. The deduped union of Place IDs comes back below."
      >
        <SearchTab
          onSendToCreate={(ids) => {
            setCreateText(ids.join("\n"));
            jump("bulk-create");
          }}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[1].n}
        id={PIPELINE_STEPS[1].id}
        tint="violet"
        title={PIPELINE_STEPS[1].label}
        blurb="Place IDs in, places out — the same pipeline as a single create, with progress per row."
      >
        <CreateTab
          text={createText}
          onTextChange={setCreateText}
          onCreated={(ids) => setCreatedProjectIds(ids)}
        />
        {createdProjectIds.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setEnrichText(createdProjectIds.join("\n"));
              jump("bulk-enrich");
            }}
            className="border-border bg-card hover:border-foreground mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium"
          >
            <ListPlus className="h-4 w-4" />
            Send {createdProjectIds.length} created{" "}
            {createdProjectIds.length === 1 ? "place" : "places"} to Enrich
          </button>
        ) : null}
      </Step>

      <Step
        n={PIPELINE_STEPS[2].n}
        id={PIPELINE_STEPS[2].id}
        tint="amber"
        title={PIPELINE_STEPS[2].label}
        blurb="Enrich, or Re-enrich. Same full Intaker run. See the spend before you queue."
      >
        <EnrichTab
          costSeed={costSeed}
          text={enrichText}
          onTextChange={setEnrichText}
        />
      </Step>
    </div>
  );
}
