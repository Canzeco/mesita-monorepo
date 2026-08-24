import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — a single flat page (no sub-tabs, Pato 2026-08-21) carrying the
// whole story: sourcing's channel gate, then the Intaker's functions. Sourcing
// folded in on 2026-08-23 and /sourcing-config redirects here; the Intaker's
// own knobs are still the Soon panel (see page.tsx for what keeps reading
// their stored values). A label never repeats its section heading, and the
// eyebrow carries the section.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Intake"
      title="Intake"
      description="How a place gets into Mesita and becomes a profile. First the gate: which surfaces may show a place in a searchbar, which may onboard one, and the Google quality bar each has to clear. Then the Intaker, the cron pipeline that builds the profile out of the open web — one CREATE run at the door, seed, pulse and details, then nine enrich functions re-run on each place's own decay schedule. The gate is editable here; the Intaker's caps, models and triggers are stored settings every Edge Function still reads, and their console comes back when it is worth reading. What each setting means lives in Notion Docs › Intake."
    >
      {children}
    </ConfigPageLayout>
  );
}
