"use client";

import { Instagram, Mail } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { ClassLadder } from "@/components/consumer/me/class/ClassLadder";
import { ClassPreviewToggle } from "@/components/consumer/me/class/ClassPreviewToggle";
import { InstagramConnectedSummary } from "@/components/consumer/me/class/InstagramConnectedSummary";
import { useConsumerClass } from "@/lib/class-context";
import { CLASS_MARK_ICON } from "@/lib/consumer-data";
import { toast } from "@/lib/toast";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";

// The class surface (decision: Pato, MESITA-1124) — header, one ladder, two
// buttons. That is the whole screen.
//
// TWO BUTTONS, BECAUSE THERE ARE TWO DOORS. The old screen gave every rung its
// own card and therefore its own CTA, which forced "Join with Instagram" to
// render TWICE (Silver and Gold share one Instagram claim, banded by follower
// count) and gave Bronze a dead "Included" note. Four cards, two real doors.
// Lifting the actions out of the ladder makes the count honest.
//
// NO COLOUR BUT THE CLASS. Every accent this sheet used to carry — the pink
// header mark, the pink primary button, the emerald "current class" and
// "unlocked" ticks, the amber demo chip, the four-colour discount meters — is
// gone. A metal is now the only coloured thing a guest can see here, so it
// cannot be mistaken for decoration.

export function ClassModal({
  open,
  onClose,
  onConnectInstagram,
}: {
  open: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
}) {
  const { origin, followers } = useConsumerClass();

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your class">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <CLASS_MARK_ICON className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your class</h2>
            <p className="text-muted-foreground text-[12px]">
              Reach or get invited — your discount climbs with you.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ClassLadder />

          {origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}

          {/* The only two doors up the ladder, ALWAYS BOTH, always in this
              order: Instagram left, invite right (decision: Pato). Neither is
              a purchase — money buys a PLAN, and that lives at
              /subscribe/premium. They never gate on current class: a guest who
              already holds one door can still see the other, and a fixed pair
              means the sheet's footer never changes shape under them. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onConnectInstagram}
              className="bg-foreground text-background flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl px-2 text-[13px] font-semibold transition active:scale-[0.99]"
            >
              <Instagram className="h-4 w-4 shrink-0" />
              <span className="truncate">Join with Instagram</span>
            </button>
            <button
              type="button"
              onClick={() =>
                toast(
                  "Invitation requests open soon — Mesita curates the Aura list personally.",
                )
              }
              className="border-border bg-card hover:bg-muted flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border px-2 text-[13px] font-semibold transition active:scale-[0.99]"
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">Request invite</span>
            </button>
          </div>

          <ClassPreviewToggle />
        </div>
      </div>
    </LocalSheet>
  );
}
