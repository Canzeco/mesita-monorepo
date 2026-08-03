"use client";

import { usePathname } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { parseUnitId } from "./nav";

export function ManageSingleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const unitId = parseUnitId(pathname);

  // Per-unit editor: full-bleed main column so UnitEditChrome spans
  // sidebar-edge → window-edge (no PageContainer max-w-6xl gutters).
  if (unitId) {
    return <div className="w-full">{children}</div>;
  }

  // Select hub owns its chrome — full-bleed like the per-unit editor so the
  // search bar spans sidebar-edge → window-edge (no max-w-6xl gutters).
  if (
    pathname === "/manage-single" ||
    pathname === "/manage-single/select" ||
    pathname.startsWith("/manage-single/create") ||
    pathname.startsWith("/manage-single/add")
  ) {
    return <div className="w-full pb-10 sm:pb-14">{children}</div>;
  }

  return (
    <PageContainer className="pb-10 sm:pb-14">
      <PageHeader
        eyebrow="Units · Single"
        title="Manage Single Unit"
        description="Search Mesita units or create from Google, then run Place, Reviews, Products, Promos, Performance, Team, and Settings — super-admin access bypasses place membership."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
