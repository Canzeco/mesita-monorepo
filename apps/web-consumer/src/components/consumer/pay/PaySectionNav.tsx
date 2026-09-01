"use client";

// Pay's section row — New · Wallet.
//
// Pay became a CONTAINER on 2026-09-01. It was a single surface (a place list)
// for months, and the file's own rule said so: "IT IS A PLACE LIST AND NOTHING
// ELSE". That rule was about not stacking unrelated chrome ON the list — a
// steps rail, ticket rows, an Open chip — all of which were removed for it. A
// section row does not break it: New still IS that list, undiluted, and Wallet
// is a sibling you navigate to rather than a block layered on top.
//
// WALLET MOVED HERE FROM ACTIVITY, closing the category error named on
// 2026-08-31: Activity holds EVENTS (things that happened, or will), a wallet
// holds INSTRUMENTS (money and cards). /inbox/credits 308s here.
//
// Same look as InboxSectionNav — the app has ONE section-nav look and these
// rows must not drift: `grid-flow-col auto-cols-fr` on a `w-max min-w-full`
// track, so at rest the columns split the frame evenly (50% each here) and at
// large accessibility text the scroller takes over, columns still equal.
//
// Two sections is the floor. A one-section row is chrome pretending to be a
// control, which is exactly why the old ticket-history tab track was deleted.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

type Section = { href: string; label: string; Icon: LucideIcon };

// NEW LEADS, and bare /new-visit is also the default: you open this tab
// standing in a place, not to check a balance. Activity splits first-from-
// default on purpose; here they agree, because the urgent thing is also first.
export const SECTIONS: Section[] = [
  { href: CONSUMER_ROUTES.newVisit.new, label: "New", Icon: QrCode },
  { href: CONSUMER_ROUTES.newVisit.wallet, label: "Wallet", Icon: Wallet },
];

export function PaySectionNav() {
  const pathname = usePathname();

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
          {SECTIONS.map(({ href, label, Icon }) => {
            // EXACT match, not startsWith: /new-visit is a prefix of
            // /new-visit/wallet, so startsWith would light New on both.
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-full px-1 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
