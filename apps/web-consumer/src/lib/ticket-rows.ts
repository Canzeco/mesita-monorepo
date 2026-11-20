// THE TICKET ROWS (MESITA-4001, moved out of MeLists unchanged): every
// visit, payment, voucher, gift and refund as the row Me › Tickets draws.
// A PLAIN MODULE ON PURPOSE: no React, so the rows and their signs are
// pinned by src/lib/__tests__/ticket-rows.test.ts. MeLists builds the
// reservation rows and draws them all.

import { ENTRY_LABEL, money, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import type { GuestVisit } from "@/lib/api/tab";
import {
  payReceiptPath,
  payBillPath,
  creditEntryPath,
  visitPath,
  storyTicketPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import type { TicketKind } from "@/lib/ticket-kinds";
import { storyBonusOpen, storyLine } from "@/lib/story-lines";
import type {
  ActivityItem,
  StatusTone,
  TicketRowKind,
} from "@/components/consumer/activity/ActivityRow";

/** A list of tickets: Reservations, or one kind of ticket. */
/** Refunds are a list of their own in Settings since MESITA-4402, not a
 *  ticket kind; their rows are still read here. */
export type ListType = "reservations" | TicketKind | "refunds";

/** One ticket and where it sorts: Upcoming soonest first, then Past newest
 *  first. */
export type Row = ActivityItem & {
  type: ListType;
  at: string | null;
  upcoming: boolean;
  paymentId?: string | null;
  /** A payment's money in cents, for the Visit it paid (MESITA-4001). */
  payFacts?: PayFacts | null;
};

/** What one payment moved in the guest's credit, in cents (all positive):
 *  credits spent, legacy extra credit it earned (`extra`, nothing new writes
 *  it), credit taken back when the bill was refunded (a `reversal`), credit
 *  given back (a `refund`). */
export type PayFacts = {
  currency: string;
  credits: number;
  extra: number;
  takenBack: number;
  givenBack: number;
};

/** THE KIND WORD (MESITA-4001): what a row is, said first to a screen
 *  reader ("Visit, Taquería Orinoco, …") and drawn as the badge on its
 *  photo (KindBadge). */
export const KIND_WORD: Record<TicketRowKind, string> = {
  visit: "Visit",
  payment: "Payment",
  voucher: "Credit bought",
  bonus: "Bonus",
  story: "Story voucher",
  gift_in: "Gift received",
  gift_out: "Gift sent",
  gift_back: "Gift taken back",
  gift_link: "Gift link",
  refund: "Refund",
  reversal: "Refund",
  reservation: "Reservation",
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

/** The money a visit's payments moved, summed over its parts. */
function visitFacts(
  ids: string[],
  facts: Map<string, PayFacts>,
): PayFacts | null {
  const list = ids.map((id) => facts.get(id)).filter((f): f is PayFacts => !!f);
  if (list.length === 0) return null;
  return {
    currency: list[0].currency,
    credits: list.reduce((n, f) => n + f.credits, 0),
    extra: list.reduce((n, f) => n + f.extra, 0),
    takenBack: list.reduce((n, f) => n + f.takenBack, 0),
    givenBack: list.reduce((n, f) => n + f.givenBack, 0),
  };
}

/** The refunds folded into a payment, as words on its line (MESITA-4001):
 *  "Credit taken back · −$X", "Credit given back · +$X". */
function foldedNotes(f: PayFacts | null): Array<string | null> {
  if (!f) return [];
  return [
    f.takenBack > 0 ? `Credit taken back · −${money(f.takenBack, f.currency)}` : null,
    f.givenBack > 0 ? `Credit given back · +${money(f.givenBack, f.currency)}` : null,
  ];
}

/** A visit's row: the bill with no sign (card or cash money, not credit),
 *  its state, and
 *  the waiter on its grey line (MESITA-4001). `facts`: each payment's money
 *  by its id, from the wallet (a payment lives on its Visit, MESITA-3697). */
export function visitRows(
  visits: GuestVisit[],
  facts: Map<string, PayFacts>,
): Row[] {
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
    const href = open ? payBillPath(v.tab_id) : visitPath(v.tab_id);
    const f = visitFacts(v.part_payment_ids, facts);
    return {
      key: `v-${v.tab_id}`,
      type: "visits",
      kind: "visit",
      sign: null,
      at,
      upcoming: open,
      place: v.place.name ?? "A Mesita place",
      photo: v.place.photo_url,
      status: { label, tone },
      big: total ?? "Waiting for the bill",
      money: total != null,
      line: join(
        open && "Started",
        v.waiter_name,
        v.ticket && `Ticket ${v.ticket}`,
        ...foldedNotes(f),
      ),
      href,
      action: open
        ? { label: total ? "Continue paying" : "Open", href }
        : undefined,
    };
  });
}

// ─── The wallet: payments, vouchers, gifts ───────────────────────────────

// GIFTS ARE THEIR OWN LIST (MESITA-4036): a gift entry is never a row here;
// Tickets' Gifts list draws the server's gifts, sender to receiver.
const GIFT_KINDS = new Set(["gift_out", "gift_in", "gift_back"]);
const BOUGHT_KINDS = new Set(["prepay", "voucher"]);
const sum = (es: WalletEntry[]) => es.reduce((n, e) => n + e.amount_cents, 0);

export function walletRows(w: Wallet, now = Date.now()): Row[] {
  const out: Row[] = [];
  for (const b of w.balances) {
    const place = b.place?.name ?? "A Mesita place";
    const photo = b.place?.photo ?? null;
    const cur = b.currency;
    const href = walletPlacePath(b.place_id);
    const byPayment = new Map<string, WalletEntry[]>();
    const bonuses = b.entries.filter((e) => e.kind === "bonus");
    const usedBonus = new Set<WalletEntry>();
    // A voucher's legacy extra credit (an `extra` with a purchase id and no
    // payment id) folds into its voucher row (MESITA-4003); with no voucher
    // row to take it, it stays a row of its own.
    const boughtIds = new Set(
      b.entries
        .filter((e) => BOUGHT_KINDS.has(e.kind) && e.purchase_id)
        .map((e) => e.purchase_id as string),
    );
    const refundSeen = new Set<string>();
    const folds = (e: WalletEntry) =>
      e.kind === "extra" &&
      !e.payment_id &&
      !!e.purchase_id &&
      boughtIds.has(e.purchase_id);

    b.entries.forEach((e, i) => {
      if (folds(e)) return;
      if (
        e.payment_id &&
        (e.kind === "spend" ||
          e.kind === "extra" ||
          e.kind === "reversal" ||
          // Credit given back on a payment folds into it (MESITA-4001); the
          // CHECK gives every `refund` entry a payment id.
          e.kind === "refund")
      ) {
        const g = byPayment.get(e.payment_id) ?? [];
        g.push(e);
        byPayment.set(e.payment_id, g);
        return;
      }
      if (e.kind === "spend" || e.kind === "extra") {
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
          kind: "voucher",
          sign: "+",
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
        // A purchase refunded (no payment id): one Refund ticket per purchase
        // (MESITA-3855, MESITA-4010). Its money goes back to the card, so no
        // sign.
        const pid = e.purchase_id;
        if (pid) {
          if (refundSeen.has(pid)) return;
          refundSeen.add(pid);
        }
        const all = pid
          ? b.entries.filter((x) => x.kind === "reversal" && !x.payment_id && x.purchase_id === pid)
          : [e];
        out.push({
          key: `rv-${b.place_id}-${e.at}-${i}`,
          type: "refunds",
          kind: "refund",
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: { label: "Refunded", tone: "grey" },
          big: money(Math.abs(sum(all)), cur),
          money: true,
          line: "Back to your card",
          href: creditEntryPath(b.place_id, e),
        });
        return;
      }
      if (GIFT_KINDS.has(e.kind)) return;
    });

    // A bonus with no purchase beside it is its own prepayment ticket.
    for (const [i, e] of bonuses.entries()) {
      if (usedBonus.has(e)) continue;
      out.push({
        key: `bo-${b.place_id}-${e.at}-${i}`,
        type: "vouchers",
        kind: "bonus",
        sign: "+",
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

  // A Story voucher's bonus, waiting on the story (MESITA-3507; MESITA-4264:
  // what was paid is a voucher row above, already credited). A released
  // bonus is its own Bonus row, so it is not drawn twice.
  for (const s of w.waiting_stories ?? []) {
    if (s.state === "released") continue;
    const open = storyBonusOpen(s);
    out.push({
      key: `s-${s.purchase_id}`,
      type: "vouchers",
      kind: "story",
      sign: "+",
      at: s.paid_at,
      upcoming: false,
      place: s.place?.name ?? "A Mesita place",
      photo: s.place?.photo ?? null,
      status: open ? { label: "Waiting", tone: "ink" } : { label: "Bonus not added", tone: "grey" },
      big: money(s.bonus_cents, s.currency),
      money: true,
      line: storyLine(s, now),
      // MESITA-4405: the Story's own screen, its steps and its QR.
      href: s.story_id ? storyTicketPath(s.story_id) : walletPlacePath(s.place_id),
    });
  }

  return out;
}

/** One payment that paid no Visit (MESITA-4001): credits spent read
 *  "−$X" (credit went out), legacy extra credit alone "+$X" (credit came
 *  in), cash or card with neither has no sign. Refunds folded into it are
 *  words on its line, and it reads Refunded once any was. */
export function paymentRow(
  key: string,
  place: string,
  photo: string | null,
  cur: string,
  g: WalletEntry[],
  paymentId: string | null,
  href: string,
): Row {
  const total = (kind: string) =>
    Math.abs(sum(g.filter((e) => e.kind === kind)));
  const facts: PayFacts = {
    currency: cur,
    credits: total("spend"),
    extra: total("extra"),
    takenBack: total("reversal"),
    givenBack: total("refund"),
  };
  const at = g.map((e) => e.at).sort()[0]!;
  const cash = g.some((e) => e.kind === "extra" && e.confirmed_by === "waiter");
  const refunded = facts.takenBack > 0 || facts.givenBack > 0;
  const spent = facts.credits > 0;
  const backOnly = !spent && facts.extra > 0;
  return {
    key,
    type: "visits",
    kind: "payment",
    sign: spent ? "−" : backOnly ? "+" : null,
    paymentId,
    payFacts: facts,
    at,
    upcoming: false,
    place,
    photo,
    status: refunded
      ? { label: "Refunded", tone: "grey" }
      : { label: "Paid", tone: "green" },
    big: spent
      ? money(facts.credits, cur)
      : backOnly
        ? money(facts.extra, cur)
        : "Paid in cash",
    money: true,
    line: join(
      cash ? "Cash" : spent ? "Credits" : backOnly ? "Credit" : null,
      ...foldedNotes(facts),
      g.some((e) => e.pending) && "pending",
    ),
    href,
  };
}
