"use client";

import { Instagram, KeyRound, TriangleAlert } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { ClassLadder } from "@/components/consumer/me/class/ClassLadder";
import { ClassPreviewToggle } from "@/components/consumer/me/demo/ClassPreviewToggle";
import { ClassOriginSummary } from "@/components/consumer/me/class/ClassOriginSummary";
import { useConsumerClass } from "@/lib/class-context";
import { CLASS_MARK_ICON } from "@/lib/consumer-data";
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
  onRedeemInvite,
}: {
  open: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
  onRedeemInvite: () => void;
}) {
  const {
    origin,
    followers,
    key: classKey,
    handle,
    unknown,
  } = useConsumerClass();

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your class">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <CLASS_MARK_ICON className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your class</h2>
            <p className="text-muted-foreground text-xs">
              Followers lift you automatically. An invite is by hand.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Demo state is declared before the surface it changes — same box,
              same position, on all three Me sheets that can fake an identity. */}
          <ClassPreviewToggle />

          {/* THE ONE THING THIS SHEET MUST NEVER GUESS. When the profile read
              throws, the class context falls back to the floor — so without
              this the sheet told a Diamond guest they were Bronze, in a
              filled card, with aria-current asserting it to screen readers.
              It fails closed on permissions (the floor grants nothing) but
              WRONG on information, and information is all this screen
              renders. The ladder below still draws all four rungs, because
              what the classes ARE stays true; it just stops claiming one of
              them is yours. */}
          {unknown && (
            <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-4">
              <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <TriangleAlert className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm leading-none font-bold tracking-tight">
                  Couldn&apos;t load your class
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                  Your class is safe — we just couldn&apos;t read it right now.
                  Reopen this sheet to try again.
                </p>
              </div>
            </div>
          )}

          {/* Names the door that granted this rung, ABOVE the ladder
              (decision: Pato, 2026-08-22): the sheet reads Emulator · Reason ·
              Ladder · Buttons — how you got here before where you stand. The
              cost is a conditional slot (a plain Bronze has no origin box);
              the guard against the card reading as a fifth rung is spacing —
              16px between blocks vs 8px inside the ladder — plus its larger
              tile and third line.
              Renders for BOTH doors — it was gated on `origin ===
              "instagram"`, so an invited guest saw a Diamond row wearing a
              follower bar they never cleared and no word of how they got
              there (MESITA-1159). */}
          {/* Hidden while the class is unknown: naming the door that granted
              a rung we never read would be a second guess on top of the
              first. */}
          {!unknown && (
            <ClassOriginSummary
              origin={origin}
              classKey={classKey}
              followers={followers}
              handle={handle}
            />
          )}

          <ClassLadder />

          {/* THE TWO WAYS IN, and there are only two (decision: Pato):
              followers, automatic — and an invitation, manual. Always both,
              always in this order: Instagram left, invitation right.
              SYMMETRICAL BY NAME, not just by shape — "Join with Instagram" /
              "Join with Invitation". The right one used to read "I have a
              PIN", which described the guest's inventory rather than the
              door, and so read as a lesser fallback beside a real CTA. Two
              doors, two verbs, same verb.
              Neither is a purchase; money buys a PLAN, at /subscribe/premium.
              They never gate on current class, so the footer can't change
              shape under the guest. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onConnectInstagram}
              className="bg-foreground text-background type-body flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl px-2 font-semibold transition active:scale-[0.99]"
            >
              <Instagram className="h-4 w-4 shrink-0" />
              <span className="truncate">Join with Instagram</span>
            </button>
            {/* Was a toast that said invitations are by hand and then did
                nothing. There is a real door now (MESITA-1168): Mesita hands a
                partner a batch of PINs, the partner gives them out, the holder
                redeems one here. */}
            <button
              type="button"
              onClick={onRedeemInvite}
              className="border-border bg-card hover:bg-muted type-body flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border px-2 font-semibold transition active:scale-[0.99]"
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span className="truncate">Join with Invitation</span>
            </button>
          </div>
        </div>
      </div>
    </LocalSheet>
  );
}
