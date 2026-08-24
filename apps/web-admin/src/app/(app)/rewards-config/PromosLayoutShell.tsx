"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PROMOS_SUBROUTES } from "./nav";

// Promos Config shell — the header + the Config/Playground tab strip. Mirrors
// the Memo / Intaker config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/rewards-config/config":
    "Prices every promo a guest can earn. A bill pays the class base + the Welcome bonus + each earned action bonus, on the first cap-pesos.",
  "/rewards-config/distribution":
    "How those prices spread across 1,000 visits. Set the assumptions; the chart is the exact expected distribution, per strategy. Reads the saved Config — save your edits first.",
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
