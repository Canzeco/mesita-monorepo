import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models Config — a single flat page (no sub-tabs). SoT for
// app_settings.models_config (MESITA-941 loadModelsConfig): supabase + memo
// picks are edited here and read live by EFs; Enricher quality / Perplexity
// Agent preset and the embedding model are controlled on Enricher Config.
// models_config.enricher.perplexity remains staged (unread —
// atlas_perplexity_preset wins). See types.ts SUBSYSTEMS.
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Platform · Models"
      title="Models Config"
      description="Source of truth for models_config. Supabase and Memo model picks here are read live by Edge Functions. Enricher quality tiers and Perplexity Agent preset live on Enricher Config; the embedding model is locked. Only models_config.enricher.perplexity is staged (unread)."
    >
      {children}
    </ConfigPageLayout>
  );
}
