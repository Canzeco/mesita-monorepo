import type { ReactNode } from "react";
import { ModeRail } from "@/components/consumer/ModeRail";

// Home's four pills — Places, Social, Chat, Favs — are Soon (MESITA-2168).
// The rail is drawn HERE, not in the route-group layout above, so Search
// (its own bottom tab, outside /discover) never gets a rail over its map.
//
// No deck fetch. A Suspense skeleton in front of a Soon page reads as a
// failed load. CatalogRails, Memo and Favs stay in the tree, unwired.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block. EmptyState asks for
// `min-h-0 flex-1`, and a block parent makes that inert.
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ModeRail />
      {children}
    </div>
  );
}
