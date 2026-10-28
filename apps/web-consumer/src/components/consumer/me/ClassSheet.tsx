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

import { useState } from "react";
import { Crown, UsersRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  CLASS_ROWS,
  type ClassRowWords,
} from "@/components/consumer/me/class-words";
import { PerkList } from "@/components/consumer/me/perk-list";
import {
  formatVipUntil,
  type GuestClass,
  type VipDetails,
} from "@/lib/guest-standing";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { apiJoinClass } from "@/lib/api/profile";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import {
  CurrentPill,
  IconChip,
  ME_BUTTON_CLASS,
  RowDivider,
  SettingsGroup,
} from "./settings-rows";

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
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {title}
          {mine && <CurrentPill data-class-mine="" />}
        </span>
        <span className="text-muted-foreground type-label block">
          {subtitle}
        </span>
        {mine && vip?.partner && (
          <span
            className="text-foreground type-label block"
            data-class-vip-partner=""
          >
            Through {vip.partner}.
          </span>
        )}
        {mine && vip?.until && (
          <span
            className="text-foreground type-label block"
            data-class-vip-until=""
          >
            Until {formatVipUntil(vip.until)}.
          </span>
        )}
        {perks && <PerkList label={perks.label} items={perks.items} />}
      </div>
    </div>
  );
}

/** Joining VIP with a partner's 12-digit code (MESITA-2984), on /me/class
 *  only: the header's Class sheet stays read-only. EMULATED on the server —
 *  any 12 digits are accepted until partners issue real codes. A full
 *  reload lands the new class everywhere (the header's chip included). */
function JoinVip() {
  const getSupabase = useLazyBrowserSupabase();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = code.replace(/\D/g, "");
  const ready = digits.length === 12;

  async function join() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await apiJoinClass(getSupabase(), digits);
      toast.success("Welcome to VIP");
      window.location.reload();
    } catch (e) {
      toast(errMsg(e, "Couldn't join VIP — try again."));
      setBusy(false);
    }
  }

  return (
    <div className="mt-6" data-class-regular-note="">
      <SettingsGroup title="Join VIP">
        <form
          className="px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <p className="text-muted-foreground type-label">
            Enter the 12-digit code from your partner.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="0000 0000 0000"
            aria-label="12-digit VIP code"
            maxLength={16}
            className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-3 h-11 w-full rounded-xl border px-5 text-center font-mono text-sm tracking-widest outline-none"
            data-class-join-code
          />
          <Button
            type="submit"
            size="sm"
            disabled={!ready || busy}
            className={cn(ME_BUTTON_CLASS, "mt-2 w-full")}
            data-class-join
          >
            {busy && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            Join
          </Button>
        </form>
      </SettingsGroup>
    </div>
  );
}

/** Both classes, the guest's marked. Null (the read failed) marks neither and
 *  offers no join: never a guessed Regular. `joinable` is the page's: a
 *  Regular guest gets the code form under the card (MESITA-2984); the sheet
 *  keeps the plain line. */
export function ClassList({
  guestClass,
  vip = null,
  joinable = false,
}: {
  guestClass: GuestClass | null;
  vip?: VipDetails | null;
  joinable?: boolean;
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
      {guestClass === "regular" && joinable && <JoinVip />}
      {guestClass === "regular" && !joinable && (
        <p
          className="text-muted-foreground type-label mt-3"
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
