"use client";

// Multiple Places — five boxes: Google Search and Mesita Search read;
// Create, Enrich and Update write (MESITA-2096). Sticky rail so none scroll
// away. Spend estimates live on Configurations › Creation and Enrichment.

import { useEffect, useState } from "react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { MesitaSearchTab } from "./MesitaSearchTab";
import { WriteBox } from "./WriteBox";
import { RefillBox } from "./RefillBox";
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

export function MultiplePlacesClient({ premierNow }: { premierNow?: React.ReactNode }) {
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
        blurb="The only way a place becomes Enriched. Starts one Render run for the list."
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
        tint="amber"
        title={PIPELINE_STEPS[4].label}
        blurb="Upgrade → Premier, Plan → Premier: a place ranks at the higher of the two. An Upgrade is Premier 2X or 5X for a number of days, given by Mesita, never a plan. 5X runs first, then 2X. A place paying for a higher plan is refused. End Mesita Upgrade ends only the Upgrade added here."
      >
        <RefillBox id={PIPELINE_STEPS[4].id} text={sharedIds} onTextChange={setSharedIds} />
        {premierNow}
      </Step>

      <Step
        n={PIPELINE_STEPS[5].n}
        id={PIPELINE_STEPS[5].id}
        tint="sky"
        title={PIPELINE_STEPS[5].label}
        blurb="Google facts. Never the photos or Mesita presentation. Also runs by itself every N views."
      >
        <WriteBox
          id={PIPELINE_STEPS[5].id}
          actions={WRITE_BOX_ACTIONS["google-update"]}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[6].n}
        id={PIPELINE_STEPS[6].id}
        tint="violet"
        title={PIPELINE_STEPS[6].label}
        blurb="Google stars, up to 100 Google reviews (Apify), Instagram and Facebook followers. Also runs by itself every N views, less often: each run is a paid scrape."
      >
        <WriteBox
          id={PIPELINE_STEPS[6].id}
          actions={WRITE_BOX_ACTIONS["reviews-update"]}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[7].n}
        id={PIPELINE_STEPS[7].id}
        tint="emerald"
        title={PIPELINE_STEPS[7].label}
        blurb="Guests can find each place again, everywhere."
      >
        <WriteBox
          id={PIPELINE_STEPS[7].id}
          actions={WRITE_BOX_ACTIONS.enable}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[8].n}
        id={PIPELINE_STEPS[8].id}
        tint="slate"
        title={PIPELINE_STEPS[8].label}
        blurb="Hides each place from every guest surface at once. Nothing is deleted; Enable brings it back."
      >
        <WriteBox
          id={PIPELINE_STEPS[8].id}
          actions={WRITE_BOX_ACTIONS.disable}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>

      <Step
        n={PIPELINE_STEPS[9].n}
        id={PIPELINE_STEPS[9].id}
        tint="rose"
        title={PIPELINE_STEPS[9].label}
        blurb="Archives each place. No Undo in this console."
      >
        <WriteBox
          id={PIPELINE_STEPS[9].id}
          actions={WRITE_BOX_ACTIONS.delete}
          text={sharedIds}
          onTextChange={setSharedIds}
        />
      </Step>
    </div>
  );
}
