import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models — the AI model behind each job (MESITA-2126 remake of MESITA-1788).
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Operations · Models"
      title="Models"
      description="The AI model behind each job Mesita runs. A change applies from the next run."
    >
      {children}
    </ConfigPageLayout>
  );
}
