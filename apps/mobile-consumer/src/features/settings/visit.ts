import { z } from "zod";

import { moneyLabel } from "@/generated/shared/lib/money";
import { callEdge } from "@/lib/edge";

export type Visit = {
  id: string;
  placeId: string | null;
  place: string;
  status: string;
  currency: string;
  bill: string | null;
  billCents: number | null;
  credit: string;
  creditCents: number;
  card: string;
  cardCents: number;
  cash: string;
  cashCents: number;
  tip: string;
  tipCents: number;
  suggestedTip: string | null;
  total: string;
  paidAt: string | null;
  waiter: string | null;
  ticket: string | null;
  guestTyped: boolean;
  verified: boolean;
  testMode: boolean;
  openedAt: string | null;
  billedAt: string | null;
  payingAt: string | null;
};

/** One visit, the same read the web ticket uses. */
export function getVisit(id: string, signal?: AbortSignal): Promise<Visit | null> {
  return callEdge(
    "consumer-web-get-tab",
    { tab_id: id },
    z.object({
      tab: z
        .object({
          tab_id: z.string(),
          status: z.string().catch(""),
          currency: z.string().catch("mxn"),
          bill_cents: z.number().nullish().catch(null),
          credit_cents: z.number().catch(0),
          cash_bill_cents: z.number().catch(0),
          cash_tip_cents: z.number().catch(0),
          card_bill_cents: z.number().catch(0),
          card_tip_cents: z.number().catch(0),
          tip_suggested_cents: z.number().nullish().catch(null),
          paid_at: z.string().nullish().catch(null),
          created_at: z.string().nullish().catch(null),
          billed_at: z.string().nullish().catch(null),
          paying_at: z.string().nullish().catch(null),
          verified_at: z.string().nullish().catch(null),
          waiter_name: z.string().nullish().catch(null),
          ticket: z.string().nullish().catch(null),
          origin: z.string().nullish().catch(null),
          test_mode: z.boolean().catch(false),
          place: z.object({ id: z.string().nullish().catch(null), name: z.string().nullish().catch(null) }).nullish().catch(null),
        })
        .nullish()
        .catch(null),
    }),
    { signal },
  ).then((answer) => {
    const tab = answer.tab;
    if (!tab) return null;
    const tip = tab.cash_tip_cents + tab.card_tip_cents;
    const card = tab.card_bill_cents + tab.card_tip_cents;
    const cash = tab.cash_bill_cents + tab.cash_tip_cents;
    const chosen = tab.credit_cents + cash + card;
    const total = chosen > 0 ? chosen : (tab.bill_cents ?? 0);
    return {
      id: tab.tab_id,
      placeId: tab.place?.id ?? null,
      place: tab.place?.name ?? "A Mesita place",
      status: tab.status,
      currency: tab.currency,
      bill: tab.bill_cents == null ? null : moneyLabel(tab.bill_cents, tab.currency),
      billCents: tab.bill_cents ?? null,
      credit: moneyLabel(tab.credit_cents, tab.currency),
      creditCents: tab.credit_cents,
      card: moneyLabel(card, tab.currency),
      cardCents: card,
      cash: moneyLabel(cash, tab.currency),
      cashCents: cash,
      tip: moneyLabel(tip, tab.currency),
      tipCents: tip,
      suggestedTip: tab.tip_suggested_cents && tab.tip_suggested_cents !== tip ? moneyLabel(tab.tip_suggested_cents, tab.currency) : null,
      total: moneyLabel(total, tab.currency),
      paidAt: tab.paid_at ?? null,
      waiter: tab.waiter_name ?? null,
      ticket: tab.ticket ?? null,
      guestTyped: tab.origin === "guest",
      verified: tab.verified_at != null,
      testMode: tab.test_mode,
      openedAt: tab.created_at ?? null,
      billedAt: tab.billed_at ?? null,
      payingAt: tab.paying_at ?? null,
    };
  });
}
