"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Flag, Store } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { businessClaimHref } from "@/lib/business-url";
import { placeReportPath } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/place-detail";

// THE THREE DOTS ARE BACK (Pato, 2026-11-21, MESITA-4621: "where are the
// three dots at top right??? with modal menu that asks about options such as
// claim business … report too"). MESITA-4111 hid them for a More card at the
// foot of the place and MESITA-4550 removed the card, so Claim lived only on
// the Upgrade page and Report only on Contact. The dots at the header's right
// edge open this small menu: Claim this business, Report, Cancel. A Pato-named
// exception to the no-sheets law (no-sheets.test.ts › CONFIRM_FILES).
// Mesita places only: a Google-only place has nothing to claim or report yet.

const ROW =
  "text-foreground hover:bg-muted/60 active:bg-muted flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold transition";

function Row({ icon, label, sub }: { icon: ReactNode; label: string; sub: string }) {
  return (
    <>
      <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        <span className="text-muted-foreground block text-sm font-normal">{sub}</span>
      </span>
      <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
    </>
  );
}

/** The dots' handler and the menu to mount beside the place. `onMore` is
 *  undefined for a place with no menu (not a Mesita place). */
export function usePlaceMoreMenu(place: PlaceDetail): {
  onMore: (() => void) | undefined;
  menu: ReactNode;
} {
  const [open, setOpen] = useState(false);
  if (!isMesitaPlaceId(place.id)) return { onMore: undefined, menu: null };
  const close = () => setOpen(false);
  const menu = (
    <LocalDialog open={open} onClose={close} ariaLabel={`${place.name}: more options`}>
      <ul className="divide-border divide-y">
        <li>
          <a
            href={businessClaimHref(place.id)}
            target="_blank"
            rel="noopener"
            onClick={close}
            className={ROW}
          >
            <Row
              icon={<Store className="h-5 w-5" strokeWidth={2} aria-hidden />}
              label="Claim this business"
              sub="Is this place yours? Manage it on Mesita"
            />
          </a>
        </li>
        <li>
          <PushLink href={placeReportPath(place.id)} onClick={close} className={ROW}>
            <Row
              icon={<Flag className="h-5 w-5" strokeWidth={2} aria-hidden />}
              label="Report"
              sub="Something wrong with this place"
            />
          </PushLink>
        </li>
        <li>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground hover:bg-muted/60 flex min-h-14 w-full items-center justify-center text-base font-semibold transition"
          >
            Cancel
          </button>
        </li>
      </ul>
    </LocalDialog>
  );
  return { onMore: () => setOpen(true), menu };
}
