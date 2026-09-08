"use client";

import { Banknote, CreditCard, Smartphone, Coins } from "lucide-react";

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
// treated them as two rails since MESITA-1414, and the wallet was the only
// surface still pretending otherwise:
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
// payment ("At the register" / "Mesita Pay" / "Your Credits"), so the wallet
// now teaches the screen the guest meets later instead of a different shape.
//
// IT IS COPY, NOT A MENU. No chevrons, no handlers, nothing to press. The two
// panels underneath are where anything is actually done; this one answers the
// question a guest has exactly once: what can I pay with here.
//
// IT NO LONGER LEAVES. It used to render only while the guest held zero
// Credits — read once, then gone. Pato's wireframe draws it above a wallet that
// has balances, and permanently: a guest who prepaid one place has if anything
// MORE need of the line that says the other three tenders still exist. The
// worry it was hidden for — furniture above the number the guest opened the app
// to see — is paid for by keeping the rows tight, not by deleting the block on
// the day it starts being true.
//
// CREDITS IS NOT A PEER OF THE OTHER THREE, and the copy must not imply it is.
// `20260831121954_credits_rename.sql` freezes it: "Credits settle as a bill
// REDUCTION never a payment method, applying only to (subtotal - discount),
// never the tip." A guest told Credits is a way to PAY will expect a MX$2,000
// balance to cover a MX$1,800 bill plus tip, and it will not — tips go 100% to
// the place on a separate rail, computed pre-discount. So the Credits line says
// what it does to a bill rather than claiming to settle one.
//
// THE TAGS ARE THE LIVENESS, and they are honest. Mesita Online Payments is
// built but per-place: it needs `places.mesita_pay_enabled` ∧
// `visits_config.payCard` ∧ Connect charge-readiness, all three false in
// production today, so the row says where it works rather than that it works.
// Credits BALANCES became real in MESITA-1674, which deleted the "Emulated"
// footer this screen used to carry — but SPENDING them did not: StepPay still
// renders its Credits row `soon`. The "Soon" tag is now the only place the
// wallet says the tender is not live, so it does not get tidied away.
//
// NO APPLE PAY OR GOOGLE PAY IN THIS COPY. Neither is built — there is no
// Stripe wallet button anywhere in this app — and naming them here would be
// the screen promising a rail that does not exist.

type Way = {
  Icon: typeof Banknote;
  title: string;
  line: string;
  /** Renders beside the title when the tender is not universally available. */
  tag?: string;
};

const AT_THE_PLACE: Way[] = [
  {
    Icon: Banknote,
    title: "Cash",
    line: "Hand it over at the table, the way you always have.",
  },
  {
    Icon: CreditCard,
    title: "Card",
    line: "Your own card on the place’s terminal. Mesita is not in the middle.",
  },
];

const THROUGH_MESITA: Way[] = [
  {
    Icon: Smartphone,
    title: "Mesita Online Payments",
    line: "Settle from a saved card inside the app — nothing to hand over.",
    tag: "At places that accept it",
  },
  {
    Icon: Coins,
    title: "Mesita Credits Payments",
    line: "Prepay a place for more than you paid. Reduces your bill, never the tip.",
    tag: "Soon",
  },
];

/** The two-word uppercase rule above each pair. It says who ends up with the
 *  money, which is the only difference between the pairs that a guest can feel. */
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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <GroupLabel>At the place</GroupLabel>
        <WayRows ways={AT_THE_PLACE} />
      </div>
      <div>
        <GroupLabel>Through Mesita</GroupLabel>
        <WayRows ways={THROUGH_MESITA} />
      </div>
    </div>
  );
}
