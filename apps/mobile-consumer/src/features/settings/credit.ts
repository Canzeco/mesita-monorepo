import { z } from "zod";

import { callEdge } from "@/lib/edge";

const entrySchema = z.object({
  kind: z.string().catch(""),
  amount_cents: z.number().catch(0),
  at: z.string().catch(""),
  pending: z.boolean().catch(false),
  available_at: z.string().nullish().catch(null),
  purchase_id: z.string().nullish().catch(null),
  payment_id: z.string().nullish().catch(null),
  refunded_cents: z.number().nullish().catch(null),
  reason: z.string().nullish().catch(null),
});

type Entry = z.infer<typeof entrySchema>;

const BOUGHT = new Set(["prepay", "voucher"]);

const LABEL: Record<string, string> = {
  prepay: "Prepaid",
  voucher: "Voucher",
  bonus: "Bonus",
  cashback: "Cashback",
  story: "Instagram Story credit",
  spend: "Paid",
  reversal: "Refund",
  refund: "Refund",
  gift_out: "Sent to a friend",
  gift_in: "From a friend",
  gift_back: "Taken back",
};

export type Credit = {
  place: string;
  placeId: string;
  headline: string;
  state: string;
  when: string;
  note: string | null;
  testMode: boolean;
  bought: string | null;
  bonus: string | null;
  totalCredit: string | null;
  type: string | null;
  refund: string | null;
  refundWhen: string | null;
  available: string;
  pending: string | null;
  spendable: string;
  purchase: string | null;
  canPay: boolean;
  canGift: boolean;
  bonusStep: { pay: string; waiting: boolean; bonus: string; ready: string | null } | null;
};

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

function dated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function labelOf(entry: Entry): string {
  if (entry.kind === "reversal") {
    if (entry.purchase_id) return "Purchase refunded";
    if (entry.payment_id) return "Credit taken back";
    return "Refund";
  }
  return LABEL[entry.kind] ?? entry.kind;
}

function stateOf(entry: Entry, refund: Entry | undefined): string {
  if (entry.kind === "reversal") return `Refunded ${dated(entry.at)}`;
  if (refund) return `Refunded ${dated(refund.at)}`;
  if (entry.kind === "gift_out") return entry.pending ? "Sent · pending" : "Sent";
  if (entry.kind === "gift_back") return "Back in your balance";
  if (entry.kind === "gift_in") {
    return entry.pending ? (entry.available_at ? `Pending · Available on ${dated(entry.available_at)}` : "Pending") : "Received";
  }
  if (entry.pending) return entry.available_at ? `Pending · available ${dated(entry.available_at)}` : "Pending";
  return "Available";
}

/** One credit line, the same wallet read the web ticket uses. */
export function getCredit(placeId: string, entryKey: string, signal?: AbortSignal): Promise<Credit | null> {
  return callEdge(
    "consumer-web-get-wallet",
    {},
    z.object({
      test_mode: z.boolean().catch(false),
      can_send: z.boolean().catch(false),
      balances: z.array(z.object({
        place_id: z.string().catch(""),
        currency: z.string().catch("mxn"),
        available_cents: z.number().catch(0),
        pending_cents: z.number().catch(0),
        spendable_cents: z.number().catch(0),
        place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
        entries: z.array(entrySchema).catch([]),
      })).catch([]),
    }),
    { signal },
  ).then((wallet) => {
    const [kind, ms] = entryKey.split(".");
    const balance = wallet.balances.find((row) => row.place_id === placeId);
    const entry = balance?.entries
      .filter((row) => row.kind === kind && String(Date.parse(row.at)) === ms)
      .sort((a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents))[0];
    if (!balance || !entry) return null;
    const currency = balance.currency;
    const amount = Math.abs(entry.amount_cents);
    const bought = BOUGHT.has(entry.kind);
    const bonus = bought
      ? balance.entries.find((row) => row.kind === "bonus" && (entry.purchase_id ? row.purchase_id === entry.purchase_id : row.at === entry.at))
      : undefined;
    const refund = bought && entry.purchase_id
      ? balance.entries
          .filter((row) => row.kind === "reversal" && row.purchase_id === entry.purchase_id)
          .sort((a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents))[0]
      : undefined;
    const out = entry.kind === "gift_out" || entry.kind === "reversal";
    const received = entry.kind === "gift_in";
    const given = entry.kind === "gift_out" || entry.kind === "gift_back";
    const place = balance.place?.name ?? "A Mesita place";
    const headline = out
      ? `−${money(amount, currency)}`
      : (bought && !refund) || entry.kind === "bonus" || entry.kind === "gift_in"
        ? `+${money(amount, currency)}`
        : money(amount, currency);
    const note = received
      ? `A friend sent you credit at ${place}.`
      : given
        ? entry.kind === "gift_back"
          ? `You took back ${money(amount, currency)} you had sent. It is in your balance at ${place}.`
          : `You sent ${money(amount, currency)} of your credit at ${place} to a friend.`
        : null;
    return {
      place,
      placeId,
      headline,
      state: stateOf(entry, refund),
      when: when(entry.at),
      note,
      testMode: wallet.test_mode,
      bought: bought ? money(amount, currency) : null,
      bonus: bonus ? `+${money(bonus.amount_cents, currency)}` : null,
      totalCredit: bought && bonus ? money(amount + bonus.amount_cents, currency) : null,
      type: bought || received || given ? null : labelOf(entry),
      refund: refund ? money(refund.refunded_cents ?? Math.abs(refund.amount_cents), currency) : null,
      refundWhen: refund ? when(refund.at) : null,
      available: money(balance.available_cents, currency),
      pending: balance.pending_cents > 0 ? money(balance.pending_cents, currency) : null,
      spendable: money(balance.spendable_cents, currency),
      purchase: entry.purchase_id ? entry.purchase_id.slice(0, 8).toUpperCase() : null,
      canPay: !given && balance.spendable_cents > 0,
      canGift: wallet.can_send && balance.spendable_cents > 0,
      bonusStep: bought && bonus && !refund
        ? {
            pay: money(amount, currency),
            waiting: entry.pending || bonus.pending,
            bonus: `+${money(bonus.amount_cents, currency)}`,
            ready: bonus.pending && bonus.available_at ? bonus.available_at : null,
          }
        : null,
    };
  });
}
