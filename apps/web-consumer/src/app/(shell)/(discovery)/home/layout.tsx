import type { ReactNode } from "react";
import { ModeTabs } from "@/components/consumer/ModeTabs";

// Home's header (logo + location) is drawn HERE, not in the route-group
// layout above, so Search (its own bottom tab) never gets it over its map
// (MESITA-1616).
//
// No deck fetch in this layout. CatalogRails loads its own rows.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. EmptyState asks for
// `min-h-0 flex-1`, and a block parent makes that inert.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModeTabs />
      {children}
    </div>
  );
}
