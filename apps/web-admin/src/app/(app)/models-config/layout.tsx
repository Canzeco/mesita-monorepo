import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models Config — a single flat page (no sub-tabs). A MAP of which AI model
// each subsystem uses and where each is actually controlled: Enricher + Memo
// own their (richer, and for the Enricher live) model settings on their own
// pages; Lineup's embedding model is locked by design. The only knob this page
// owns is the Supabase Edge Functions general default — STAGED on
// app_settings.models_config (via admin-web-*-models-config), not yet read by
// any EF. See models-config/types.ts SUBSYSTEMS for the ownership map.
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Platform · Models"
      title="Models Config"
      description="A map of which AI model each part of Mesita uses — and where each is actually controlled. Enricher and Memo own their model settings on their own pages (linked below); Lineup's embedding model is locked by design. The only knob this page owns is the Supabase Edge Functions general default, which is staged (saved, not yet read at runtime)."
    >
      {children}
    </ConfigPageLayout>
  );
}
