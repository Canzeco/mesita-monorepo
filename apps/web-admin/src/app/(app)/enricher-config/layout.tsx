import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Enrichment — a single flat page (no sub-tabs, Pato 2026-08-21), and since
// 2026-08-23 an empty one: see page.tsx for why the knobs are gone and what
// still reads their stored values. The Enricher is the cron pipeline that
// builds place profiles from the open web ("Atlas" is its legacy brand).
// Titled "Enrichment", not "Enricher Config": a label never repeats its
// section heading, and the eyebrow carries the section.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Enrichment"
      title="Enrichment"
      description="The Enricher is the cron pipeline that builds a place's profile out of the open web: one CREATE run at birth — seed, pulse, details — then a queue of nine functions, re-run per place on its own decay schedule. This page was its console: which events start a run, which subprocesses each run may buy, the caps and models it buys them with, and what one run costs. Those settings are live and every Edge Function still reads them; what is gone is the console for changing them, which had grown into a wall of knobs no operator could read straight through. The page stays empty until it is worth reading again. What each setting means lives in Notion Docs › Enrichment."
    >
      {children}
    </ConfigPageLayout>
  );
}
