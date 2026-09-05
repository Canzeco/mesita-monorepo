"use client";

// Top navigation for the per-place console. Replaces PlaceDock, which was
// a phone-shaped bottom bar inside a 384px frame: the console is a desktop
// web app now, so the sections sit in a header where a desktop user looks
// for them.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Percent, Settings2, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { usePlaceChrome } from "@/components/business/PlaceChrome";
import {
  dockHrefForSection,
  pathnamePlaceId,
} from "@/lib/business-route-contract";

type Slug = "place" | "promos" | "performance" | "settings";

const NAV_ITEMS: { slug: Slug; Icon: LucideIcon; label: string }[] = [
  { slug: "place", Icon: Store, label: "Profile" },
  { slug: "promos", Icon: Percent, label: "Partnership" },
  { slug: "performance", Icon: BarChart3, label: "Performance" },
  { slug: "settings", Icon: Settings2, label: "Settings" },
];

export function PlaceNav() {
  const pathname = usePathname();
  const chrome = usePlaceChrome();
  const activePlaceId = chrome?.activePlaceId ?? pathnamePlaceId(pathname);
  const activePlace =
    chrome?.places.find((p) => p.id === activePlaceId) ?? null;
  const currentSection = pathname.match(/^\/place\/[^/]+\/([^/]+)/)?.[1];

  return (
    <header className="border-border bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/places" aria-label="All places" className="shrink-0">
          <MesitaLogo variant="horizontal" className="h-6 w-auto" />
        </Link>

        {activePlace && (
          <Link
            href="/places"
            className="text-muted-foreground hover:text-foreground min-w-0 truncate text-sm transition"
            title="Switch place"
          >
            <span className="text-foreground font-semibold">
              {activePlace.name}
            </span>
            <span className="ml-2 text-[12px]">Switch</span>
          </Link>
        )}

        {activePlaceId && (
          <nav
            aria-label="Place sections"
            className="ml-auto flex items-center gap-1"
          >
            {NAV_ITEMS.map(({ slug, Icon, label }) => {
              const active =
                slug === "place"
                  ? currentSection === "place"
                  : currentSection === slug;
              return (
                <Link
                  key={slug}
                  href={dockHrefForSection(slug, activePlaceId, pathname)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
