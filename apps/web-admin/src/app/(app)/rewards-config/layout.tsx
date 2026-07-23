import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Rewards Config — a single flat page (no sub-tabs). The canonical Promos v5
// reward grid: for each posture (Zero / Conservative / Aggressive), what each of
// the six segments pays.
export default function RewardsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout
      eyebrow="Product · Rewards"
      title="Rewards Config"
      description="The Mesita reward grid (Promos v5). Six segments — Standard, Magnetic, Premium, Instagram Story, Welcome Visit, Google Review — climb a worst→best ladder; for each posture a place can pick, set what every segment pays. A guest is always paid their single best qualifying rung (best-of, never stacked). Rates run on a 5% grid, floor 10%, ceiling 50%; every discount applies to the first MX$500 of the bill. This is the operator source of truth the v5 bill engine reads."
    >
      {children}
    </ConfigPageLayout>
  );
}
