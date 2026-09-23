"use client";

import Link from "next/link";
import { BadgeCheck, Gem, KeyRound, Mail, TriangleAlert } from "lucide-react";

import { DiamondEmulator } from "@/components/consumer/me/demo/DiamondEmulator";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { useConsumerClass } from "@/lib/class-context";
import {
  DIAMOND_LIST,
  DIAMOND_LIST_REQUEST_BODY,
  DIAMOND_LIST_RATE_HINT,
  diamondHeadline,
  diamondNote,
} from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { MESITA_INSTAGRAM_HANDLE, MESITA_INSTAGRAM_URL, MESITA_SUPPORT_EMAIL } from "@/lib/mesita-contact";
import { cn } from "@/lib/utils";

// THE DIAMOND LIST, AND NOTHING ELSE ON THIS PAGE (Pato, MESITA-2040: "either
// you are diamond or you are not"; MESITA-2044: "its more like a List. Diamond
// List. you are in the list or you don't, not in between"). The name is always
// both words; "You're Diamond" was a status noun off the ladder.
//
// WHAT THIS REPLACES. `ClassModal` was a ladder of four rungs with two doors
// under it — "Join with Instagram" on the left, "Join with Invitation" on the
// right. Both doors led up the SAME axis, which is why they had to sit side by
// side and why the copy above them had to explain that one was automatic and
// one was by hand. Instagram has its own page now and grants nothing here, so
// the left button is gone and the two that remain are both invitation doors:
// ask for one, or redeem one you were given.
//
// THE LADDER'S THREE COMPONENTS WENT WITH IT. `ClassLadder` drew four rungs;
// `ClassOriginSummary` named which door granted your rung; `ClassPreviewToggle`
// was a four-way segmented control. All three existed to answer "which rung,
// and how" — a question a boolean cannot ask. Their tests (class-naming-drift,
// class-unknown-state) are replaced by diamond-state.test.tsx, which pins the
// one distinction that survives: a fact we READ versus a fact we could not.
//
// THE UNKNOWN BRANCH IS NOT OPTIONAL, and it is the same lesson the ladder
// paid for (MESITA design review 2026-08-22). When the profile read throws,
// the context falls back to the floor — so without this a guest on the list
// is told they are not, which is not a degraded answer but a wrong
// one. The doors below still render, because HOW Diamond is granted stays
// true whatever we managed to read.
//
// REQUESTING IS A REAL LINE, NOT A QUEUE (decision, MESITA-2040). "you can
// request invitation" could mean a row in a table and an admin queue; that is
// a table, an Edge Function and an admin surface, and none of it exists yet.
// What ships is the line that already exists and that someone actually reads:
// support mail, with the member's own words, and Mesita's Instagram beside it.
// A button that silently wrote a row nobody triages would be worse than the
// toast the invite door used to fire.

export function DiamondModal() {
  const { facts } = useConsumerClass();
  const { diamond, unknown } = facts;

  const requestHref = `mailto:${MESITA_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `${DIAMOND_LIST} request`,
  )}&body=${encodeURIComponent(DIAMOND_LIST_REQUEST_BODY)}`;

  return (
    <MeScreen title="Diamond List">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Gem className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-muted-foreground text-xs">
          {DIAMOND_LIST_RATE_HINT}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Demo state is declared before the surface it changes — same box,
            same position, on every Me page that can fake an account. */}
        <DiamondEmulator />

        {unknown ? (
          <div className="border-border bg-card flex items-start gap-3 rounded-2xl border p-4">
            <span className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm leading-none font-bold tracking-tight">
                Couldn&apos;t read your invitation
              </p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                Nothing changed on your account — we just couldn&apos;t read it
                right now. Come back to this page to try again.
              </p>
            </div>
          </div>
        ) : (
          /* THE STATUS CARD IS THE WHOLE ANSWER. The ladder needed a row per
             rung plus a marked current one; a boolean needs one card that
             says which of two things is true. It is FILLED when the guest
             is on the list and outlined when they are not — the same
             "the one coloured thing means the fact" rule the metals were
             under (MESITA-1132), with one metal left to spend it on. */
          <div
            className={cn(
              "flex items-center gap-3.5 rounded-2xl p-4",
              diamond
                ? "shadow-rest bg-tier-diamond text-paper"
                : "border-border bg-card border",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                diamond ? "bg-white/20" : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              <Gem className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm leading-none font-bold tracking-tight">
                  {diamondHeadline(facts)}
                </span>
                {diamond ? (
                  <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-1.5 text-xs leading-snug",
                  diamond ? "text-paper/85" : "text-muted-foreground",
                )}
              >
                {diamondNote(facts)}
              </p>
            </div>
          </div>
        )}

        {/* TWO DOORS, AND BOTH ARE THE SAME DOOR FROM DIFFERENT SIDES: ask
            Mesita, or redeem what Mesita already handed someone. They never
            gate on whether the guest is on the list — a guest on it loses
            nothing by reading them, and hiding them would make the page blank
            for the people it is written for. */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={requestHref}
            className="bg-foreground text-paper type-body flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl px-2 font-semibold transition active:scale-[0.99]"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Ask to join</span>
          </a>
          {/* The KEY is the invitation door's glyph everywhere (Pato,
              2026-08-22) — lucide's Ticket collides with THE TICKET, the
              visit object. */}
          <Link
            href={CONSUMER_ROUTES.mePages.diamondInvite}
            className="border-border bg-card hover:bg-muted type-body flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border px-2 font-semibold transition active:scale-[0.99]"
          >
            <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">I have a PIN</span>
          </Link>
        </div>

        <p className="text-muted-foreground type-body text-center leading-snug">
          Invitations come from Mesita and its partners. You can also ask us on
          Instagram at{" "}
          <a
            href={MESITA_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-semibold underline underline-offset-4"
          >
            {MESITA_INSTAGRAM_HANDLE}
          </a>
          .
        </p>
      </div>
    </MeScreen>
  );
}
