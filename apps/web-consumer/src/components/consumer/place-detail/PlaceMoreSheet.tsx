"use client";

import { Fragment } from "react";
import {
  Flag,
  Heart,
  Link2,
  Rocket,
  Share2,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import type { PlaceDetail } from "@/lib/place-detail";
import { copyPlaceLink, sharePlace } from "@/lib/share-place";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { businessClaimHref } from "@/lib/business-url";
import { cn } from "@/lib/utils";

// MORE, ROWS AT THE FOOT OF THE PLACE PAGE (MESITA-4111, the plan's row 13).
// It was the three dots' sheet (Pato, MESITA-2692: "three dots in place
// profile is not only to report"): one card of rows, Report last and red.
// Share · Add to favorites · Copy link · Upgrade · Is this your business? ·
// Report. Upgrade opens the Upgrade page and Report the Report page.
// decision: the rows are the place's own one-tap actions plus Copy link;
// nothing new is built behind them.

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
    <div className="px-4 pt-2 pb-8">
      <p className="text-muted-foreground px-1 pb-2 text-xs font-semibold">
        More
      </p>
      <SettingsGroup flat>
        {rows.map((r, i) => (
          <Fragment key={r.key}>
            {i > 0 && <RowDivider />}
            <button
              type="button"
              onClick={r.run}
              className={cn(
                "hover:bg-muted flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition",
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
          </Fragment>
        ))}
      </SettingsGroup>
    </div>
  );
}
