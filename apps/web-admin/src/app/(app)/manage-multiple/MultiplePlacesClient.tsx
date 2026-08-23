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
// Stacked in order, the pipeline is the page, and the handoff becomes a button:
// step 1's results push straight into step 2's input. That is the one piece of
// state lifted here; everything else stays inside its own step.
//
// The button sends only places NOT already in Mesita. Sending the rest would
// queue creates for places that already exist — work the operator would then
// have to read past in the results.

import { useState } from "react";
import { ListFilter, ListPlus, Sparkles } from "lucide-react";
import { SearchTab } from "./SearchTab";
import { CreateTab } from "./CreateTab";
import { EnrichTab, type EnrichCostSeed } from "./EnrichTab";

function Step({
  n,
  title,
  blurb,
  icon,
  children,
}: {
  n: number;
  title: string;
  blurb: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-24">
      <div className="flex items-start gap-3">
        <span
          className="bg-secondary/10 text-secondary mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full type-label font-semibold tabular-nums"
          aria-hidden
        >
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {icon}
            {title}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            {blurb}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
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

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      <Step
        n={1}
        title="Search"
        blurb="One Google Places query per line. The deduped union of Place IDs comes back below."
        icon={<ListFilter className="text-muted-foreground h-4 w-4" />}
      >
        <SearchTab
          onSendToCreate={(ids) => {
            setCreateText(ids.join("\n"));
            document
              .getElementById("bulk-create")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </Step>

      <div id="bulk-create">
        <Step
          n={2}
          title="Create"
          blurb="Place IDs in, places out — the same pipeline as a single create, with progress per row."
          icon={<ListPlus className="text-muted-foreground h-4 w-4" />}
        >
          <CreateTab text={createText} onTextChange={setCreateText} />
        </Step>
      </div>

      <Step
        n={3}
        title="Enrich"
        blurb="Re-run the Enricher over many places. Pick a mode and see the spend before you queue."
        icon={<Sparkles className="text-muted-foreground h-4 w-4" />}
      >
        <EnrichTab costSeed={costSeed} />
      </Step>
    </div>
  );
}
