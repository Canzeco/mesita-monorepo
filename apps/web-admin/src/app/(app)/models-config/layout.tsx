import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Models Config — a single flat page (no sub-tabs). The one place to pick which
// AI model each subsystem uses: the Supabase Edge Functions general default,
// the Enricher, Lineup, and Memo. STAGED — selections persist on
// app_settings.models_config (via admin-web-*-models-config) but the subsystems
// still run their in-code / per-page model settings until each is pointed at
// this blob in a follow-up. Deliberately overlaps the Memo Config model knob.
export default function ModelsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Platform · Models"
      title="Models Config"
      description="Pick which AI model each subsystem uses, in one place. The main model is always OpenAI; Perplexity is an optional web-grounding leg for Enricher and Memo only — never a main model. Selections are saved now but not yet read at runtime (staged): the Supabase EFs, Enricher, Lineup, and Memo still run their existing model settings until each is wired to this blob. Overlaps the model knob on Memo Config."
    >
      {children}
    </ConfigPageLayout>
  );
}
