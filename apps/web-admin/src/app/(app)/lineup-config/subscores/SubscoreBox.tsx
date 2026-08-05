"use client";

import { ChevronDown } from "lucide-react";
import { SUBSCORE_BY_ID, type SubscoreId } from "@/lib/business/scores";
import { useScoring, type SettingsSection } from "../ScoringProvider";
import { BoxSaveBar, BoxSection, CARD_ACCENTS, type CardTint } from "../panel-ui";

// The ONE shell every subscore box renders through (Pato 2026-07-21): the
// FIVE parts are required props, so a box literally cannot ship without
// Overview · Hyperparams · Inputs · Process · Outputs, in that order —
// Overview leads as the box's plain sentence, the other four stay labeled.
// The shell also owns the anchor id (the Scores tab's factor chips deep-link
// here), the per-subscore accent spine, and — when the box HAS a blob section
// — the per-box save bar. EM passes no `save`: everything in it is fixed
// (v10), so it renders no bar at all.

export function SubscoreBox({
  id,
  save,
  tint,
  title,
  pill,
  overview,
  hyperparams,
  inputs,
  process,
  outputs,
}: {
  id: SubscoreId;
  /** The blob section this box saves — omit for a box with nothing to save. */
  save?: Exclude<SettingsSection, "lanes">;
  tint: CardTint;
  title: string;
  pill?: string;
  overview: React.ReactNode;
  hyperparams: React.ReactNode;
  inputs: React.ReactNode;
  process: React.ReactNode;
  outputs: React.ReactNode;
}) {
  const {
    sectionDirty,
    savingSection,
    saveError,
    savedSection,
    saveSection,
    revertSection,
    resetSection,
    loadError,
  } = useScoring();

  // Collapsible (Pato 2026-07-26): a chevron toggle folds each box. Default
  // OPEN; the anchor id stays on the <details> so the Scores tab's factor
  // chips still deep-link here (and an anchored box scrolls into view even
  // when collapsed — the summary is always rendered).
  const emoji = SUBSCORE_BY_ID[id].emoji;
  return (
    <details
      id={id}
      open
      className={
        "group shadow-card scroll-mt-24 overflow-hidden rounded-2xl border border-border border-l-[3px] bg-card " +
        CARD_ACCENTS[tint]
      }
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <h2 className="font-display min-w-0 flex-1 text-base font-semibold tracking-tight">
          <span aria-hidden>{emoji}</span> {title}
        </h2>
        {pill ? (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold">
            {pill}
          </span>
        ) : null}
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Overview is the box's lead sentence, not a labeled section — the
            uppercase "Overview" micro-label was pure redundancy (Pato
            2026-07-26). The four remaining parts keep their labels. */}
        <div className="-mt-1">{overview}</div>
        <BoxSection label="Hyperparams">{hyperparams}</BoxSection>
        <BoxSection label="Inputs">{inputs}</BoxSection>
        <BoxSection label="Process">{process}</BoxSection>
        <BoxSection label="Outputs">{outputs}</BoxSection>
        {save ? (
          <BoxSaveBar
            dirty={sectionDirty[save]}
            saving={savingSection === save}
            savedOk={savedSection === save}
            error={savingSection === save || sectionDirty[save] ? saveError : null}
            loadError={loadError}
            onSave={() => saveSection(save)}
            onCancel={() => revertSection(save)}
            onReset={() => resetSection(save)}
          />
        ) : null}
      </div>
    </details>
  );
}

/** Overview / Outputs prose — one class, every box. */
export function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">{children}</p>;
}

/** Process explanation — a mono step stack; one class, every box. */
export function ProcessSteps({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1 font-mono text-[10.5px] leading-relaxed">
      {children}
    </div>
  );
}

/** The standard Hyperparams grid rhythm — cols is the only degree of freedom. */
export function KnobGrid({
  cols = 3,
  children,
}: {
  cols?: 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:max-w-2xl " +
        (cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")
      }
    >
      {children}
    </div>
  );
}
