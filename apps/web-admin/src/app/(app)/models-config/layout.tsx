import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models — platform-wide model picks (MESITA-1788). models_config blob plus
// Enricher atlas_* quality tiers (MESITA-1811).
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Models"
      title="Models"
      description="Which model each subsystem thinks with — platform picks, Enricher quality tiers, and the locked embedding model."
    >
      {children}
    </ConfigPageLayout>
  );
}
