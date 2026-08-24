import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — a single flat page (no sub-tabs, Pato 2026-08-21) carrying the whole
// story in five sections: the sourcing gate, Create explained, Enrich
// explained, the twelve functions with their params, and the shared models.
// Sourcing folded in on 2026-08-23 and /sourcing-config redirects here. A label
// never repeats its section heading, and the eyebrow carries the section.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Intake"
      title="Intake"
      description="How a place gets into Mesita and becomes a profile. First the gate: which surfaces may show a place in a searchbar, which may onboard one, and the Google bar each has to clear. Then the Intaker — one Create run at the door, seed, pulse and details, then nine enrich functions re-run on each place's own decay schedule. Every function is listed below with what it does and what you can change about it."
    >
      {children}
    </ConfigPageLayout>
  );
}
