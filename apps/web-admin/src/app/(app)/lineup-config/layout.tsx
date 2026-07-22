import { PageContainer } from "@/components/PageContainer";
import { getScoringSample } from "./actions";
import { getScoringSettings } from "./settings-actions";
import { ScoringLayoutShell } from "./ScoringLayoutShell";
import { ScoringProvider } from "./ScoringProvider";

// Lineup Config — tabbed (Subscores · Scores & Lanes). The layout
// fetches the DB sample ONCE and mounts the shared knob provider, so knobs set
// on Subscores drive the Scores & Lanes tab live and survive tab switches (the
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
      <ScoringProvider consumers={consumers} places={places} initialConfig={initialConfig}>
        <ScoringLayoutShell>{children}</ScoringLayoutShell>
      </ScoringProvider>
    </PageContainer>
  );
}
