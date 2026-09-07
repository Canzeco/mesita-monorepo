"use client";

import {
  ChevronRight,
  Gift,
  MoreHorizontal,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Me › More — THE PARKED TAIL, and nothing else (MESITA-1628).
//
// This sheet has been shrinking for three PRs and it has finally arrived
// somewhere principled. MESITA-1609 filled it with everything Me's primary
// boxes could not hold; -1619 took Plan back out; -1622 took Passport; -1628
// took Profile, Settings, Cards, Instagram, Metrics, Help and Contact into
// the destination grid on the page itself.
//
// What is left is Gift and Share, both `soon`, neither with a table or an
// Edge Function behind them. AI Connector left for a cell of its own on the
// page (MESITA-1633) — still parked, just parked in the open. That is a better job than "the overflow drawer" — a guest opening
// More now learns what is coming, rather than hunting for a setting that
// could have been on the page.
//
// WHY THEY ARE NOT IN THE GRID. Three greyed cells out of eleven is a quarter
// of the block, and in a grid a dead cell reads as broken rather than
// upcoming; in a list it reads as a roadmap. Un-parking one is dropping its
// `soon` and moving it up to the grid, in that order.
//
// Neutral chips, like the grid on the page (MESITA-1132): colour on this
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
  onOpenShare,
}: {
  open: boolean;
  onClose: () => void;
  /** Wired while parked so un-parking is a `soon` removal alone — the sheet
   *  it opens already works. */
  onOpenShare: () => void;
}) {
  const rows: MoreRow[] = [
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
      onClick: onOpenShare,
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
              Coming soon to your account
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
