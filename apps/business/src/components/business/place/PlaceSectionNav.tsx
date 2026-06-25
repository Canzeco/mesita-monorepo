"use client";

import { cn } from "@/lib/utils";
import { PLACE_NAV_SECTIONS, type PlaceSectionId } from "./place-sections";

export function PlaceSectionNav({
  active,
  onNavigate,
  className,
}: {
  active: PlaceSectionId;
  onNavigate: (id: PlaceSectionId) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Place sections" className={cn("pb-2", className)}>
      <div className="bg-muted/45 scrollbar-hide flex gap-0.5 overflow-x-auto rounded-xl p-1">
        {PLACE_NAV_SECTIONS.map(({ id, label }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
