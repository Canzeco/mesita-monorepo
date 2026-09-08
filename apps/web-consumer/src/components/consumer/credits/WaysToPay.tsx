"use client";

import { useState } from "react";
import { Banknote, ChevronDown, CreditCard, Smartphone, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

// The ways to settle a bill, said once (Pato, 2026-09-08: "sí vamos a hacer una
// lista de Ways to Pay, pero explanatory").
//
// FOUR, NOT THREE (Pato, 2026-09-08: "btw in fact four ways to pay. 1. Cash
// 2. Card 3. Mesita Online Payments 4. Mesita Credits Payments").
//
// The old list said Cash · Cards · Credits, and "Cards" was doing two jobs at
// once: the card a guest hands to the place, and the card MESITA charges on
// their behalf. Those are not one tender. They differ in who takes the money,
// who holds the risk, and which button appears in THE TICKET — checkout has
// treated them as two rails since MESITA-1414:
//
//   Cash                     → `at_place`   the place is paid, no PSP
//   Card                     → `at_place`   the place is paid, their terminal
//   Mesita Online Payments   → `mesita_pay` Stripe direct charge on the org's
//                                           connected account, confirmed here
//   Mesita Credits Payments  → a bill REDUCTION, not a settlement at all
//
// SO THE LIST IS GROUPED BY WHO TAKES THE MONEY, which is the only split a
// guest can act on — "do I need cash on me" is answered by the first group and
// nothing else. It is also the grouping `StepPay` already uses at the moment of
// payment, so the wallet teaches the screen the guest meets later.
//
// ── NAMES ALWAYS, PROSE ON REQUEST (MESITA-1708) ────────────────────────────
//
// This block shipped fully expanded and Pato's reply was "better desiggn. wtf
// is that". He was right, and the failure was measurable rather than a matter
// of taste: four icon-tile-plus-two-lines rows made it the tallest thing on the
// screen, above the two panels that actually do something, and at 390×844 it
// CLIPPED MID-ROW — the first thing a guest saw was a sentence cut in half.
//
// The fix is not to hide it again (it was conditional once, and Pato's wireframe
// deliberately drew it above a wallet that has balances). It is to separate the
// two jobs this block was doing at once:
//
//   · NAMING the four tenders — the whole point of MESITA-1696, and now four
//     chips that always render, cost one line, and cannot clip.
//   · EXPLAINING them — a paragraph each, which a guest reads once and never
//     again, and which now sits behind a press.
//
// STILL COPY, NOT A MENU. The disclosure toggles text; the chips are not
// pressable and route nowhere. The two panels underneath remain the only place
// anything is done.
//
// CREDITS IS NOT A PEER OF THE OTHER THREE, and the copy must not imply it is.
// `20260831121954_credits_rename.sql` freezes it: "Credits settle as a bill
// REDUCTION never a payment method, applying only to (subtotal - discount),
// never the tip." A guest told Credits is a way to PAY will expect a MX$2,000
// balance to cover a MX$1,800 bill plus tip, and it will not.
//
// THE TAGS ARE THE LIVENESS, and they are honest. Mesita Online Payments needs
// `places.mesita_pay_enabled` ∧ `visits_config.payCard` ∧ Connect readiness,
// all three false in production today. Credits BALANCES became real in
// MESITA-1674, which deleted the "Emulated" footer this screen used to carry —
// but SPENDING them did not: StepPay still renders its Credits row `soon`, so
// "Soon" here is the only place the wallet says that tender is not live.
//
// NO APPLE PAY OR GOOGLE PAY IN THIS COPY. Neither is built.

type Way = {
  Icon: typeof Banknote;
  /** The chip label. Short enough that four fit two rows at 390px. */
  chip: string;
  title: string;
  line: string;
  /** Renders beside the title when the tender is not universally available. */
  tag?: string;
};

const AT_THE_PLACE: Way[] = [
  {
    Icon: Banknote,
    chip: "Cash",
    title: "Cash",
    line: "Hand it over at the table, the way you always have.",
  },
  {
    Icon: CreditCard,
    chip: "Card",
    title: "Card",
    line: "Your own card on the place’s terminal. Mesita is not in the middle.",
  },
];

const THROUGH_MESITA: Way[] = [
  {
    Icon: Smartphone,
    chip: "Online",
    title: "Mesita Online Payments",
    line: "Settle from a saved card inside the app — nothing to hand over.",
    tag: "At places that accept it",
  },
  {
    Icon: Coins,
    chip: "Credits",
    title: "Mesita Credits Payments",
    line: "Prepay a place for more than you paid. Reduces your bill, never the tip.",
    tag: "Soon",
  },
];

const ALL: Way[] = [...AT_THE_PLACE, ...THROUGH_MESITA];

/** The always-visible half. Four names, one line, no clipping possible.
 *  Not buttons — nothing here is pressable, and a chip that looks tappable and
 *  is not is the "control that cannot be pressed is decoration" mistake this
 *  codebase already made once with the Gift tile. */
function Chips() {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ALL.map(({ Icon, chip, tag }) => (
        <li
          key={chip}
          className={cn(
            "bg-muted type-label flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold",
            tag === "Soon" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <Icon className="size-3" aria-hidden />
          {chip}
          {tag === "Soon" ? (
            <span className="text-muted-foreground/80 type-meta">soon</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The two-word uppercase rule above each pair. It says who ends up with the
 *  money, which is the only difference between the pairs a guest can feel. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground type-meta font-bold tracking-[0.12em] uppercase">
      {children}
    </span>
  );
}

function WayRows({ ways }: { ways: Way[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-3">
      {ways.map(({ Icon, title, line, tag }) => (
        <li key={title} className="flex items-start gap-3">
          <span className="bg-muted text-muted-foreground mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-xs leading-tight font-bold">{title}</span>
              {tag ? (
                <span className="bg-muted text-muted-foreground type-meta rounded-full px-1.5 py-0.5 font-semibold">
                  {tag}
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground type-label mt-0.5 block leading-snug">
              {line}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The body of the Ways to pay panel. The box, the title and the padding are
 *  `WalletPanel`'s — this block owns only the list, so all three Wallet
 *  sections wear one chrome. */
export function WaysToPay() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Chips />

      {/* A real button with aria-expanded, not a styled div: this is the one
          pressable thing in the block and it must read as one. 44px tall
          including its own padding — the touch floor. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground type-label -mx-1 flex items-center gap-1 rounded-lg px-1 py-2.5 text-left font-semibold transition"
      >
        {open ? "Hide" : "How each one works"}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 pb-1">
          <div>
            <GroupLabel>At the place</GroupLabel>
            <WayRows ways={AT_THE_PLACE} />
          </div>
          <div>
            <GroupLabel>Through Mesita</GroupLabel>
            <WayRows ways={THROUGH_MESITA} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
