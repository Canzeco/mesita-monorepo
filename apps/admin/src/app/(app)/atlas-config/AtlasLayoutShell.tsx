"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ATLAS_ROUTES } from "./nav";

const PAGE_COPY: Record<string, { title: string; description: string }> = {
  "/atlas-config/configuration": {
    title: "ADEA Config",
    description:
      "Tier gates, gather limits, vision, and synthesis quality for the ADEA enrichment pipeline.",
  },
  "/atlas-config/calculator": {
    title: "ADEA Calculator",
    description:
      "Rough cost and runtime estimate to enrich one new venue with your current settings.",
  },
  "/atlas-config/fields": {
    title: "Atlas fields",
    description:
      "Controlled vocabulary and field limits used when ADEA and operators write venue profiles.",
  },
};

export function AtlasLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = ATLAS_ROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const copy = match ? PAGE_COPY[match.href] : PAGE_COPY["/atlas-config/configuration"];

  return (
    <>
      <PageHeader
        eyebrow="Atlas"
        title={copy.title}
        description={copy.description}
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
