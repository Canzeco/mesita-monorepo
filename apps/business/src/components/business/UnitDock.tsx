"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  CircleUser,
  Plus,
  Store,
  Gift,
  ScanLine,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveVenueCategoryName } from "@/lib/venue-category";
import type { MyVenue } from "@/lib/api/venues";
import { useUnitChrome } from "./UnitChrome";

type NavItem = {
  slug: string;
  Icon: LucideIcon;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { slug: "place", Icon: Store, label: "Place" },
  { slug: "promos", Icon: Gift, label: "Promos" },
  { slug: "scan", Icon: ScanLine, label: "Scan" },
  { slug: "performance", Icon: BarChart3, label: "Stats" },
  { slug: "team", Icon: Users, label: "Team" },
];

export function UnitDock({ unitId }: { unitId: string }) {
  const chrome = useUnitChrome();
  const pathname = usePathname() ?? "";
  const footerRef = useRef<HTMLElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuBottom, setMenuBottom] = useState(0);
  const [mounted, setMounted] = useState(false);

  const venues = chrome?.venues ?? [];
  const activeVenue =
    venues.find((v) => v.id === (chrome?.activeVenueId ?? unitId)) ??
    venues[0] ??
    null;
  const isSuperAdmin = chrome?.isSuperAdmin ?? false;
  const currentSlug =
    pathname.match(/^\/unit\/[^/]+\/([^/]+)/)?.[1] ?? "place";
  const canOpenVenueMenu = !isSuperAdmin && !!activeVenue;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setPickerOpen(false);
  }, [pathname]);

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
      const top = footerRef.current?.getBoundingClientRect().top ?? 0;
      setMenuBottom(window.innerHeight - top + 8);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pickerOpen]);

  const picker =
    pickerOpen && mounted && canOpenVenueMenu
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close venue picker"
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-[100] cursor-default bg-black/30"
            />
            <div
              className="border-border bg-card shadow-elev fixed inset-x-3 z-[110] max-h-[min(20rem,50vh)] overflow-y-auto rounded-2xl border"
              style={{ bottom: menuBottom }}
            >
              <p className="text-muted-foreground sticky top-0 border-b border-border/40 bg-card px-3 pt-2.5 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase">
                Your places
              </p>
              {venues.map((v) => (
                <Link
                  key={v.id}
                  href={`/unit/${v.id}/${currentSlug}`}
                  onClick={() => setPickerOpen(false)}
                  className={cn(
                    "hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition",
                    v.id === activeVenue?.id && "bg-primary/5",
                  )}
                >
                  <VenueAvatar name={v.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.name}</p>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {venueSubtitle(v)}
                    </p>
                  </div>
                  {v.id === activeVenue?.id ? (
                    <Check className="text-primary h-4 w-4 shrink-0" />
                  ) : null}
                </Link>
              ))}
              <Link
                href="/add"
                onClick={() => setPickerOpen(false)}
                className="border-border text-primary hover:bg-primary/5 flex items-center gap-2 border-t px-3 py-2.5 text-sm font-semibold transition"
              >
                <Plus className="h-4 w-4" />
                Add a place
              </Link>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {picker}
      <footer
        ref={footerRef}
        className="bg-dock text-dock-foreground border-dock-border relative z-40 shrink-0 border-t pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <nav
          aria-label="Venue sections"
          className="grid grid-cols-5 px-2 pt-2 pb-1"
        >
          {NAV_ITEMS.map(({ slug, Icon, label }) => {
            const active = currentSlug === slug;
            return (
              <Link
                key={slug}
                href={`/unit/${unitId}/${slug}`}
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
          {activeVenue ? (
            canOpenVenueMenu ? (
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                aria-expanded={pickerOpen}
                aria-label="Switch venue or add a place"
                className={cn(
                  "bg-dock-surface hover:bg-dock-surface-hover flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 transition",
                  pickerOpen && "bg-dock-surface-hover ring-primary/35 ring-1",
                )}
              >
                <VenueChip name={activeVenue.name} />
                <span className="truncate text-[13px] font-semibold tracking-tight">
                  {activeVenue.name}
                </span>
                <ChevronDown
                  className={cn(
                    "text-dock-muted ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    pickerOpen && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <div className="bg-dock-surface flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
                <VenueChip name={activeVenue.name} />
                <span className="truncate text-[13px] font-semibold tracking-tight">
                  {activeVenue.name}
                </span>
              </div>
            )
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
            href={`/unit/${unitId}/settings`}
            aria-label="Account settings"
            className={cn(
              "bg-dock-surface hover:bg-dock-surface-hover flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition",
              currentSlug === "settings" &&
                "bg-primary/20 ring-primary/35 ring-1 text-primary",
            )}
          >
            <span className="bg-pink-gradient flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm">
              <CircleUser className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-dock-muted text-[9px] font-medium leading-none">
              Profile
            </span>
          </Link>
        </div>
      </footer>
    </>
  );
}

function VenueChip({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span className="bg-pink-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm">
      {initial}
    </span>
  );
}

function VenueAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span className="bg-pink-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
      {initial}
    </span>
  );
}

function venueSubtitle(v: MyVenue): string {
  const parts = [
    v.vibe,
    resolveVenueCategoryName({
      categoryLabel: v.category_label,
      category: v.category,
    }),
  ].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" · ");
  return v.address ?? "Tap to switch";
}
