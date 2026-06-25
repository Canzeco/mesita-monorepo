"use client";

import { PlaceSectionNav } from "./PlaceSectionNav";
import type { PlaceSectionId } from "./place-sections";

export function PlaceStickyHeader({
  active,
  onNavigate,
}: {
  active: PlaceSectionId;
  onNavigate: (id: PlaceSectionId) => void;
}) {
  return (
    <header className="bg-background sticky top-0 z-50 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--border)/0.4)]">
      <div className="px-4 py-2">
        <PlaceSectionNav active={active} onNavigate={onNavigate} />
      </div>
    </header>
  );
}
