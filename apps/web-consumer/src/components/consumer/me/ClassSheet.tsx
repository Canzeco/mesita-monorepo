"use client";

// Class — partnership status, Regular or VIP (Pato, MESITA-2553). One body,
// two frames: this sheet, opened by the Class chip on the guest's own card
// (Me's header), and the /me/class page behind Me's Class tile (MESITA-2562,
// ClassModal). On Social the chip is a plain fact and opens nothing.
//
// CLASS IS NOT PLAN. VIP is never bought and never an upgrade. This sheet
// never names a plan, and the Plan page never names Class or VIP. The rows'
// words live in class-words.ts, which /me/class' fallback reads too
// (MESITA-2701).
//
// CLASS IS AUTOMATIC (MESITA-3850): VIP is a verified Instagram with more
// than 5,000 followers, computed by the database (consumers.guest_class is a
// generated column). The sheet only explains the rule: no button, no code,
// no join or leave (consumer-web-join-class is retired). The header's Class
// chip shows the guest's own class.

import { Crown, UsersRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  CLASS_LEAD,
  CLASS_ROWS,
  type ClassRowWords,
} from "@/components/consumer/me/class-words";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { IconChip, MeLead, RowDivider, SettingsGroup } from "./settings-rows";

function ClassRow({
  title,
  icon,
  subtitle,
  soon,
}: ClassRowWords & { icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" data-class-row={title}>
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {title}
          {soon && <SoonPill />}
        </span>
        <span className="text-muted-foreground type-label block">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

/** Beside a class nobody can be in yet (MESITA-3027): PerkList's Soon. */
function SoonPill() {
  return (
    <span
      className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold"
      data-class-soon=""
    >
      Soon
    </span>
  );
}

/** What a class is for, then both classes. */
export function ClassList() {
  return (
    <>
      <MeLead>{CLASS_LEAD}</MeLead>
      <SettingsGroup>
        <ClassRow
          {...CLASS_ROWS.regular}
          icon={<UsersRound className="h-[18px] w-[18px]" />}
        />
        <RowDivider />
        <ClassRow
          {...CLASS_ROWS.vip}
          icon={<Crown className="h-[18px] w-[18px]" />}
        />
      </SettingsGroup>
    </>
  );
}

export function ClassSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Class">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Class</h2>
        <div className="mt-3">
          <ClassList />
        </div>
      </div>
    </LocalSheet>
  );
}
