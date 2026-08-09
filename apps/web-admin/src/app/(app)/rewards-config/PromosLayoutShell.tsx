"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PROMOS_SUBROUTES } from "./nav";

// Promos Config shell — the header + the Config/Playground tab strip. Mirrors
// the Memo / Enricher config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/rewards-config/config":
    "Prices every promo a guest can earn. The v10 model is additive: a bill pays the class base + the Welcome bonus (first verified ticket) + each earned action bonus, on the first cap-pesos. The live engine still pays best-of (single highest cell) until the additive flip ships (MESITA-992) — every save keeps its rule table in sync.",
  "/rewards-config/playground":
    "Hypothetical distribution of rewards. Set the assumptions — visit mix, class mix, how often guests do each action — and see the exact expected spread of the total reward across 1,000 visits, per strategy, with quartiles. Uses the saved Config: save your edits first.",
};

export function PromosLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = PROMOS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/rewards-config/config"];

  return (
    <>
      <PageHeader
        eyebrow="Product · Promos"
        title="Promos Config"
        description={description}
      />
      <ConfigTabNav ariaLabel="Promos Config" subroutes={PROMOS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
