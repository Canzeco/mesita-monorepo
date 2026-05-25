"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, LayoutGrid, Map as MapIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/discover/swipe", label: "Swipe", Icon: Flame },
  { href: "/discover/catalog", label: "Catalog", Icon: LayoutGrid },
  { href: "/discover/map", label: "Map", Icon: MapIcon },
  { href: "/discover/ai", label: "AI", Icon: Sparkles },
];

export function DiscoverTabs() {
  const pathname = usePathname();
  // Optimistic active href — flips the moment the user clicks, before the
  // pathname change lands. Reset on every real pathname change using the
  // "previous-value" pattern (React docs) so we don't need a useEffect,
  // and so browser back/forward correctly clears stale optimism.
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOptimisticHref(null);
  }

  const activeHref = optimisticHref ?? pathname;

  return (
    <div className="px-3 pt-2 pb-1">
      <div className="border-border bg-card/70 flex items-center gap-1 rounded-full border p-1 backdrop-blur">
        {TABS.map(({ href, label, Icon }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => {
                if (href !== pathname) setOptimisticHref(href);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
