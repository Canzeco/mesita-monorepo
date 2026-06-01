"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Four Discover modes, ordered left-to-right as an ascending engagement
// curve — lowest-effort browse → map → direct lookup → AI tool:
//
//   Swipe   →   Map      →   Search     →   Add
//   flick       pin-map      place-name      new venue
//
// Rendered in the top chrome row's center column (see DiscoverHeader),
// flanked by the logo and class chip; discovery filters open from a Filter
// button in the swipe action bar.
const TABS = [
  { href: "/explore/swipe", label: "Swipe", Icon: Flame },
  { href: "/explore/map", label: "Map", Icon: MapIcon },
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
    // Fills the header's center column (flex-1 + min-w-0 so it shrinks on
    // narrow phones); three tabs share equal flex-1 width and whitespace-nowrap
    // guards against label wrapping.
    <div className="border-border bg-card/70 flex min-w-0 flex-1 items-center gap-0.5 rounded-full border p-1 backdrop-blur">
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
              "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-medium whitespace-nowrap transition",
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
  );
}
