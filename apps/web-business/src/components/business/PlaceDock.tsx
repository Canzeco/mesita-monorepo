"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleUser,
  Plus,
  Store,
  Percent,
  BarChart3,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaceChrome } from "./PlaceChrome";
import { PlaceChip, PlaceDockPicker } from "./PlaceDockPicker";
import {
  BUSINESS_ROUTES,
  dockHrefForSection,
  pathnamePlaceId,
} from "@/lib/business-route-contract";
import { resolveActivePlaceId } from "@/lib/active-place";

type NavItem = {
  slug: "place" | "promos" | "performance" | "settings";
  Icon: LucideIcon;
  label: string;
};

// Four tabs (MESITA-900). Mesita Check stays off the dock (public check page).
// Reservationist bookings + AI dial lines live inside Performance again
// (reverses MESITA-894). Channel routing + Check PIN + team stay under Settings.
const NAV_ITEMS: NavItem[] = [
  { slug: "place", Icon: Store, label: "Profile" },
  { slug: "promos", Icon: Percent, label: "Partnership" },
  { slug: "performance", Icon: BarChart3, label: "Performance" },
  { slug: "settings", Icon: Settings2, label: "Settings" },
];

export function PlaceDock() {
  const chrome = usePlaceChrome();
  const pathname = usePathname() ?? "";
  const footerRef = useRef<HTMLElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Anchored to the dock's own box so the portaled menu stays inside the
  // phone frame instead of spanning the whole viewport.
  const [menuRect, setMenuRect] = useState({ bottom: 0, left: 0, width: 0 });
  const [lastPathname, setLastPathname] = useState(pathname);

  const places = useMemo(() => chrome?.places ?? [], [chrome?.places]);
  const projectIds = useMemo(() => places.map((v) => v.id), [places]);
  const urlPlaceId = pathnamePlaceId(pathname);
  const activePlaceId = resolveActivePlaceId({
    pathnamePlaceId: urlPlaceId,
    cookieId: chrome?.activePlaceId ?? null,
    projectIds,
  });
  const activePlace =
    places.find((v) => v.id === activePlaceId) ?? places[0] ?? null;

  const currentSection = useMemo(() => {
    const match = pathname.match(/^\/place\/[^/]+\/([^/]+)/)?.[1];
    if (match === "place" || match === "promos") return match;
    if (match === "performance" || match === "settings") return match;
    // Retired Reservations tab → treat as Performance for dock highlight.
    if (match === "reservations") return "performance";
    return null;
  }, [pathname]);

  const settingsActive = pathname === BUSINESS_ROUTES.settings;

  // Close the place picker on any route change (including browser
  // back/forward). React's reset-during-render pattern avoids the
  // cascading re-render that a setState-in-effect would trigger.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || !footerRef.current) return;
    const update = () => {
      const rect = footerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuRect({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pickerOpen]);

  return (
    <>
      <PlaceDockPicker
        open={pickerOpen && !!activePlace}
        places={places}
        activePlace={activePlace}
        pathname={pathname}
        menuRect={menuRect}
        onClose={() => setPickerOpen(false)}
      />
      <footer
        ref={footerRef}
        className="bg-dock text-dock-foreground border-dock-border relative z-40 shrink-0 border-t pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <nav
          aria-label="Place sections"
          className="grid grid-cols-4 px-2 pt-2 pb-1"
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
                  "relative flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-dock-muted",
                )}
              >
                {active ? (
                  <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" />
                ) : null}
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    active && "bg-primary/20 ring-primary/35 ring-1",
                  )}
                >
                  <Icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span
                  className={cn(
                    "w-full truncate px-0.5 text-center leading-none",
                    active && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-dock-border flex items-stretch gap-2 border-t px-3 pt-1.5 pb-1.5">
          {activePlace ? (
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              aria-expanded={pickerOpen}
              aria-label="Switch place or add a place"
              className={cn(
                "bg-dock-surface hover:bg-dock-surface-hover flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 transition",
                pickerOpen && "bg-dock-surface-hover ring-primary/35 ring-1",
              )}
            >
              <PlaceChip name={activePlace.name} />
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {activePlace.name}
              </span>
              <ChevronDown
                className={cn(
                  "text-dock-muted ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  pickerOpen && "rotate-180",
                )}
              />
            </button>
          ) : (
            <Link
              href="/add"
              className="bg-primary/20 text-primary hover:bg-primary/30 flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition"
            >
              <Plus className="h-4 w-4" />
              Add a place
            </Link>
          )}

          <Link
            href={BUSINESS_ROUTES.settings}
            aria-label="Account settings"
            className={cn(
              "bg-dock-surface hover:bg-dock-surface-hover flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition",
              settingsActive &&
                "bg-primary/20 ring-primary/35 text-primary ring-1",
            )}
          >
            <span className="bg-pink-gradient flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm">
              <CircleUser className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-dock-muted text-[9px] leading-none font-medium">
              Account
            </span>
          </Link>
        </div>
      </footer>
    </>
  );
}
