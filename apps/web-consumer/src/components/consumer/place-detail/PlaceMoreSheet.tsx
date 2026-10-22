"use client";

import { Fragment } from "react";
import { Flag, Heart, Link2, Share2, type LucideIcon } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import type { PlaceDetail } from "@/lib/place-detail";
import { copyPlaceLink, sharePlace } from "@/lib/share-place";
import { SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// THE THREE DOTS' MENU (Pato, MESITA-2692: "three dots in place profile is
// not only to report"), Instagram's way: one card of rows, Report last and
// red. Share · Add to favorites · Copy link · Report. Every row closes the
// menu first; Report then opens the Report sheet (MESITA-2684).
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

export function PlaceMoreSheet({
  place,
  open,
  onClose,
  saved,
  onSave,
  onReport,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
  saved: boolean;
  onSave: () => void;
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
  ];
  if (onReport)
    rows.push({
      key: "report",
      label: "Report",
      icon: Flag,
      run: onReport,
      danger: true,
    });

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={`More for ${place.name}`}
    >
      <div className={SHEET_BODY_CLASS}>
        <SettingsGroup>
          {rows.map((r, i) => (
            <Fragment key={r.key}>
              {i > 0 && <RowDivider />}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  r.run();
                }}
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
    </LocalSheet>
  );
}
