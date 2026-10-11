"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MesitaMark } from "@/components/brand/MesitaMark";
import { APP_CARD_ID } from "@/components/consumer/MobileFrame";
import { barePath } from "@/lib/surface";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
  CONSUMER_RESERVATION_SURFACE_PREFIX,
} from "@/lib/consumer-route-contract";

const LINKS = [
  {
    href: CONSUMER_ROUTES.discoverDefault,
    label: "Home",
    match: [
      CONSUMER_ROUTES.discoverTabs.scroll,
      CONSUMER_ROUTES.discoverTabs.chat,
      CONSUMER_ROUTES.discoverTabs.favs,
      CONSUMER_ROUTE_PREFIX.place,
    ],
  },
  {
    href: CONSUMER_ROUTES.search,
    label: "Search",
    match: [CONSUMER_ROUTES.search],
  },
  // The same four destinations as BottomNav, in its order (MESITA-2087 First
  // Stage cut: Visit and Wallet are gone; Pay is one Soon page).
  {
    href: CONSUMER_ROUTES.pay,
    label: "Pay",
    match: [CONSUMER_ROUTE_PREFIX.pay],
  },
  {
    href: CONSUMER_ROUTES.me,
    label: "Me",
    match: [CONSUMER_ROUTE_PREFIX.me, CONSUMER_RESERVATION_SURFACE_PREFIX],
  },
] as const;

function NavLinks({ className }: { className?: string }) {
  const pathname = barePath(usePathname() ?? "/");
  return (
    <nav className={className} aria-label="Sections">
      {LINKS.map((item) => {
        const active = item.match.some((prefix) => pathname.startsWith(prefix));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "type-body rounded-lg px-3 py-2 font-medium transition",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The large consumer site. Full width, responsive, ONE breakpoint (md):
 *
 *   md and up    the sidebar is the menu; the shell hides BottomNav.
 *   below md     THE PHONE VIEW (Pato, MESITA-2130: "when not wide, use the
 *                normal menu with phone view"). BottomNav is the menu and
 *                nothing is added on top: the phone app has no header, so a
 *                web-only strip here is what made narrow /web read as a
 *                different app. The Phone emulator link lives in the sidebar.
 *
 * Never the phone card — that is /mob's MobileFrame.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const keyboardInset = useKeyboardInset();
  return (
    <div
      className="bg-background flex h-[calc(100dvh-var(--kb,0px))] min-h-0 w-full"
      style={{ "--kb": `${keyboardInset}px` } as CSSProperties}
    >
      <aside className="border-border bg-card hidden w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <MesitaMark className="h-7 w-7" />
          <span className="type-body font-semibold">Mesita</span>
        </div>
        <NavLinks className="flex flex-1 flex-col gap-1 px-3" />
        <Link
          href="/mob"
          className="type-meta text-muted-foreground hover:text-foreground border-border border-t px-4 py-3"
        >
          Phone emulator
        </Link>
      </aside>
      <div
        id={APP_CARD_ID}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {children}
      </div>
    </div>
  );
}
