"use client";

import type { SubscoreId } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { BoxSaveBar, BoxSection, PanelCard, type CardTint } from "../panel-ui";

// The ONE shell every subscore box renders through (Pato 2026-07-21): the
// FIVE parts are required props, so a box literally cannot ship without
// Overview · Hyperparams · Inputs · Process · Outputs, in that order. The
// shell also owns the anchor id (the Scores tab's factor chips deep-link
// here), the per-subscore tint, and the per-box save bar (wired to the
// provider by section id) — a *Box file supplies only its five contents.

export function SubscoreBox({
  id,
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
  } = useScoring();

  return (
    <section id={id} className="scroll-mt-24">
      <PanelCard tint={tint} title={title} pill={pill}>
        <BoxSection label="Overview">{overview}</BoxSection>
        <BoxSection label="Hyperparams">{hyperparams}</BoxSection>
        <BoxSection label="Inputs">{inputs}</BoxSection>
        <BoxSection label="Process">{process}</BoxSection>
        <BoxSection label="Outputs">{outputs}</BoxSection>
        <BoxSaveBar
          dirty={sectionDirty[id]}
          saving={savingSection === id}
          savedOk={savedSection === id}
          error={savingSection === id || sectionDirty[id] ? saveError : null}
          onSave={() => saveSection(id)}
          onCancel={() => revertSection(id)}
          onReset={() => resetSection(id)}
        />
      </PanelCard>
    </section>
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
