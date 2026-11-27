import { z } from "zod";

import { callEdge } from "@/lib/edge";

export type Visit = {
  id: string;
  place: string;
  status: string;
  currency: string;
  bill: string | null;
  credit: string;
  cash: string;
  tip: string;
  paidAt: string | null;
  testMode: boolean;
};

const money = (cents: number, currency: string) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });

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
          card_tip_cents: z.number().catch(0),
          paid_at: z.string().nullish().catch(null),
          test_mode: z.boolean().catch(false),
          place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
        })
        .nullish()
        .catch(null),
    }),
    { signal },
  ).then((answer) => {
    const tab = answer.tab;
    if (!tab) return null;
    const tip = tab.cash_tip_cents + tab.card_tip_cents;
    return {
      id: tab.tab_id,
      place: tab.place?.name ?? "A Mesita place",
      status: tab.status,
      currency: tab.currency,
      bill: tab.bill_cents == null ? null : money(tab.bill_cents, tab.currency),
      credit: money(tab.credit_cents, tab.currency),
      cash: money(tab.cash_bill_cents + tab.cash_tip_cents, tab.currency),
      tip: money(tip, tab.currency),
      paidAt: tab.paid_at ?? null,
      testMode: tab.test_mode,
    };
  });
}
