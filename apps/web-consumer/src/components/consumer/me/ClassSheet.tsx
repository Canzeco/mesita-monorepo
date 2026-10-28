"use client";

// Class — partnership status, Regular or VIP (Pato, MESITA-2553). One body,
// two frames: this sheet, opened by the Class chip on the guest's own card
// (Me's header), and the /me/class page behind Me's Class tile (MESITA-2562,
// ClassModal). On Social the chip is a plain fact and opens nothing.
//
// CLASS IS NOT PLAN. VIP comes through Mesita's partners (agencies, creator
// partnerships); it is never bought and never an upgrade to Pro. This sheet
// never names a plan, and the Plan page never names Class or VIP. Who
// qualifies and what the partner rates are is not decided, so nothing here
// promises either: the one VIP perk is tagged Soon, and a Regular guest gets
// one plain line, no button. The rows' words live in class-words.ts, which
// /me/class' fallback reads too (MESITA-2701).

import { Crown, UsersRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { CLASS_ROWS, type ClassRowWords } from "@/components/consumer/me/class-words";
import { PerkList } from "@/components/consumer/me/perk-list";
import { formatVipUntil, type GuestClass, type VipDetails } from "@/lib/guest-standing";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { IconCircle, RowDivider, SettingsGroup } from "./settings-rows";

function ClassRow({
  title,
  icon,
  mine,
  subtitle,
  perks,
  vip,
}: ClassRowWords & {
  icon: React.ReactNode;
  mine: boolean;
  /** MESITA-2556: the guest's own partner and last day, on their VIP row only. */
  vip?: VipDetails | null;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" data-class-row={title}>
      <IconCircle tint={mine ? "primary" : "muted"}>{icon}</IconCircle>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {mine && (
          <span className="text-foreground type-label block font-medium" data-class-mine="">
            Your class.
          </span>
        )}
        <span className="text-muted-foreground type-label block">{subtitle}</span>
        {mine && vip?.partner && (
          <span className="text-foreground type-label block" data-class-vip-partner="">
            Through {vip.partner}.
          </span>
        )}
        {mine && vip?.until && (
          <span className="text-foreground type-label block" data-class-vip-until="">
            Until {formatVipUntil(vip.until)}.
          </span>
        )}
        {perks && <PerkList label={perks.label} items={perks.items} />}
      </div>
    </div>
  );
}

/** Both classes, the guest's marked. Null (the read failed) marks neither and
 *  adds no Regular note: never a guessed Regular. */
export function ClassList({
  guestClass,
  vip = null,
}: {
  guestClass: GuestClass | null;
  vip?: VipDetails | null;
}) {
  return (
    <>
      <SettingsGroup>
        <ClassRow
          {...CLASS_ROWS.regular}
          icon={<UsersRound className="h-[18px] w-[18px]" />}
          mine={guestClass === "regular"}
        />
        <RowDivider />
        <ClassRow
          {...CLASS_ROWS.vip}
          icon={<Crown className="h-[18px] w-[18px]" />}
          mine={guestClass === "vip"}
          vip={vip}
        />
      </SettingsGroup>
      {guestClass === "regular" && (
        <p
          className="text-muted-foreground type-body mt-3"
          data-class-regular-note=""
        >
          VIP is added by Mesita when you come through a partner.
        </p>
      )}
    </>
  );
}

export function ClassSheet({
  open,
  onClose,
  guestClass,
  vip = null,
}: {
  open: boolean;
  onClose: () => void;
  guestClass: GuestClass;
  vip?: VipDetails | null;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Class">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Class</h2>
        <div className="mt-3">
          <ClassList guestClass={guestClass} vip={vip} />
        </div>
      </div>
    </LocalSheet>
  );
}
