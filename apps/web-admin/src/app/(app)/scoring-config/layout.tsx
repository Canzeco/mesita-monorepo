import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Scoring Config — the GLOBAL side of scoring: the draft model and its knobs.
// The per-place scores live in Manage Single Unit → Scores.
export default function ScoringConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      title="Scoring Config"
      description="The model behind scoring — the potency every place carries into the recommendation engines (Swipe, the Map, Memo). Per-place scores live in Manage Single Unit → Scores."
    >
      {children}
    </ConfigPageLayout>
  );
}
