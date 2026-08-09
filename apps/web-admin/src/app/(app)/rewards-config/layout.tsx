import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Rewards Config — a single flat page (no sub-tabs). The canonical v7
// Strategy × Class rewards matrix (MESITA-859): rows are Strategy × Class,
// columns are the standing discount plus every rewarded action.
export default function RewardsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Product · Rewards"
      title="Rewards Config"
      description="The Mesita rewards matrix (v7). Rows are Strategy × Class — Conservative and Aggressive over Standard, Premium, Influencer and Aura — and the columns price each cell: None (the standing discount) plus Mesita Review, Instagram Story, Welcome Visit and Google Review, each per class. Story is available to any class with a connected Instagram (MESITA-909); a guest is always paid their single best qualifying cell (best-of, never stacked). Rates run on a 5% grid, floor 5%, ceiling 70%; every discount applies only to the first N pesos of the bill, set by the universal cap below. This is the operator source of truth the bill engine reads."
    >
      {children}
    </ConfigPageLayout>
  );
}
