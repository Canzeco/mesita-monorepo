"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Check, Plus, Settings, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/shared";
import { resolveVenueCategoryName } from "@/lib/venue-category";
import type { MyVenue } from "@/lib/api/venues";
import { useUnitChrome } from "./UnitChrome";

// The venue console app bar:
//   left  — Mesita logo + current unit, tap unit to switch venues (or add one)
//   right — two circular actions: Settings (gear) and Profile (account)
//
// Unit data comes from UnitChrome context (provided by the unit layout).
// The legacy title/subtitle/innerClassName props are accepted but ignored
// so existing `<Topbar title=... />` call sites keep compiling without edits.
export function Topbar(
  _props: {
    title?: string;
    subtitle?: string;
    innerClassName?: string;
  } = {},
) {
  const chrome = useUnitChrome();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const unitId =
    chrome?.unitId ?? pathname.match(/^\/unit\/([^/]+)/)?.[1] ?? null;
  const venues = chrome?.venues ?? [];
  const activeVenue =
    venues.find((v) => v.id === (chrome?.activeVenueId ?? unitId)) ??
    venues[0] ??
    null;
  const isSuperAdmin = chrome?.isSuperAdmin ?? false;
  const currentSlug = pathname.match(/^\/unit\/[^/]+\/([^/]+)/)?.[1] ?? "place";
  const canSwitch = !isSuperAdmin && venues.length > 0;

  return (
    <header className="border-border bg-background/85 sticky top-0 z-20 shrink-0 border-b backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Left — brand + current unit / switcher */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={unitId ? `/unit/${unitId}/place` : "/"}
            aria-label="Mesita"
            className="shrink-0"
          >
            <MesitaLogo size={32} />
          </Link>
          <div className="relative min-w-0 flex-1">
          {activeVenue ? (
            canSwitch ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  className="border-border bg-card hover:bg-muted/50 inline-flex max-w-full items-center gap-1.5 rounded-full border py-1.5 pr-2.5 pl-3.5 text-left transition"
                >
                  <span className="font-display truncate text-[15px] leading-tight font-semibold tracking-tight">
                    {activeVenue.name}
                  </span>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>

                {open && (
                  <>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="border-border bg-card shadow-elev absolute top-full left-0 z-20 mt-1.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border">
                      <p className="text-muted-foreground px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
                        Your places
                      </p>
                      {venues.map((v) => (
                        <Link
                          key={v.id}
                          href={`/unit/${v.id}/${currentSlug}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                            v.id === activeVenue.id && "bg-secondary/5",
                          )}
                        >
                          <VenueAvatar name={v.name} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm leading-tight font-semibold">
                              {v.name}
                            </p>
                            <p className="text-muted-foreground truncate text-[11px]">
                              {venueSubtitle(v)}
                            </p>
                          </div>
                          {v.id === activeVenue.id && (
                            <Check className="text-secondary h-4 w-4 shrink-0" />
                          )}
                        </Link>
                      ))}
                      <Link
                        href="/add"
                        onClick={() => setOpen(false)}
                        className="border-border text-secondary hover:bg-secondary/5 flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm font-semibold transition"
                      >
                        <Plus className="h-4 w-4" />
                        Add a place
                      </Link>
                    </div>
                  </>
                )}
              </>
            ) : (
              // Super-admin (or single, non-switchable): show the unit, no picker.
              <div className="border-border bg-card inline-flex max-w-full items-center rounded-full border py-1.5 pr-3.5 pl-3.5">
                <span className="font-display truncate text-[15px] leading-tight font-semibold tracking-tight">
                  {activeVenue.name}
                </span>
              </div>
            )
          ) : (
            <Link
              href="/add"
              className="border-border bg-card text-secondary hover:bg-muted/50 inline-flex max-w-full items-center gap-1.5 rounded-full border py-1.5 pr-3.5 pl-3 text-sm font-semibold transition"
            >
              <Plus className="h-4 w-4" />
              Add a place
            </Link>
          )}
          </div>
        </div>

        {/* Right — Settings (gear) + Profile (account) */}
        {unitId && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/unit/${unitId}/settings`}
              aria-label="Settings"
              className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full border transition"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href={`/unit/${unitId}/settings`}
              aria-label="Profile"
              className="bg-pink-gradient flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition hover:brightness-105"
            >
              <CircleUser className="h-[18px] w-[18px]" />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function VenueAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span className="bg-pink-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm">
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
