import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — a single flat page (no sub-tabs, Pato 2026-08-21), and since
// 2026-08-23 an empty one: see page.tsx for why the knobs are gone and what
// still reads their stored values. Named Intake on 2026-08-23 because sourcing
// and enrichment are one story — find the place, then take its history — and
// MESITA-1287 folds the Sourcing page in here. The ENGINE keeps its own name:
// the Intaker is the cron pipeline that builds place profiles from the open
// web ("Atlas" is its legacy brand). A label never repeats its section
// heading, and the eyebrow carries the section.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Intake"
      title="Intake"
      description="Intake is how a place gets into Mesita and becomes a profile. The Intaker, its engine, is the cron pipeline that builds that profile out of the open web: one CREATE run at birth — seed, pulse, details — then a queue of nine functions, re-run per place on its own decay schedule. This page was its console: which events start a run, which subprocesses each run may buy, the caps and models it buys them with, and what one run costs. Those settings are live and every Edge Function still reads them; what is gone is the console for changing them, which had grown into a wall of knobs no operator could read straight through. The page stays empty until it is worth reading again. What each setting means lives in Notion Docs › Intake."
    >
      {children}
    </ConfigPageLayout>
  );
}
