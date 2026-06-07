"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  Gift,
  Users,
  ScanLine,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Six operating surfaces for a venue, mirrored from the consumer app's
// BottomNav. The active unit lives in the URL (/unit/<id>/<slug>), so the
// shell passes the id down and we only need the current slug for the
// active state.
type Item = {
  slug: string;
  Icon: LucideIcon;
  label: string;
};

const ITEMS: Item[] = [
  { slug: "place", Icon: Store, label: "Place" },
  { slug: "promos", Icon: Gift, label: "Promos" },
  { slug: "team", Icon: Users, label: "Team" },
  { slug: "scan", Icon: ScanLine, label: "Scan" },
  { slug: "performance", Icon: BarChart3, label: "Stats" },
  { slug: "settings", Icon: Settings, label: "Settings" },
];

export function BottomNav({ unitId }: { unitId: string }) {
  const pathname = usePathname() ?? "";
  const currentSlug = pathname.match(/^\/unit\/[^/]+\/([^/]+)/)?.[1] ?? null;

  return (
    <nav className="border-border bg-card/95 z-40 shrink-0 border-t px-0.5 pt-2 backdrop-blur">
      <div className="flex items-end justify-around">
        {ITEMS.map(({ slug, Icon, label }) => {
          const active = currentSlug === slug;
          return (
            <Link
              key={slug}
              href={`/unit/${unitId}/${slug}`}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" />
              )}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary/10 ring-primary/20 ring-1",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
