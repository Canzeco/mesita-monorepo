"use client";

// Multiple Places — five boxes (MESITA-3942): Google Search and Mesita
// Search read; Mesita Create, Mesita Edit and Mesita Delete write over one
// shared Google Place ID box. Sticky rail so none scroll away. Spend
// estimates live on Configurations › Creation and Updation.

import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard, type Tint } from "@/components/admin-ui/manage";
import { SearchTab } from "./SearchTab";
import { MesitaSearchTab } from "./MesitaSearchTab";
import { WriteBox } from "./WriteBox";
import { parseGooglePlaceIds } from "./google-place-ids";
import { LEGACY_HASHES, PIPELINE_STEPS, WRITE_BOX_ACTIONS, type PipelineStepId } from "./pipeline";
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
  blurb?: string;
  tint: Tint;
  children: React.ReactNode;
}) {
  // scroll-mt clears the sticky PipelineNav — one ~53px row at every width.
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

type IdsSource = {
  source: string;
  filter: string | null;
  snapshot: string;
  replaced: number;
};

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const STEP = Object.fromEntries(PIPELINE_STEPS.map((s) => [s.id, s])) as Record<
  PipelineStepId,
  (typeof PIPELINE_STEPS)[number]
>;

export function MultiplePlacesClient() {
  const [sharedIds, setSharedIds] = useState("");
  const [idsSource, setIdsSource] = useState<IdsSource | null>(null);
  const focusDest = useRef<PipelineStepId | null>(null);
  const [sends, setSends] = useState(0);
  // One run at a time across every write box.
  const [running, setRunning] = useState(false);
  // Bumped when an Edit or Delete run ends, so Mesita Search can offer a
  // reload: the states it shows may have changed.
  const [editRuns, setEditRuns] = useState(0);

  const parsed = useMemo(() => parseGooglePlaceIds(sharedIds), [sharedIds]);

  // The single owner of the shared box: replaces it, remembers where the
  // IDs came from, and lands on the box that acts on them.
  function sendIds(ids: string[], source: string, dest: PipelineStepId, filter: string | null) {
    const before = parseGooglePlaceIds(sharedIds);
    const next = ids.join("\n");
    const replaced = before.length > 0 && before.join("\n") !== next ? before.length : 0;
    setSharedIds(next);
    setIdsSource({ source, filter, snapshot: next, replaced });
    focusDest.current = dest;
    setSends((n) => n + 1);
    jump(dest);
  }

  // Focus the destination's first button once the new IDs have enabled it.
  useEffect(() => {
    const dest = focusDest.current;
    if (!dest) return;
    focusDest.current = null;
    document
      .querySelector<HTMLButtonElement>(`#${dest} button:not([disabled])`)
      ?.focus({ preventScroll: true });
  }, [sends]);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const dest = LEGACY_HASHES[raw];
    if (dest) jump(dest);
  }, []);

  // The "N IDs from …" line shows only while the box still holds what was sent.
  const sourceLine =
    idsSource && parsed.join("\n") === idsSource.snapshot
      ? `${parsed.length} ID${parsed.length === 1 ? "" : "s"} from ${idsSource.source}` +
        (idsSource.filter ? ` · filter: ${idsSource.filter}` : "") +
        (idsSource.replaced > 0 ? ` · Replaced ${idsSource.replaced} IDs` : "")
      : null;

  const box = (id: "create" | "edit" | "delete") => (
    <WriteBox
      id={id}
      actions={WRITE_BOX_ACTIONS[id]}
      text={sharedIds}
      onTextChange={setSharedIds}
      sourceLine={sourceLine}
      locked={running}
      onRunStart={() => setRunning(true)}
      onRunEnd={(action) => {
        setRunning(false);
        if (action !== "create") setEditRuns((n) => n + 1);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PipelineNav />
      <Step
        n={STEP["google-search"].n}
        id="google-search"
        tint="sky"
        title={STEP["google-search"].label}
        blurb="One query per line, or Google Place IDs. Country optional."
      >
        <SearchTab onSendIds={(ids) => sendIds(ids, "Google Search", "create", null)} />
      </Step>

      <Step
        n={STEP["mesita-search"].n}
        id="mesita-search"
        tint="violet"
        title={STEP["mesita-search"].label}
        blurb="Every place on Mesita, 50 a page. Read-only."
      >
        <MesitaSearchTab
          editRuns={editRuns}
          onSendIds={(ids, filter) => sendIds(ids, "Mesita Search", "edit", filter)}
        />
      </Step>

      <Step
        n={STEP.create.n}
        id="create"
        tint="emerald"
        title={STEP.create.label}
        blurb="Mints each Google Place ID as a Mesita place. One already on Mesita is skipped."
      >
        {box("create")}
      </Step>

      <Step n={STEP.edit.n} id="edit" tint="amber" title={STEP.edit.label}>
        {box("edit")}
      </Step>

      <Step
        n={STEP.delete.n}
        id="delete"
        tint="rose"
        title={STEP.delete.label}
        blurb="Archives each place. No Undo in this console."
      >
        {box("delete")}
      </Step>
    </div>
  );
}
