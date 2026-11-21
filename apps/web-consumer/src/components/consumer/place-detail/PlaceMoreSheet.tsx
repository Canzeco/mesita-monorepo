"use client";

import {
  Flag,
  Heart,
  Link2,
  Rocket,
  Share2,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { PlaceDetail } from "@/lib/place-detail";
import { copyPlaceLink, sharePlace } from "@/lib/share-place";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { businessClaimHref } from "@/lib/business-url";
import { cn } from "@/lib/utils";

// MORE, A PLACE-PROFILE CARD (Pato, 2026-11-20, MESITA-4508: "put more
// inside a box"): the same white rounded card as Score, the title inside,
// the rows under it. It was a label on the grey ground with flat rows
// (MESITA-4111), and a sheet before that (MESITA-2692). Share · Add to
// favorites · Copy link · Upgrade · Is this your business? · Report.
// Upgrade opens the Upgrade page and Report the Report page.
// decision: the rows are the place's own one-tap actions plus Copy link;
// nothing new is built behind them. The card is the place screen's Box
// (rounded-xl, 16px pad, 16px title), drawn here so the consumer rows stay
// in this app.

type Row = {
  key: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
  danger?: boolean;
  filled?: boolean;
};

export function PlaceMoreRows({
  place,
  saved,
  onSave,
  onUpgrade,
  onReport,
}: {
  place: PlaceDetail;
  saved: boolean;
  onSave: () => void;
  /** Opens the Upgrade page. */
  onUpgrade: () => void;
  /** Absent for a Google-only card: no Report row. */
  onReport?: () => void;
}) {
  const rows: Row[] = [
    {
      key: "share",
      label: "Share",
      icon: Share2,
      run: () => void sharePlace(place),
    },
    {
      key: "save",
      label: saved ? "Remove from favorites" : "Add to favorites",
      icon: Heart,
      run: onSave,
      filled: saved,
    },
    {
      key: "copy",
      label: "Copy link",
      icon: Link2,
      run: () => void copyPlaceLink(place),
    },
    {
      key: "boost",
      label: "Upgrade",
      icon: Rocket,
      run: onUpgrade,
    },
  ];
  // "Is this your business?" (MESITA-3103): the Business app's claim page for
  // this place, in a new tab. Mesita places only, and only when the app's
  // address is configured; a guest never needs it.
  const claimHref = isMesitaPlaceId(place.id)
    ? businessClaimHref(place.id)
    : null;
  if (claimHref)
    rows.push({
      key: "claim",
      label: "Is this your business?",
      icon: Store,
      run: () => void window.open(claimHref, "_blank", "noopener"),
    });
  if (onReport)
    rows.push({
      key: "report",
      label: "Report",
      icon: Flag,
      run: onReport,
      danger: true,
    });

  return (
    <section
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      data-place-more
    >
      <h3 className="text-foreground font-sans text-base font-semibold tracking-tight">
        More
      </h3>
      <ul className="divide-border divide-y">
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={r.run}
              className={cn(
                "hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-lg py-2 text-left text-sm font-semibold transition",
                r.danger && "text-destructive",
              )}
            >
              <r.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  r.filled && "fill-destructive text-destructive",
                )}
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="min-w-0 flex-1">{r.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
