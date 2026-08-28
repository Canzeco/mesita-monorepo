import type { ReactNode } from "react";
import { HomeModeNav } from "@/components/consumer/home/HomeModeNav";

export const dynamic = "force-dynamic";

// /home shared layout. The hub is Soon (Pato, 2026-08-28): pills stay, the
// deck fetch does not run. Un-park restores the shared deck provider +
// Suspense around children (one fetch across sibling navigations).
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block (same class as
// inbox/layout.tsx, 2026-08-20). CatalogRails / FavoritesList / EmptyState
// all ask for `flex-1 overflow-y-auto`. A block parent makes that inert.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="from-background to-muted/30 flex h-full min-h-0 flex-col bg-gradient-to-b">
      <HomeModeNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
