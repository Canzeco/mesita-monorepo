import { z } from "zod";

import { callEdge } from "@/lib/edge";

import type { PayPlace } from "./places";
import type { BillTyping, GuestBill } from "./visit";

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

const quoteSchema = z
  .object({
    outside_cents: z.number(),
    discount_bps: z.number().catch(0),
    discount_cents: z.number().catch(0),
    credit_cents: z.number().catch(0),
    cashback_bps: z.number().catch(0),
    cashback_cents: z.number().catch(0),
    cashback_capped: z.boolean().optional().catch(undefined),
  })
  .nullish()
  .catch(null);

const billSchema = z
  .object({
    id: z.string(),
    state: z.string(),
    version: z.number().catch(0),
    currency: z.string().catch("usd"),
    bill_cents: z.number().nullish().catch(null),
    tip_cents: z.number().catch(0),
    expires_at: z.string().catch(""),
    attempt_id: z.string().nullish().catch(null),
    waiter_ready: z.boolean().optional().catch(undefined),
    took_cents: z.number().nullish().catch(null),
    place: z
      .object({
        id: z.string().nullish().catch(null),
        name: z.string().nullish().catch(null),
        photo_url: z.string().nullish().catch(null),
      })
      .catch({ id: null, name: null, photo_url: null }),
    quote: quoteSchema,
  })
  .transform(
    (bill): GuestBill => ({
      id: bill.id,
      state: bill.state,
      version: bill.version,
      currency: bill.currency,
      billCents: bill.bill_cents ?? null,
      tipCents: bill.tip_cents,
      expiresAt: bill.expires_at,
      attemptId: bill.attempt_id ?? null,
      waiterReady: bill.waiter_ready === true,
      tookCents: bill.took_cents ?? null,
      place: { id: bill.place.id ?? null, name: bill.place.name ?? null, photo: bill.place.photo_url ?? null },
      quote: bill.quote
        ? {
            outsideCents: bill.quote.outside_cents,
            discountBps: bill.quote.discount_bps,
            discountCents: bill.quote.discount_cents,
            creditCents: bill.quote.credit_cents,
            cashbackBps: bill.quote.cashback_bps,
            cashbackCents: bill.quote.cashback_cents,
            cashbackCapped: bill.quote.cashback_capped,
          }
        : null,
    }),
  );

const typingSchema = z
  .object({
    bill_cents: z.number().catch(0),
    tip_cents: z.number().catch(0),
    step: z.enum(["bill", "tip", "code"]),
  })
  .transform((row): BillTyping => ({ billCents: row.bill_cents, tipCents: row.tip_cents, step: row.step }))
  .nullish()
  .catch(null);

export type PayCode = { url: string; expiresAt: string };
export type PayCodeRead = { code: PayCode | null; bill: GuestBill | null; typing: BillTyping | null; closed: boolean };

export function readPayCode(
  args: { placeId?: string; billId?: string; mint?: boolean },
  signal?: AbortSignal,
): Promise<PayCodeRead> {
  const body: Record<string, string | boolean> = {};
  if (args.mint) body.mint = true;
  if (args.placeId) body.place_id = args.placeId;
  if (args.billId) body.bill_id = args.billId;
  return callEdge(
    "consumer-web-get-pay-code",
    body,
    z.object({
      code: z.object({ url: z.string(), expires_at: z.string() }).nullish().catch(null),
      bill: billSchema.nullish().catch(null),
      typing: typingSchema,
      closed: z.boolean().optional().catch(false),
    }),
    { signal },
  ).then((answer) => ({
    code: answer.code ? { url: answer.code.url, expiresAt: answer.code.expires_at } : null,
    bill: answer.bill ?? null,
    typing: answer.typing ?? null,
    closed: answer.closed === true,
  }));
}

export function answerBill(
  billId: string,
  action: "accept" | "decline" | "not_mine" | "cancel",
  version?: number,
): Promise<void> {
  const body: Record<string, string | number> = { bill_id: billId, action };
  if (version !== undefined && (action === "accept" || action === "decline")) body.version = version;
  return callEdge("consumer-web-answer-bill", body, z.object({ outcome: z.string().optional() }).passthrough(), {
    mutation: true,
  }).then(() => undefined);
}

export function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
