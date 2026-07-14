import { PageContainer } from "@/components/PageContainer";
import { getScoringSample } from "./actions";
import { ScoringLayoutShell } from "./ScoringLayoutShell";
import { ScoringProvider } from "./ScoringProvider";

// Scoring Config — tabbed (Params · Playground · Memo). The layout fetches the
// DB sample ONCE and mounts the shared knob provider, so hyperparameters set
// on Params drive the Playground live and survive tab switches (the layout
// persists across child navigation). Resample = router.refresh() → this
// re-fetches; knob state is untouched because the provider isn't remounted.
export const dynamic = "force-dynamic";

export default async function ScoringConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await getScoringSample();
  const consumers = res.ok ? res.sample.consumers : [];
  const places = res.ok ? res.sample.places : [];

  return (
    <PageContainer>
      <ScoringProvider consumers={consumers} places={places}>
        <ScoringLayoutShell>{children}</ScoringLayoutShell>
      </ScoringProvider>
    </PageContainer>
  );
}
