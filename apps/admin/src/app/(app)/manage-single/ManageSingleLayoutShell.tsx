"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { isManageSingleHubRoute } from "./nav";

export function ManageSingleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hub (select) and per-unit editors own their chrome; skip the generic header.
  if (isManageSingleHubRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Units · Single"
        title="Manage Single Unit"
        description="Search Mesita units or create from Google, then run Place, Promos, Scan, Performance, and Team — super-admin access bypasses place membership."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
