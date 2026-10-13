"use client";

// Multiple Places — five boxes: Google Search and Mesita Search read;
// Create, Enrich and Update write (MESITA-2096). Sticky rail so none scroll
// away. Spend estimates live on Configurations › Creation and Enrichment.

import { useEffect, useState } from "react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { MesitaSearchTab } from "./MesitaSearchTab";
import { WriteBox } from "./WriteBox";
import { LEGACY_HASHES, PIPELINE_STEPS, WRITE_BOX_ACTIONS } from "./pipeline";
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
  // scroll-mt clears the sticky PipelineNav — one ~53px row at every width
  // now. The old 9rem was a two-row nav PLUS the mobile topbar, which the nav
  // no longer offsets itself against.
  return (
    <div id={id} className="scroll-mt-20">
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
  const [sharedIds, setSharedIds] = useState("");

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const dest = LEGACY_HASHES[raw];
    if (!dest) return;
    jump(dest);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <PipelineNav />
      <Step
        n={PIPELINE_STEPS[0].n}
        id={PIPELINE_STEPS[0].id}
        tint="sky"
        title={PIPELINE_STEPS[0].label}
        blurb="One query per line, or Google Place IDs. Country optional."
      >
        <SearchTab
          onSendIds={(ids) => {
            setSharedIds(ids.join("\n"));
            jump("mesita-search");
          }}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[1].n}
        id={PIPELINE_STEPS[1].id}
        tint="violet"
        title={PIPELINE_STEPS[1].label}
        blurb="Google Place IDs in — or All places, which fills the box. Mesita states out. Read-only."
      >
        <MesitaSearchTab text={sharedIds} onTextChange={setSharedIds} />
      </Step>

      <Step
        n={PIPELINE_STEPS[2].n}
        id={PIPELINE_STEPS[2].id}
        tint="emerald"
        title={PIPELINE_STEPS[2].label}
        blurb="Mints each Google Place ID as a Mesita place, every ID at once. One already on Mesita is skipped."
      >
        <WriteBox
          id={PIPELINE_STEPS[2].id}
          actions={WRITE_BOX_ACTIONS.create}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[3].n}
        id={PIPELINE_STEPS[3].id}
        tint="amber"
        title={PIPELINE_STEPS[3].label}
        blurb="Fills each place from zero, Details through Embedding. Queued — the cron works one place at a time."
      >
        <WriteBox
          id={PIPELINE_STEPS[3].id}
          actions={WRITE_BOX_ACTIONS.enrich}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[4].n}
        id={PIPELINE_STEPS[4].id}
        tint="rose"
        title={PIPELINE_STEPS[4].label}
        blurb="Writes to places already on Mesita. Enable and Disable toggle guest visibility; Delete archives, no Undo here."
      >
        <WriteBox
          id={PIPELINE_STEPS[4].id}
          actions={WRITE_BOX_ACTIONS.update}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>
    </div>
  );
}
