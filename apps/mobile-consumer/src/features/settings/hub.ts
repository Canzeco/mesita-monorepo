import { z } from "zod";

import { callEdge } from "@/lib/edge";

export const FEEDBACK_MAX = 1000;

/** Words about the app itself. The server stores them. */
export function sendFeedback(note: string): Promise<void> {
  return callEdge("consumer-web-send-feedback", { note: note.trim() }, z.object({}), { mutation: true }).then(() => undefined);
}

export type Refund = { id: string; place: string; amount: string; when: string };

const money = (cents: number | null, currency: string) =>
  cents == null ? null : `${(cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() })}`;

/** Money the server says went back to the card. */
export function listRefunds(signal?: AbortSignal): Promise<Refund[]> {
  return callEdge(
    "consumer-web-get-wallet",
    {},
    z.object({
      balances: z.array(z.object({
        place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
        currency: z.string().catch("mxn"),
        entries: z.array(z.object({
          kind: z.string().catch(""),
          amount_cents: z.number().catch(0),
          at: z.string().catch(""),
          refunded_cents: z.number().nullish().catch(null),
        })).catch([]),
      })).catch([]),
    }),
    { signal },
  ).then((answer) => {
    const rows: Refund[] = [];
    for (const balance of answer.balances) {
      balance.entries.forEach((entry, index) => {
        if (entry.kind !== "reversal" && entry.kind !== "refund") return;
        const cents = entry.refunded_cents ?? Math.abs(entry.amount_cents);
        rows.push({
          id: `${balance.place?.name ?? "place"}-${entry.at}-${index}`,
          place: balance.place?.name ?? "A Mesita place",
          amount: money(cents, balance.currency) ?? "",
          when: entry.at,
        });
      });
    }
    return rows;
  });
}

export type Ticket = { id: string; place: string; status: string; amount: string | null };

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

export function redeemVipCode(code: string): Promise<"joined" | "already_vip"> {
  return callEdge(
    "consumer-web-redeem-vip-code",
    { code },
    z.object({ outcome: z.enum(["joined", "already_vip"]) }),
    { mutation: true },
  ).then((row) => row.outcome);
}

export function setInstagramHandle(handle: string): Promise<void> {
  return callEdge("consumer-web-claim-instagram", { action: "set", handle }, z.object({ handle: z.string() }), {
    mutation: true,
  }).then(() => undefined);
}

export type WalletLine = { id: string; place: string; line: string };

const BOUGHT = new Set(["prepay", "voucher", "bonus"]);

export function listVoucherTickets(signal?: AbortSignal): Promise<WalletLine[]> {
  return walletLines(signal).then((rows) => rows.vouchers);
}

export function listGiftTickets(signal?: AbortSignal): Promise<WalletLine[]> {
  return walletLines(signal).then((rows) => rows.gifts);
}

function walletLines(signal?: AbortSignal): Promise<{ vouchers: WalletLine[]; gifts: WalletLine[] }> {
  return callEdge(
    "consumer-web-get-wallet",
    {},
    z.object({
      balances: z.array(z.object({
        place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
        currency: z.string().catch("mxn"),
        entries: z.array(z.object({
          kind: z.string().catch(""),
          amount_cents: z.number().catch(0),
          at: z.string().catch(""),
          pending: z.boolean().catch(false),
        })).catch([]),
      })).catch([]),
      gifts: z.array(z.object({
        gift_id: z.string(),
        amount_cents: z.number().catch(0),
        currency: z.string().catch("mxn"),
        status: z.string().catch(""),
        role: z.string().catch(""),
        place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
        sender: z.object({ name: z.string().catch("") }).catch({ name: "" }),
      })).catch([]),
    }),
    { signal },
  ).then((answer) => {
    const vouchers: WalletLine[] = [];
    for (const balance of answer.balances) {
      balance.entries.forEach((entry, index) => {
        if (!BOUGHT.has(entry.kind)) return;
        const amount = money(Math.abs(entry.amount_cents), balance.currency) ?? "";
        vouchers.push({
          id: `${entry.at}-${index}`,
          place: balance.place?.name ?? "A Mesita place",
          line: `${entry.pending ? "Pending" : "Available"} · ${amount}`,
        });
      });
    }
    const gifts = answer.gifts.map((gift) => ({
      id: gift.gift_id,
      place: gift.place?.name ?? "A Mesita place",
      line: `${gift.role === "sender" ? "Sent" : "Received"} · ${gift.status} · ${money(gift.amount_cents, gift.currency) ?? ""} · ${gift.sender.name}`,
    }));
    return { vouchers, gifts };
  });
}

export function startInstagramDm(): Promise<{ code: string; account: string }> {
  return callEdge(
    "consumer-web-claim-instagram",
    { action: "start_dm", vipCheck: false },
    z.object({ code: z.string(), account: z.string() }),
    { mutation: true },
  );
}
