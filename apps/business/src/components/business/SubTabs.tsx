"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Sticky, horizontally-scrollable segmented top menu used to split a page
// into subpages (e.g. Place → Details / Media / Hours). Lives at the top
// of a page's scroll body and pins under the Topbar while the content
// below scrolls. Mirrors the consumer app's in-app sub-navigation feel.
export type SubTabItem<T extends string = string> = {
  id: T;
  label: string;
  Icon?: LucideIcon;
};

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: readonly SubTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "scrollbar-hide bg-background/90 border-border sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b px-4 py-2 backdrop-blur-md",
        className,
      )}
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition",
              isActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
