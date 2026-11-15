// THE TICKET ROWS (MESITA-4001, moved out of MeLists unchanged): every
// visit, payment, voucher, gift and refund as the row Me › Tickets draws.
// A PLAIN MODULE ON PURPOSE: no React, so the rows and their signs are
// pinned by src/lib/__tests__/ticket-rows.test.ts. MeLists builds the
// reservation rows and draws them all.

import { ENTRY_LABEL, money, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import type { GuestVisit } from "@/lib/api/tab";
import {
  payReceiptPath,
  payTabPath,
  creditEntryPath,
  visitPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import type { TicketKind } from "@/lib/ticket-kinds";
import type {
  ActivityItem,
  StatusTone,
} from "@/components/consumer/activity/ActivityRow";

/** A list of tickets: Reservations, or one kind of ticket. */
export type ListType = "reservations" | TicketKind;

/** One ticket and where it sorts: Upcoming soonest first, then Past newest
 *  first. */
export type Row = ActivityItem & {
  type: ListType;
  at: string | null;
  upcoming: boolean;
  paymentId?: string | null;
  /** A payment's facts in a few words, for the Visit card it paid. */
  payNote?: string | null;
};

export const join = (...parts: Array<string | null | false | undefined>) =>
  parts.filter(Boolean).join(" · ");

// ─── Visits ─────────────────────────────────────────────────────────────────

const VISIT_PILL: Record<string, [string, StatusTone]> = {
  waiting_bill: ["Open", "ink"],
  billed: ["Billed", "ink"],
  paying: ["Paying", "ink"],
  paid: ["Paid", "green"],
};

/** `notes`: each payment's few words by its id, written on the Visit it
 *  paid (MESITA-3697: the payment lives on its Visit's card). */
/** A bill still open: the live pay screen, Tickets' "Open now" card, and
 *  the red dot on Me's Tickets box (MESITA-3885). */
export function isOpenVisit(v: Pick<GuestVisit, "status">): boolean {
  return (
    v.status === "waiting_bill" ||
    v.status === "billed" ||
    v.status === "paying"
  );
}

/** A visit is a ticket once money moved (MESITA-3997, Pato: "after payment
 *  process, else don't create the ticket"): paid, and signed when the guest
 *  paid it themselves. A waiter's bill still open stays too: nothing else
 *  reaches it. A cancelled or expired bill, and the guest's own bill waiting
 *  for the signature (Pay and the amber row hold it), are not tickets. */
export function isTicketVisit(v: Pick<GuestVisit, "status" | "origin" | "verified_at">): boolean {
  if (v.status === "paid") return v.origin !== "guest" || !!v.verified_at;
  return isOpenVisit(v) && v.origin !== "guest";
}

export function visitRows(visits: GuestVisit[], notes: Map<string, string>): Row[] {
  return visits.filter(isTicketVisit).map((v) => {
    const [label, tone] = VISIT_PILL[v.status] ?? [
      v.status,
      "grey" as StatusTone,
    ];
    const open = isOpenVisit(v);
    const at = v.paid_at ?? v.created_at;
    const total =
      v.bill_cents != null
        ? money(v.bill_cents + v.tip_cents, v.currency)
        : null;
    // An open bill is the live pay screen; a finished one is its one-page
    // summary (MESITA-3770: "the live workflow and the output must be
    // different").
    const href = open ? payTabPath(v.tab_id) : visitPath(v.tab_id);
    return {
      key: `v-${v.tab_id}`,
      type: "visits",
      at,
      upcoming: open,
      place: v.place.name ?? "A Mesita place",
      photo: v.place.photo_url,
      status: { label, tone },
      big: total ?? "Waiting for the bill",
      money: total != null,
      line: join(
        open && "Started",
        ...v.part_payment_ids.map((id) => notes.get(id)),
        v.waiter_name,
        v.ticket && `Ticket ${v.ticket}`,
      ),
      href,
      action: open
        ? { label: total ? "Continue paying" : "Open", href }
        : undefined,
    };
  });
}

// ─── The wallet: payments, vouchers, gifts ───────────────────────────────

// IN OR OUT (MESITA-3941): every gift entry lands on one side. Received is
// In; Sent and Taken back (the sender undid a link nobody claimed) are Out.
const GIFT_PILL: Record<
  string,
  [string, StatusTone, "gifts-in" | "gifts-out"]
> = {
  gift_out: ["Sent", "ink", "gifts-out"],
  gift_in: ["Received", "green", "gifts-in"],
  gift_back: ["Taken back", "ink", "gifts-out"],
};
const BOUGHT_KINDS = new Set(["prepay", "voucher"]);
const sum = (es: WalletEntry[]) => es.reduce((n, e) => n + e.amount_cents, 0);

export function walletRows(w: Wallet): Row[] {
  const out: Row[] = [];
  for (const b of w.balances) {
    const place = b.place?.name ?? "A Mesita place";
    const photo = b.place?.photo ?? null;
    const cur = b.currency;
    const href = walletPlacePath(b.place_id);
    const byPayment = new Map<string, WalletEntry[]>();
    const bonuses = b.entries.filter((e) => e.kind === "bonus");
    const usedBonus = new Set<WalletEntry>();

    b.entries.forEach((e, i) => {
      if (
        e.payment_id &&
        (e.kind === "spend" || e.kind === "cashback" || e.kind === "reversal")
      ) {
        const g = byPayment.get(e.payment_id) ?? [];
        g.push(e);
        byPayment.set(e.payment_id, g);
        return;
      }
      if (e.kind === "spend" || e.kind === "cashback") {
        // An entry from before payments had ids: no receipt to open.
        out.push(
          paymentRow(
            `p-${b.place_id}-${e.at}-${i}`,
            place,
            photo,
            cur,
            [e],
            null,
            href,
          ),
        );
        return;
      }
      if (BOUGHT_KINDS.has(e.kind)) {
        const bonus = bonuses.find((x) => !usedBonus.has(x) && x.at === e.at);
        if (bonus) usedBonus.add(bonus);
        const pending = e.pending || !!bonus?.pending;
        out.push({
          key: `b-${b.place_id}-${e.at}-${i}`,
          type: "vouchers",
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: pending
            ? { label: "Pending", tone: "ink" }
            : { label: "Available", tone: "green" },
          big: money(e.amount_cents, cur),
          money: true,
          line: join(
            ENTRY_LABEL[e.kind] ?? e.kind,
            bonus && `+${money(bonus.amount_cents, cur)} bonus`,
          ),
          href: creditEntryPath(b.place_id, e),
        });
        return;
      }
      if (e.kind === "reversal") {
        // A purchase refunded (no payment id): a Refund ticket (MESITA-3855;
        // it sat under Vouchers until then).
        out.push({
          key: `rv-${b.place_id}-${e.at}-${i}`,
          type: "refunds",
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: { label: "Refunded", tone: "grey" },
          big: money(Math.abs(e.amount_cents), cur),
          money: true,
          line: "Purchase refunded",
          href: creditEntryPath(b.place_id, e),
        });
        return;
      }
      const gift = GIFT_PILL[e.kind];
      if (gift) {
        out.push({
          key: `g-${b.place_id}-${e.at}-${i}`,
          type: gift[2],
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: { label: gift[0], tone: gift[1] },
          big: money(Math.abs(e.amount_cents), cur),
          money: true,
          line: join(e.pending && "pending"),
          href: creditEntryPath(b.place_id, e),
        });
      }
    });

    // A bonus with no purchase beside it is its own prepayment ticket.
    for (const [i, e] of bonuses.entries()) {
      if (usedBonus.has(e)) continue;
      out.push({
        key: `bo-${b.place_id}-${e.at}-${i}`,
        type: "vouchers",
        at: e.at,
        upcoming: false,
        place,
        photo,
        status: e.pending
          ? { label: "Pending", tone: "ink" }
          : { label: "Available", tone: "green" },
        big: money(e.amount_cents, cur),
        money: true,
        line: "Bonus",
        href: creditEntryPath(b.place_id, e),
      });
    }

    for (const [id, g] of byPayment)
      out.push(
        paymentRow(`p-${id}`, place, photo, cur, g, id, payReceiptPath(id)),
      );
  }

  // A Story voucher paid, waiting for the post (MESITA-3507).
  for (const s of w.waiting_stories ?? []) {
    out.push({
      key: `s-${s.purchase_id}`,
      type: "vouchers",
      at: s.paid_at,
      upcoming: false,
      place: s.place?.name ?? "A Mesita place",
      photo: s.place?.photo ?? null,
      status: { label: "Waiting", tone: "ink" },
      big: money(s.credit_cents, s.currency),
      money: true,
      line: "Story voucher · waiting for your post",
      href: walletPlacePath(s.place_id),
    });
  }

  // A credit link sent that nobody took yet (MESITA-3292).
  const places = new Map(w.balances.map((b) => [b.place_id, b.place]));
  for (const l of w.sent_links ?? []) {
    const p = places.get(l.place_id);
    out.push({
      key: `gl-${l.gift_id}`,
      type: "gifts-out",
      at: l.created_at,
      upcoming: false,
      place: p?.name ?? "A Mesita place",
      photo: p?.photo ?? null,
      status: { label: "Not taken", tone: "ink" },
      big: money(l.amount_cents, l.currency),
      money: true,
      line: "Link sent",
      href: walletPlacePath(l.place_id),
    });
  }
  return out;
}

/** One payment: the credits it used is the big fact; with none, the cashback
 *  it earned; with neither, "Paid in cash". A refund on it is a field and
 *  the state. */
export function paymentRow(
  key: string,
  place: string,
  photo: string | null,
  cur: string,
  g: WalletEntry[],
  paymentId: string | null,
  href: string,
): Row {
  const spend = g.filter((e) => e.kind === "spend");
  const cashback = g.filter((e) => e.kind === "cashback");
  const refund = g.filter((e) => e.kind === "reversal");
  const at = g.map((e) => e.at).sort()[0]!;
  const cash = cashback.some((e) => e.confirmed_by === "waiter");
  const back = sum(cashback);
  const big = spend.length
    ? money(Math.abs(sum(spend)), cur)
    : back
      ? `+${money(back, cur)} cashback`
      : "Paid in cash";
  return {
    key,
    type: "visits",
    paymentId,
    payNote:
      join(
        spend.length > 0 && `${money(Math.abs(sum(spend)), cur)} in credits`,
        back ? `+${money(back, cur)} cashback` : null,
        refund.length > 0 && `${money(Math.abs(sum(refund)), cur)} refunded`,
      ) || null,
    at,
    upcoming: false,
    place,
    photo,
    status: refund.length
      ? { label: "Refunded", tone: "grey" }
      : { label: "Paid", tone: "green" },
    big,
    money: true,
    line: join(
      cash ? "Cash" : spend.length ? "Credits" : null,
      spend.length && back ? `+${money(back, cur)} cashback` : null,
      refund.length > 0 && `${money(Math.abs(sum(refund)), cur)} refunded`,
      g.some((e) => e.pending) && "pending",
    ),
    href,
  };
}
