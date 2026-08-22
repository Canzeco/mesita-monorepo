import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Enrichment — a single flat page (no sub-tabs, Pato 2026-08-21). The Enricher
// is the cron pipeline that builds place profiles from the open web ("Atlas" is
// its legacy brand). Titled "Enrichment", not "Enricher Config": a label never
// repeats its section heading, and the eyebrow carries the section.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Enrichment"
      title="Enrichment"
      description="What starts a run, what each run is allowed to buy, and what it costs."
    >
      {children}
    </ConfigPageLayout>
  );
}
