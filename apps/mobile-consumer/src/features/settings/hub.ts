import { z } from "zod";

import { callEdge } from "@/lib/edge";

export type Ticket = { id: string; place: string; status: string; amount: string | null };

const money = (cents: number | null, currency: string) =>
  cents == null ? null : `${(cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() })}`;

export function listTickets(signal?: AbortSignal): Promise<Ticket[]> {
  return callEdge(
    "consumer-web-list-visits",
    {},
    z.object({
      visits: z
        .array(
          z.object({
            tab_id: z.string(),
            status: z.string().catch(""),
            currency: z.string().catch("mxn"),
            bill_cents: z.number().nullish().catch(null),
            place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) =>
    answer.visits.map((row) => ({
      id: row.tab_id,
      place: row.place?.name ?? "A Mesita place",
      status: row.status,
      amount: money(row.bill_cents ?? null, row.currency),
    })),
  );
}

export type SavedCard = { id: string; brand: string; last4: string; exp: string };

export function listCards(signal?: AbortSignal): Promise<{ cards: SavedCard[]; testMode: boolean }> {
  return callEdge(
    "consumer-web-list-cards",
    {},
    z.object({
      test_mode: z.boolean().catch(false),
      cards: z
        .array(
          z.object({
            id: z.string(),
            brand: z.string().catch("card"),
            last4: z.string().catch(""),
            exp_month: z.number().catch(0),
            exp_year: z.number().catch(0),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) => ({
    testMode: answer.test_mode,
    cards: answer.cards.map((card) => ({
      id: card.id,
      brand: card.brand,
      last4: card.last4,
      exp: card.exp_month && card.exp_year ? `${card.exp_month}/${card.exp_year}` : "",
    })),
  }));
}

export type Plan = { name: string; used: number; cap: number; price: string };

export function getPlan(signal?: AbortSignal): Promise<Plan> {
  return callEdge(
    "consumer-web-get-plan",
    { light: true },
    z.object({
      plan: z.enum(["free", "premium"]).catch("free"),
      used: z.number().catch(0),
      cap: z.number().catch(0),
      price_cents: z.number().catch(0),
      currency: z.string().catch("usd"),
    }),
    { signal },
  ).then((row) => ({
    name: row.plan === "premium" ? "Pro" : "Free",
    used: row.used,
    cap: row.cap,
    price: money(row.price_cents, row.currency) ?? "",
  }));
}
