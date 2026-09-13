import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models — platform-wide model picks (MESITA-1788). Four live knobs on
// models_config; Intaker quality tiers stay on Intake.
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Models"
      title="Models"
      description="Which model each subsystem thinks with. Intaker quality tiers and the embedding model live on Intake."
    >
      {children}
    </ConfigPageLayout>
  );
}
