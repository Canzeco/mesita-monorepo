"use client";

// Mesita Payments — this place's own Stripe Connect account.
//
// ── THE ONE THING THIS SCREEN EXISTS TO GET RIGHT ──────────────────────────
//
// Stripe sets `disabled_reason` on an account AT CREATION. A brand-new account
// that nobody has touched and an account Stripe has shut down report the same
// field, so a console that reads "disabled" and says "disabled" tells a venue
// on its first morning that it has been rejected. The rungs below are ordered
// so the console asks "has onboarding finished?" BEFORE it asks "is anything
// wrong?", and the two ends of the ladder never wear the same words.
//
// The dashboard link is the other trap: there is no Stripe Express dashboard
// until the account is enabled, so offering one earlier is a link to a 404 at
// the exact moment an owner is least willing to believe the product works.
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { PAY_LADDER_LABEL, type PayLadder } from "@/mock/types";
import {
  CTA_BUTTON_CLASS,
  GHOST_PILL_BUTTON_CLASS,
  INFO_BOX_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const RUNGS: Array<{
  id: PayLadder;
  title: string;
  body: string;
  tone: "neutral" | "warn" | "good" | "bad";
  verb: string | null;
  dashboard: boolean;
}> = [
  {
    id: "never",
    title: "Not set up",
    body: "No Stripe account for this place yet. Setting one up takes about ten minutes and asks for the legal entity, a bank account and an ID.",
    tone: "neutral",
    verb: "Set up payments",
    dashboard: false,
  },
  {
    id: "started",
    title: "Setup unfinished",
    body: "Stripe has the account and is still missing something. Picking up where you left off does not restart anything you already sent.",
    tone: "warn",
    verb: "Finish setup",
    dashboard: false,
  },
  {
    id: "pending",
    title: "In review",
    body: "Everything is submitted. Stripe reviews most accounts within a day, and there is nothing to do until it answers — a second submission does not make it faster.",
    tone: "warn",
    verb: null,
    dashboard: false,
  },
  {
    id: "enabled",
    title: "On",
    body: "Charges and payouts are live. Guests can pay by card on visits and orders, and money lands on your own Stripe schedule.",
    tone: "good",
    verb: null,
    dashboard: true,
  },
  {
    id: "restricted",
    title: "Restricted",
    body: "Stripe has paused this account after it was working. It is asking for something specific — the dashboard says what, and nothing on Mesita's side can clear it.",
    tone: "bad",
    verb: "Open Stripe",
    dashboard: true,
  },
];

export function PayView() {
  const place = useHeldPlace();
  const search = useSearchParams();
  const returned = search.get("connect");
  const rung = RUNGS.find((r) => r.id === place.pay)!;

  return (
    <div className="flex flex-col gap-4">
      {/* STRIPE'S STORED RETURN. The link's `return_url` was written when the
          link was minted, so an owner can arrive here from a page they opened
          weeks ago. Saying nothing would leave them wondering whether the eight
          minutes they just spent counted. */}
      {returned && (
        <div className={INFO_BOX_CLASS} role="status">
          You came back from Stripe. What it told us is below — if it still says
          unfinished, Stripe is usually a minute behind.
        </div>
      )}

      <Section
        title="This place's Stripe account"
        description="Each place has its own. Stripe has no account merge, so one account cannot be split across two venues later."
        right={<Badge tone={rung.tone}>{PAY_LADDER_LABEL[rung.id]}</Badge>}
        lane
      >
        <p className="text-[13px] leading-relaxed">{rung.body}</p>
        <div className="flex flex-wrap gap-2">
          {rung.verb && (
            <button type="button" className={CTA_BUTTON_CLASS}>
              {rung.verb}
            </button>
          )}
          {rung.dashboard ? (
            <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
              Stripe dashboard
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            // NOT A DISABLED BUTTON. There is no dashboard to open yet, and a
            // greyed control says "you may not" where the truth is "it does not
            // exist".
            <p className="text-muted-foreground self-center text-[12px]">
              The Stripe dashboard appears once the account is enabled.
            </p>
          )}
          <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Re-check with Stripe
          </button>
        </div>
      </Section>

      <Section
        title="The ladder"
        description="Where this place sits, and what each rung means. Day zero and a shutdown are different facts and never wear the same words."
      >
        <ol className="flex flex-col gap-2">
          {RUNGS.map((r) => {
            const here = r.id === place.pay;
            return (
              <li
                key={r.id}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  here ? "border-foreground bg-foreground/[0.03]" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className={TINY_LABEL_CLASS}>{r.title}</p>
                  {here && <Badge tone={r.tone}>You are here</Badge>}
                </div>
                <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">{r.body}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Payouts" description="Mesita never holds the money. It moves from the guest to this place's Stripe account.">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          {place.pay === "enabled"
            ? "Payouts follow the schedule set on your Stripe account, not one Mesita chooses. A dispute is Stripe's to resolve and shows up on their dashboard first."
            : "Nothing has been paid out for this place, because nothing can be charged yet."}
        </p>
      </Section>
    </div>
  );
}
