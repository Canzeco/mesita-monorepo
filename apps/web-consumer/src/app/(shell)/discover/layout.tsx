import type { ReactNode } from "react";
import { DiscoverModeNav } from "@/components/consumer/discover/DiscoverModeNav";

export const dynamic = "force-dynamic";

// Discover's shared frame: the mode rail, then the active mode.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block — same rule the retired
// /home layout carried, and for the same reason: the map fills its frame with
// `min-h-0 flex-1`, and a block parent makes that inert, collapsing the map to
// zero height.
//
// The rail costs the map ~41px of frame. That is the real price of a topbar
// menu over a full-bleed surface and it was taken deliberately: the map's own
// overlay sits at `absolute inset-x-3 top-3 z-30` INSIDE the map container, so
// stacking below the rail is a shorter map, not a z-order fight.
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DiscoverModeNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
