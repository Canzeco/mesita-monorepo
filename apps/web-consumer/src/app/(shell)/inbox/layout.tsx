import type { ReactNode } from "react";
import { InboxSectionNav } from "@/components/consumer/inbox/InboxSectionNav";

export const dynamic = "force-dynamic";

// /inbox shared layout. Owns the one thing every section shares: the section
// pill nav. Because Next keeps a shared layout mounted across sibling
// navigations, switching sections never remounts the nav.
//
// Unlike /home there is no shared fetch here — the four sections read four
// different sources (tickets, orders, reservations, notifications), so each
// leaf owns its own data and its own auth gate.
export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <InboxSectionNav />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
