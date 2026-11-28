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

export type Ticket = { id: string; place: string; photo: string | null; status: string; mark: string; headline: string; amount: string | null };

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
            tip_cents: z.number().nullish().catch(null),
            place: z.object({
              name: z.string().nullish().catch(null),
              photo_url: z.string().nullish().catch(null),
            }).nullish().catch(null),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) =>
    answer.visits.map((row) => {
      const tip = row.tip_cents ?? 0;
      const total = row.bill_cents == null ? null : (row.bill_cents + tip);
      const open = row.status === "waiting_bill" || row.status === "billed" || row.status === "paying";
      const mark = row.status === "waiting_bill" ? "Open" : row.status === "billed" ? "Billed" : row.status === "paying" ? "Paying" : "";
      return {
        id: row.tab_id,
        place: row.place?.name ?? "A Mesita place",
        photo: row.place?.photo_url ?? null,
        status: row.status,
        mark,
        headline: total == null ? (open ? "Waiting for the bill" : "") : (money(total, row.currency) ?? ""),
        amount: money(row.bill_cents ?? null, row.currency),
      };
    }),
  );
}

export type SavedCard = { id: string; brand: string; last4: string; exp: string; inUse: boolean; expired: boolean };

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
            in_use: z.boolean().catch(false),
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
      exp: card.exp_month && card.exp_year ? `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year % 100).padStart(2, "0")}` : "",
      inUse: card.in_use,
      expired: card.exp_month > 0 && card.exp_year > 0 && new Date(card.exp_year, card.exp_month, 0).getTime() < Date.now(),
    })),
  }));
}

export function removeCard(id: string): Promise<void> {
  return callEdge("consumer-web-remove-card", { payment_method_id: id }, z.object({}).passthrough(), { mutation: true }).then(
    () => undefined,
  );
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
    price: row.price_cents % 100 === 0 ? `$${row.price_cents / 100}` : `$${(row.price_cents / 100).toFixed(2)}`,
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

export type WalletLine = { id: string; place: string; placeId: string; entryKey: string; line: string };

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
        place_id: z.string().catch(""),
        place: z.object({ id: z.string().nullish().catch(null), name: z.string().nullish().catch(null) }).nullish().catch(null),
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
        const placeId = balance.place_id || balance.place?.id || "";
        vouchers.push({
          id: `${placeId}-${entry.kind}-${entry.at}-${index}`,
          place: balance.place?.name ?? "A Mesita place",
          placeId,
          entryKey: `${entry.kind}.${Date.parse(entry.at)}`,
          line: `${entry.pending ? "Pending" : "Available"} · ${amount}`,
        });
      });
    }
    const gifts = answer.gifts.map((gift) => ({
      id: gift.gift_id,
      place: gift.place?.name ?? "A Mesita place",
      placeId: "",
      entryKey: "",
      line: `${gift.role === "sender" ? "Sent" : "Received"} · ${gift.status} · ${money(gift.amount_cents, gift.currency) ?? ""} · ${gift.sender.name}`,
    }));
    return { vouchers, gifts };
  });
}

export type InstagramChannel = { channel: "dm"; account: string; link: string } | { channel: "off" };

export function instagramChannel(signal?: AbortSignal): Promise<InstagramChannel> {
  return callEdge(
    "consumer-web-claim-instagram",
    { action: "channel" },
    z.object({ channel: z.enum(["dm", "off"]).catch("off"), account: z.string().optional(), link: z.string().optional() }),
    { signal },
  ).then((row) => (row.channel === "dm" && row.account && row.link ? { channel: "dm", account: row.account, link: row.link } : { channel: "off" }));
}

export type InstagramClaim = { code: string; handle: string; account: string; link: string };

export function startInstagramDm(vipCheck: boolean): Promise<InstagramClaim> {
  return callEdge(
    "consumer-web-claim-instagram",
    { action: "start_dm", vipCheck },
    z.object({ code: z.string(), handle: z.string().catch(""), account: z.string(), link: z.string().catch("") }),
    { mutation: true },
  );
}

export type InstagramDmStatus = {
  status: "pending" | "wrong_account" | "expired" | "none";
  handle: string | null;
  provedAt: string | null;
};

export function instagramDmStatus(signal?: AbortSignal): Promise<InstagramDmStatus> {
  return callEdge(
    "consumer-web-claim-instagram",
    { action: "dm_status" },
    z.object({
      status: z.enum(["pending", "wrong_account", "expired", "none"]).catch("none"),
      handle: z.string().nullish().catch(null),
      provedAt: z.string().nullish().catch(null),
    }),
    { signal },
  ).then((row) => ({ status: row.status, handle: row.handle ?? null, provedAt: row.provedAt ?? null }));
}

export function disconnectInstagram(): Promise<void> {
  return callEdge("consumer-web-claim-instagram", { action: "disconnect" }, z.object({}).passthrough(), { mutation: true }).then(() => undefined);
}

export function instagramVipLine(status: string | null, followers: number | null): string | null {
  const count = typeof followers === "number" ? `${followers.toLocaleString("en-US")} followers. ` : "";
  if (status === "eligible") return "Your Instagram made you VIP.";
  if (status === "not_enough") return `${count}VIP needs more than 5,000.`;
  if (status === "not_public") return `${count}Your account is private; VIP needs a public one.`;
  if (status === "unconfirmed") return `${count}Instagram didn't confirm your account is public.`;
  return null;
}
