"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";

export function ManageSingleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isEditCatalog = pathname === "/manage-single/select";

  if (isEditCatalog) {
    return <>{children}</>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Units · Single"
        title="Manage Single Unit"
        description="Create a new single unit from Google or edit an existing one from the catalog, then run Place, Promos, Scan, Performance, and Team — super-admin access bypasses venue membership."
      />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
