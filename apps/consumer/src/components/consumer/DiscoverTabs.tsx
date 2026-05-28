"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Flame,
  LayoutGrid,
  Map as MapIcon,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Five Discover modes, ordered left-to-right as an ascending
// engagement curve — start with the lowest-effort browse, end with
// the highest-effort tool:
//
//   default home   known target   spatial    full browse   smart catch-all
//   Swipe       →  Search      →  Map     →  Catalog    →  Ask AI
//   flick          keyword         pin-map    grid          conversational
//
// Search and Ask AI live on separate tabs again (used to be merged).
// Keyword vs full-sentence is a real branch in user intent: the
// keyword lookup ("Mar Verde") should resolve instantly without
// going through a chat model, and a dummy user benefits from a clear
// "I just want to type the name" lane.
const TABS = [
  { href: "/discover/swipe", label: "Swipe", Icon: Flame },
  { href: "/discover/search", label: "Search", Icon: Search },
  { href: "/discover/map", label: "Map", Icon: MapIcon },
  { href: "/discover/catalog", label: "Catalog", Icon: LayoutGrid },
  { href: "/discover/ai", label: "Ask AI", Icon: Sparkles },
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
      {/*
        Five tabs share equal flex-1 width; the longest label ("AI
        Search") used to wrap to two lines inside the active pill at
        narrow viewports. Tightening padding (px-2 from px-2.5), gap
        (gap-1 from gap-1.5), font (11px from 12px), and icon size
        (h-3 from h-3.5) buys back ~12px per column — enough that "AI
        Search" fits inline. `whitespace-nowrap` is the belt-and-braces
        guarantee against future longer labels wrapping.
      */}
      <div className="border-border bg-card/70 flex items-center gap-0.5 rounded-full border p-1 backdrop-blur">
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
                "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium whitespace-nowrap transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
