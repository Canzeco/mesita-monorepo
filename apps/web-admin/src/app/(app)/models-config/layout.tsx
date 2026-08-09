import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models Config — a single flat page (no sub-tabs). A MAP of which AI model
// each subsystem uses and where each is actually controlled. The blob on
// app_settings.models_config is LIVE (MESITA-941) via loadModelsConfig. This
// page owns the editable supabase.model knob; Enricher quality/preset and Memo
// instructions stay on their own pages. See models-config/types.ts SUBSYSTEMS.
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Platform · Models"
      title="Models Config"
      description="A map of which AI model each part of Mesita uses — and where each is controlled. The models_config blob is read live by Enricher, Memo, Lineup embeddings, suggest-promo, and recommender-rank-map. This page owns the Supabase Edge Functions general default; Enricher and Memo keep their richer knobs on their own pages."
    >
      {children}
    </ConfigPageLayout>
  );
}
