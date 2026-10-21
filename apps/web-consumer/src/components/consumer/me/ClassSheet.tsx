"use client";

// Class — partnership status, Regular or VIP (Pato, MESITA-2553). Opened by
// tapping the Class chip on the guest's own card (Me's header); on Social the
// chip is a plain fact and opens nothing.
//
// CLASS IS NOT PLAN. VIP comes through Mesita's partners (agencies, creator
// partnerships); it is never bought and never an upgrade to Premium. This sheet
// never names a plan, and the Plan page never names Class or VIP. Who
// qualifies and what the partner rates are is not decided, so nothing here
// promises either: the one VIP perk is tagged Soon, and a Regular guest gets
// one plain line, no button.

import { Crown, UsersRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { PerkList } from "@/components/consumer/me/perk-list";
import type { GuestClass } from "@/lib/guest-standing";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { IconCircle, RowDivider, SettingsGroup } from "./settings-rows";

function ClassRow({
  title,
  icon,
  mine,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  mine: boolean;
  subtitle: string;
  children?: React.ReactNode;
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
        {children}
      </div>
    </div>
  );
}

export function ClassSheet({
  open,
  onClose,
  guestClass,
}: {
  open: boolean;
  onClose: () => void;
  guestClass: GuestClass;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Class">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Class</h2>
        <div className="mt-3">
          <SettingsGroup>
            <ClassRow
              title="Regular"
              icon={<UsersRound className="h-[18px] w-[18px]" />}
              mine={guestClass === "regular"}
              subtitle="Every member."
            />
            <RowDivider />
            <ClassRow
              title="VIP"
              icon={<Crown className="h-[18px] w-[18px]" />}
              mine={guestClass === "vip"}
              subtitle="Through Mesita's partners, like agencies and creator partnerships. Never bought."
            >
              <PerkList
                label="Comes with VIP"
                items={[{ text: "Special rates at partner venues", soon: true }]}
              />
            </ClassRow>
          </SettingsGroup>
        </div>
        {guestClass === "regular" && (
          <p className="text-muted-foreground type-body mt-3" data-class-regular-note="">
            VIP is added by Mesita when you come through a partner.
          </p>
        )}
      </div>
    </LocalSheet>
  );
}
