import { z } from "zod";

import { callEdge } from "@/lib/edge";

import type { PayPlace } from "./places";

const offers = z
  .object({
    sell: z.array(z.string()).catch([]),
    visit_mechanism: z.enum(["discount", "cashback"]).optional().catch(undefined),
    welcome_pct: z.number().nullish().catch(null),
    welcome_vip_pct: z.number().nullish().catch(null),
    returning_pct: z.number().nullish().catch(null),
    returning_vip_pct: z.number().nullish().catch(null),
    voucher_pct: z.record(z.string(), z.number()).optional().catch(undefined),
  })
  .catch({ sell: [] });

const placeSchema = z
  .object({
    place_id: z.string(),
    name: z.string().nullish().catch(null),
    photo: z.string().nullish().catch(null),
    distance_m: z.number().nullish().catch(null),
    credits_ok: z.boolean().optional().catch(undefined),
    offers_ok: z.boolean().optional().catch(undefined),
    offers: offers.nullish().catch(null),
    visit_line: z.enum(["welcome", "welcome_vip", "returning", "returning_vip"]).optional().catch(undefined),
  })
  .transform(
    (row): PayPlace => ({
      place_id: row.place_id,
      name: row.name ?? null,
      photo: row.photo ?? null,
      distance_m: row.distance_m ?? null,
      credits_ok: row.credits_ok,
      offers_ok: row.offers_ok,
      offers: row.offers ?? null,
      visit_line: row.visit_line,
    }),
  );

const balanceSchema = z.object({
  place_id: z.string(),
  currency: z.string().catch("usd"),
  spendable_cents: z.number().catch(0),
  place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
});

export type Credit = { placeId: string; name: string; currency: string; spendableCents: number };

export function listPayPlaces(at: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<PayPlace[]> {
  return callEdge(
    "consumer-web-list-pay-places",
    at ? { lat: at.lat, lng: at.lng } : {},
    z.object({ places: z.array(placeSchema).catch([]) }),
    { signal },
  ).then((answer) => answer.places);
}

export function listCredits(signal?: AbortSignal): Promise<Credit[]> {
  return callEdge(
    "consumer-web-get-wallet",
    {},
    z.object({ balances: z.array(balanceSchema).catch([]) }),
    { signal },
  ).then((answer) =>
    answer.balances.map((row) => ({
      placeId: row.place_id,
      name: row.place?.name ?? "A Mesita place",
      currency: row.currency,
      spendableCents: row.spendable_cents,
    })),
  );
}

const billSchema = z.object({
  id: z.string(),
  state: z.string(),
  version: z.number().catch(0),
  currency: z.string().catch("usd"),
  bill_cents: z.number().nullish().catch(null),
  tip_cents: z.number().catch(0),
  expires_at: z.string().catch(""),
  place: z.object({ name: z.string().nullish().catch(null) }).catch({ name: null }),
  quote: z
    .object({ outside_cents: z.number().catch(0) })
    .nullish()
    .catch(null),
});

export type GuestBill = z.infer<typeof billSchema>;
export type PayCode = { url: string; expiresAt: string };

const codeAnswer = z.object({
  code: z
    .object({ url: z.string(), expires_at: z.string() })
    .nullish()
    .catch(null),
  bill: billSchema.nullish().catch(null),
});

export type PayCodeRead = { code: PayCode | null; bill: GuestBill | null };

export function readPayCode(placeId: string, signal?: AbortSignal): Promise<PayCodeRead> {
  return callEdge("consumer-web-get-pay-code", { mint: true, place_id: placeId }, codeAnswer, { signal }).then((answer) => ({
    code: answer.code ? { url: answer.code.url, expiresAt: answer.code.expires_at } : null,
    bill: answer.bill ?? null,
  }));
}

export function answerBill(billId: string, action: "accept" | "decline" | "not_mine", version: number): Promise<void> {
  return callEdge(
    "consumer-web-answer-bill",
    { bill_id: billId, action, version },
    z.object({ outcome: z.string().optional() }).passthrough(),
    { mutation: true },
  ).then(() => undefined);
}

export function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
