"use client";

import { Banknote, CreditCard, Coins } from "lucide-react";

// The three ways to settle, said once (Pato, 2026-09-08: "sí vamos a hacer una
// lista de Ways to Pay, pero explanatory").
//
// IT IS COPY, NOT A MENU. No chevrons, no handlers, nothing to press. The two
// rows underneath it are where you actually do anything, and this block exists
// to answer the question a guest has exactly once: what can I pay with here.
//
// SO IT LEAVES WHEN IT HAS BEEN READ. It renders only while the guest holds no
// Credits. This codebase has already killed one block for being unpressable —
// "a control that cannot be pressed is decoration, not discovery" (the Gift
// tile) — and a block that can neither be pressed nor dismissed is worse:
// permanent furniture above the number the guest opened the app to see. Once
// there is a balance, the Credits section speaks for itself.
//
// CREDITS IS NOT A PEER OF THE OTHER TWO, and the copy must not imply it is.
// `20260831121954_credits_rename.sql` freezes it: "Credits settle as a bill
// REDUCTION never a payment method, applying only to (subtotal - discount),
// never the tip." A guest told Credits is a way to PAY will expect a MX$2,000
// balance to cover a MX$1,800 bill plus tip, and it will not — tips go 100% to
// the place on a separate rail, computed pre-discount. So the Credits line says
// what it does to a bill rather than claiming to settle one.
//
// NO APPLE PAY OR GOOGLE PAY IN THIS COPY. Neither is built — there is no
// Stripe wallet button anywhere in this app — and naming them here would be
// the screen promising a rail that does not exist.

const WAYS = [
  {
    Icon: Banknote,
    title: "Cash",
    line: "Pay the place directly, however they charge.",
  },
  {
    Icon: CreditCard,
    title: "Cards",
    line: "A saved card. Stripe holds it, never Mesita.",
  },
  {
    Icon: Coins,
    title: "Credits",
    line: "Prepay a place for more than you paid. Reduces your bill, never the tip.",
  },
];

export function WaysToPay() {
  return (
    <section aria-label="Ways to pay" className="flex flex-col gap-2.5">
      <h2 className="text-muted-foreground type-label font-semibold">
        Ways to pay
      </h2>
      <ul className="border-border bg-card flex flex-col gap-3 rounded-2xl border px-4 py-3.5">
        {WAYS.map(({ Icon, title, line }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="bg-muted text-muted-foreground mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-tight font-bold">
                {title}
              </span>
              <span className="text-muted-foreground type-label mt-0.5 block leading-snug">
                {line}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
