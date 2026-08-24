import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — a single flat page (no sub-tabs, Pato 2026-08-21) in five modules,
// same kit as Discovery. Models sits first (shared spend), then Sourcing ·
// Create · Enrich · Functions. Sourcing folded in on 2026-08-23 and
// /sourcing-config redirects here. A label never repeats its section heading.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Intake"
      title="Intake"
      description="How a place gets into Mesita and becomes a profile. Shared models first, then the sourcing gate, Create, Enrich, and every function with its knobs."
    >
      {children}
    </ConfigPageLayout>
  );
}
