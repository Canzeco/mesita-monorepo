"use client";

import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  Mail,
  MoreHorizontal,
  Share2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { MESITA_SUPPORT_EMAIL } from "@/lib/mesita-contact";
import { cn } from "@/lib/utils";

// Me › More (decision: Pato, MESITA-1123). The Me page keeps SEVEN boxes —
// Instagram · Class · Plan · Profile · Settings · AI Connector · More — and
// everything else lives one tap deeper.
//
// The split is by FREQUENCY, not importance. The seven are what a guest opens
// repeatedly or must reach in a hurry; these seven are the long tail: one you
// set once and forget (Cards), one that opens a parked preview surface
// (Credits), one that doesn't exist yet (Gift), one parked (Share), and three
// you consult once and rarely again (Metrics, Help,
// Contact). Twelve boxes made the surface a wall to scroll — the parked ones
// sat between live ones, so the page read as mostly-unfinished. Behind More,
// the unfinished work stops being the first thing you see.
//
// Cards leads because it is the one LIVE row here and because it must sit
// next to Credits: two wallets, two names (Pato, 2026-08-29). Cards holds cards
// and pays a bill; Credits holds Mesita Credits, which REDUCE one. Sharing the
// word "wallet" between them was the confusion this ordering prevents.
//
// Neutral chips, like the boxes that lead here (MESITA-1132): colour on this
// surface belongs to the passport alone.

type MoreRow = {
  key: string;
  Icon: LucideIcon;
  title: string;
  summary: string;
  /** Parked: no table, EF or type yet. Visible, inert, honest. */
  soon?: boolean;
  onClick?: () => void;
};

export function MoreModal({
  open,
  onClose,
  onOpenCards,
  onOpenCredits,
  onOpenShare,
  onOpenMetrics,
  onOpenHelp,
  onOpenContact,
  metricsSummary,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCards: () => void;
  /** Navigates to the Credits Inbox section — a route, not a sheet. */
  onOpenCredits: () => void;
  onOpenShare: () => void;
  onOpenMetrics: () => void;
  onOpenHelp: () => void;
  onOpenContact: () => void;
  /** Live "MX$X saved · N visits" when the page has it; falls back to the
   *  field list while loading or if the metrics EF failed. */
  metricsSummary: string;
}) {
  const rows: MoreRow[] = [
    {
      key: "cards",
      Icon: CreditCard,
      title: "Cards",
      // Static on purpose: Me's law is that a summary reads live wherever the
      // page ALREADY holds the data, and ProfileClient holds profile and
      // metrics, not cards. A live count would cost a third EF read on every
      // Me mount to serve a row most guests never tap; the count lives inside
      // the sheet, where the fetch already happens.
      summary: "Saved cards for Premium and Mesita Pay",
      onClick: onOpenCards,
    },
    {
      key: "credits",
      Icon: Wallet,
      title: "Credits",
      summary: "Earn and spend at the bill · 1 Credit = MX$1",
      // Un-parked as `soon: false` PLUS a page body, which is what un-parking
      // means here. It could not stay `soon` and still be a door: a parked row
      // is `disabled` below, so its handler never fires — which is why the
      // parked Share row cannot reach /share either, live route and all.
      //
      // Credits now also lives as the FIRST Inbox section (MESITA-1381). This
      // row survives as the second doorway, the way Share does: removing it
      // would take away a path guests already have, and Me stays seven boxes
      // either way because this is More, not Me. The surface it opens says
      // Soon on itself — hero pill and the marker under the stack.
      onClick: onOpenCredits,
    },
    {
      key: "gift",
      Icon: Gift,
      title: "Gift",
      summary: "Buy Credits or send them to a friend",
      soon: true,
    },
    {
      key: "share",
      Icon: Share2,
      title: "Share",
      summary: "Invite a friend, both get Credits",
      soon: true,
      // Handler stays wired while parked so un-parking is `soon` removal
      // alone — the sheet it opens already works.
      onClick: onOpenShare,
    },
    {
      key: "metrics",
      Icon: BarChart3,
      title: "Metrics",
      summary: metricsSummary,
      onClick: onOpenMetrics,
    },
    {
      key: "help",
      Icon: HelpCircle,
      title: "Help",
      summary: "How the discount works",
      onClick: onOpenHelp,
    },
    {
      key: "contact",
      Icon: Mail,
      title: "Contact",
      summary: MESITA_SUPPORT_EMAIL,
      onClick: onOpenContact,
    },
  ];

  // Opening a row hands off to a sheet that lives at the same z-layer, so this
  // one closes first — two LocalSheets must never stack (z-[130]).
  function handOff(run: () => void) {
    onClose();
    run();
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="More">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground/70 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <MoreHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>More</h2>
            <p className="text-muted-foreground text-xs">
              Everything else on your account
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const inert = row.soon || !row.onClick;
            return (
              <button
                key={row.key}
                type="button"
                onClick={
                  inert || !row.onClick
                    ? undefined
                    : () => handOff(row.onClick!)
                }
                disabled={inert}
                aria-disabled={inert}
                title={row.soon ? "Coming soon" : undefined}
                className={cn(
                  "border-border bg-card flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                  inert ? "opacity-60" : "hover:bg-muted/50",
                )}
              >
                <span className="bg-muted text-foreground/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                  <row.Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight">
                      {row.title}
                    </span>
                    {row.soon && (
                      <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {row.summary}
                  </span>
                </span>
                {!row.soon && (
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </LocalSheet>
  );
}
