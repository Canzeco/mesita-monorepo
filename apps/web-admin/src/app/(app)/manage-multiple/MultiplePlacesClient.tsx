"use client";

// Manage Multiple Places — three boxes. Create, Enrich, Update, and
// Create + Enrich live in one Mesita Intake box. Sticky rail so none
// scroll away. Spend estimates live on Intake Config.

import { useEffect, useState } from "react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { MesitaSearchTab } from "./MesitaSearchTab";
import { IntakeTab } from "./IntakeTab";
import { LEGACY_HASHES, PIPELINE_STEPS } from "./pipeline";
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
        tint="amber"
        title={PIPELINE_STEPS[2].label}
        blurb="Create · Enrich · Update · Create + Enrich. Same IDs."
      >
        <IntakeTab text={sharedIds} onTextChange={setSharedIds} />
      </Step>
    </div>
  );
}
