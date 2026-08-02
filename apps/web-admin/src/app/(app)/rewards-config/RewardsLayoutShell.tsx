"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { REWARDS_SUBROUTES } from "./nav";

// Rewards Config shell — header + the Config/Playground tab strip. Mirrors the
// Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/rewards-config/config":
    "The Mesita reward grid (Promos v5). Six segments — Standard Customer, Premium Customer, Magnetic Customer, Instagram Story Bonus, Welcome Visit Bonus, Google Review Bonus — climb a worst→best ladder; for each posture a place can pick, set what every segment pays. A guest is always paid their single best qualifying rung (best-of, never stacked). Rates run on a 5% grid, floor 10%, ceiling 50%; every discount applies only to the opening portion of the bill, up to a single platform-wide cap (set below).",
  "/rewards-config/playground":
    "Model one guest's bill: pick the place's posture and the rungs the guest qualifies for, and see the best-of discount they'd receive at the current grid.",
};

export function RewardsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = REWARDS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/rewards-config/config"];

  return (
    <>
      <PageHeader
        eyebrow="Product · Rewards"
        title="Rewards Config"
        description={description}
      />
      <ConfigTabNav ariaLabel="Rewards Config" subroutes={REWARDS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
