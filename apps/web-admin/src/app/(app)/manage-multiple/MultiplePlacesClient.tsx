"use client";

// Manage Multiple Places — ONE page, three boxes (Pato, 2026-08-25):
// Create · Enrich · Create + Enrich. Same pill chrome as before. Search is
// not a fourth box — it lives inside Create (and Create + Enrich) as how you
// get Google Place IDs without already having them.
//
// Spend math does not live here. Create and Enrich estimates are on Intake.

import { useEffect, useState } from "react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { CreateTab } from "./CreateTab";
import { EnrichTab } from "./EnrichTab";
import { LEGACY_SEARCH_HASH, PIPELINE_STEPS } from "./pipeline";
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

function FindThenPaste({
  queriesId,
  createText,
  onCreateText,
  mode,
  inputId,
}: {
  queriesId: string;
  createText: string;
  onCreateText: (next: string) => void;
  mode: "create" | "create-and-enrich";
  inputId: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <SearchTab
        queriesId={queriesId}
        onSendToCreate={(ids) => onCreateText(ids.join("\n"))}
      />
      <CreateTab
        text={createText}
        onTextChange={onCreateText}
        mode={mode}
        inputId={inputId}
      />
    </div>
  );
}

export function MultiplePlacesClient() {
  const [createText, setCreateText] = useState("");
  const [comboText, setComboText] = useState("");
  const [enrichText, setEnrichText] = useState("");

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw !== LEGACY_SEARCH_HASH) return;
    document.getElementById(PIPELINE_STEPS[0].id)?.scrollIntoView({
      block: "start",
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <PipelineNav />
      <Step
        n={PIPELINE_STEPS[0].n}
        id={PIPELINE_STEPS[0].id}
        tint="sky"
        title={PIPELINE_STEPS[0].label}
        blurb="Find Place IDs, or paste them. Mints Mesita places. Caps live on Intake."
      >
        <FindThenPaste
          queriesId="create-queries"
          createText={createText}
          onCreateText={setCreateText}
          mode="create"
          inputId="create-place-ids"
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[1].n}
        id={PIPELINE_STEPS[1].id}
        tint="violet"
        title={PIPELINE_STEPS[1].label}
        blurb="Paste Mesita place IDs. Enrich, or Re-enrich. Same full Intaker run."
      >
        <EnrichTab text={enrichText} onTextChange={setEnrichText} />
      </Step>

      <Step
        n={PIPELINE_STEPS[2].n}
        id={PIPELINE_STEPS[2].id}
        tint="amber"
        title={PIPELINE_STEPS[2].label}
        blurb="Mint, then queue a full Intaker run in this box. No hop."
      >
        <FindThenPaste
          queriesId="combo-queries"
          createText={comboText}
          onCreateText={setComboText}
          mode="create-and-enrich"
          inputId="create-enrich-place-ids"
        />
      </Step>
    </div>
  );
}
