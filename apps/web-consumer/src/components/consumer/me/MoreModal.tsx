"use client";

import {
  BarChart3,
  Bot,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  IdCard,
  Instagram,
  Mail,
  MoreHorizontal,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { MESITA_SUPPORT_EMAIL } from "@/lib/mesita-contact";
import { cn } from "@/lib/utils";

// Me › More. The Me page keeps EIGHT primary boxes (MESITA-1609, same count
// MESITA-1123 set, different composition — see ProfileClient.tsx's file-top
// comment for the full history, including the "seven" this comment itself
// used to say even after Passport made it eight). Everything else lives one
// tap deeper, here.
//
// The split is by FREQUENCY, not importance — unchanged principle, reapplied
// to a bigger inventory now that Alerts/Visits/Reservations/Wallet joined
// Me's primary boxes and something had to make room. Instagram, Passport and
// AI Connector moved here from primary for that reason, not because any of
// them got less important.
//
// THE PLAN TRADEOFF THIS COMMENT FLAGGED IS RESOLVED (MESITA-1619). It read:
// "Plan is your subscription and Instagram is a growth surface, which is a
// real product tradeoff flagged for confirmation outside this PR, not decided
// by this file." The answer came when the Passport stopped printing the plan.
// The tile was the only thing making a subscription two taps deep survivable,
// so Plan went back to primary and Instagram took the passport's full width.
//
// Neither Wallet nor Plan has a row here any more (MESITA-1609 and -1619,
// removed, not demoted). Both are PRIMARY boxes on Me, so a second door here
// would be redundant with the one that promotion exists to shorten.
//
// Neutral chips, like the boxes that lead Me itself (MESITA-1132): colour on
// this surface belongs to the passport alone.

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
  onOpenInstagram,
  igSummary,
  onOpenPassport,
  passportSummary,
  onOpenAiConnect,
  onOpenShare,
  onOpenMetrics,
  onOpenHelp,
  onOpenContact,
  metricsSummary,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCards: () => void;
  onOpenInstagram: () => void;
  igSummary: string;
  onOpenPassport: () => void;
  passportSummary: string;
  onOpenAiConnect: () => void;
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
      key: "instagram",
      Icon: Instagram,
      title: "Instagram",
      summary: igSummary,
      onClick: onOpenInstagram,
    },
    {
      key: "passport",
      Icon: IdCard,
      title: "Passport",
      summary: passportSummary,
      onClick: onOpenPassport,
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
      key: "aiconnect",
      Icon: Bot,
      title: "AI Connector",
      summary: "Use Mesita from ChatGPT or Claude (MCP)",
      soon: true,
      onClick: onOpenAiConnect,
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
