"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { MesitaWordmark } from "@/components/brand/MesitaWordmark";
import { place } from "@/lib/mock";
import { isActive, manage, moreItems, products, soon, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MockBanner() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-center text-xs text-background">
      <span className="rounded-full bg-background/15 px-2 py-0.5 font-semibold tracking-wide">MOCK</span>
      <span className="truncate">Nothing here is real: no backend, no place, every name and number invented.</span>
    </div>
  );
}

function PlaceSwitcher({ dark }: { dark?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 text-sm", dark ? "text-rail-foreground" : "")}>
      <span className="truncate font-medium">{place.name}</span>
      <span className={dark ? "text-rail-muted" : "text-muted-foreground"}>· {place.plan}</span>
    </div>
  );
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9375rem] transition-colors",
        active ? "bg-rail-active text-white" : "text-rail-foreground hover:bg-rail-hover",
      )}
    >
      <Icon className={cn("size-[1.125rem] shrink-0", active ? "text-[var(--brand-pink-300)]" : "text-rail-muted")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/** The desktop rail: products first, Billing and Settings under the line. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-rail pt-9 lg:flex">
      <Link href="/visits" className="flex items-center gap-2 px-6 py-5 text-white">
        <MesitaMark className="size-7 text-[var(--brand-pink)]" />
        <MesitaWordmark className="h-5 w-auto text-white" />
        <span className="type-eyebrow ml-1 text-rail-muted">Business</span>
      </Link>
      <button type="button" className="mx-3 mb-4 flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-rail-hover">
        <PlaceSwitcher dark />
        <ChevronRight className="size-4 text-rail-muted" aria-hidden />
      </button>
      <nav aria-label="Console" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
        <div className="type-eyebrow px-3 pt-2 pb-2 text-rail-muted">Products</div>
        {products.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="my-2" />
        <RailLink item={soon} pathname={pathname} />
        <div className="mx-3 my-4 border-t border-white/10" />
        {manage.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}

/** The phone's top bar: the mark, the place, and the place's plan. */
export function MobileHeader() {
  return (
    <header className="sticky top-[1.875rem] z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
      <MesitaMark className="size-6 shrink-0 text-[var(--brand-pink)]" />
      <PlaceSwitcher />
    </header>
  );
}

/** The phone's tab bar: the four money-and-visits pages, then More. */
export function BottomTabs() {
  const pathname = usePathname();
  const tabs = products.filter((p) => p.tab);
  const moreActive =
    pathname === "/more" || moreItems.some((m) => isActive(pathname, m.href));
  return (
    <nav
      aria-label="Console"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-xs font-medium",
                active ? "text-brand-text" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {t.label}
              {t.badge ? (
                <span className="absolute top-2 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-white">
                  {t.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <Link
          href="/more"
          aria-current={pathname === "/more" ? "page" : undefined}
          className={cn(
            "flex flex-col items-center justify-center gap-1 text-xs font-medium",
            moreActive ? "text-brand-text" : "text-muted-foreground",
          )}
        >
          <Menu className="size-5" aria-hidden />
          More
        </Link>
      </div>
    </nav>
  );
}
