"use client";

// Manage Multiple Places — ONE page, three boxes: Search · Create · Enrich.
// That is the pipeline, in order. Search is a box of its own (Pato, 2026-08-25:
// keep it; do not fold Google search into Create or name a combined card).
//
// Two handoffs are buttons: Search → Create (new Google IDs) and Create →
// Enrich (minted Mesita IDs). Spend estimates live on Intake, not here.

import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { CreateTab } from "./CreateTab";
import { EnrichTab } from "./EnrichTab";
import { LEGACY_COMBO_HASH, PIPELINE_STEPS } from "./pipeline";
import { PipelineNav } from "./PipelineNav";

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

export function MultiplePlacesClient() {
  const [createText, setCreateText] = useState("");
  const [enrichText, setEnrichText] = useState("");
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw !== LEGACY_COMBO_HASH) return;
    jump("bulk-create");
  }, []);

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
        blurb="Place IDs in, places out — Create Seed · Pulse · Details · Semantic. Caps live on Intake."
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
        blurb="Enrich 1–10: Pulse through Description, then Semantic. Paste Mesita IDs. Same full Intaker run."
      >
        <EnrichTab text={enrichText} onTextChange={setEnrichText} />
      </Step>
    </div>
  );
}
