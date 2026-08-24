import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — a single flat page (no sub-tabs, Pato 2026-08-21) in five modules,
// same kit as Discovery: Sourcing · Create · Enrich · Functions · Models.
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
      description="How a place gets into Mesita and becomes a profile. Five modules: the sourcing gate, Create, Enrich, every function with its knobs, then the shared models."
    >
      {children}
    </ConfigPageLayout>
  );
}
