import { PageContainer } from "@/components/PageContainer";
import { getScoringSample } from "./actions";
import { getScoringSettings } from "./settings-actions";
import { ScoringLayoutShell } from "./ScoringLayoutShell";
import { ScoringProvider } from "./ScoringProvider";

// Scoring Config — tabbed (Subscores · Cards · Decks · Memo). The layout
// fetches the DB sample ONCE and mounts the shared knob provider, so knobs set
// on Subscores drive the Cards + Decks tabs live and survive tab switches (the
// layout persists across child navigation). Resample = router.refresh() → this
// re-fetches; knob state is untouched because the provider isn't remounted.
export const dynamic = "force-dynamic";

export default async function ScoringConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [res, settings] = await Promise.all([getScoringSample(), getScoringSettings()]);
  const consumers = res.ok ? res.sample.consumers : [];
  const places = res.ok ? res.sample.places : [];
  const initialConfig = settings.ok ? settings.config : null;

  return (
    <PageContainer>
      <ScoringProvider
        consumers={consumers}
        places={places}
        initialConfig={initialConfig}
        sampleError={res.ok ? null : res.error}
        configError={settings.ok ? null : settings.error}
      >
        <ScoringLayoutShell>{children}</ScoringLayoutShell>
      </ScoringProvider>
    </PageContainer>
  );
}
