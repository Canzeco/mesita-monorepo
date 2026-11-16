"use client";

// A VISIT'S FULL STATEMENT, /me/tickets/visits/<visitId> (MESITA-3770 made it one
// page apart from the live pay screens; MESITA-3780, Pato: "in visits mention
// the select pay methods and everything. be fucking detailed"). Opened from
// Me › Tickets for a bill that is paid, expired or cancelled; an open bill
// still opens /pay/bill/<id>.
//
// ONE RECEIPT (MESITA-3865), built from TicketParts (MESITA-4002) so every
// ticket page wears the same boxes and buttons. In boxes since MESITA-4118,
// the Gift ticket's shape: a centred top box, then each section its own panel.
//
//   [photo+badge]                         the top box:
//   $230.00MX                             the total
//   Paid · 22:51                          the state, coloured
//   Taquería Orinoco ›                    the place, a link to it
//   Wed, Nov 11 · 22:34                   when; the Test chip
//
//   Receipt           Bill · Tip · Total
//   Paid with         one line per method: its bill + tip and its amount; a
//                     state only when it is not simply Paid ("Didn't go
//                     through" is ink, never red); a paid part opens its receipt
//   Cashback          only when earned or pending
//   Split             a share or a split table (S16)
//   Details           who typed the bill, waiter, ticket, the visit number
//                     with a copy button
//   Timeline          its own box, closed until tapped
//   Pay here again (filled) · Open the place
//
// A visit nothing was paid on (expired, cancelled) says "Nothing was
// charged." and draws no payment or cashback lines: a page of "Not charged"
// said one fact many times.
//
// No green full screen, no live clock, no steps: those are for the waiter at
// the table. One read of consumer-web-get-tab; older reads without the part
// amounts fall back to the tab's own split.

import { useEffect, useState, type ReactNode } from "react";
import { Banknote, Copy, CreditCard, UtensilsCrossed, WalletCards } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGetTab, type GuestTab, type GuestVisit } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { payPlacePath, payReceiptPath, placePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { readCached } from "@/lib/screen-cache";
import { toast } from "@/lib/toast";
import {
  PlaceMark,
  TicketActions,
  TicketHero,
  TicketLine,
  TicketPage,
  TicketPanel,
  TicketSkeleton,
  TimelinePanel,
  type TicketTone,
} from "./TicketParts";

type Part = GuestTab["parts"][number];

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
const when = (iso: string) => `${day(iso)} · ${clockTime(iso)}`;

export function VisitSummary({ tabId }: { tabId: string }) {
  const getSupabase = useLazyBrowserSupabase();
  const [tab, setTab] = useState<GuestTab | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let gone = false;
    apiGetTab(getSupabase(), tabId)
      .then((r) => {
        if (!gone) setTab(r.tab);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [getSupabase, tabId, attempt]);

  return (
    <MeScreen title="Visit">
      {tab ? (
        <Statement tab={tab} />
      ) : failed ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Couldn't load this visit"
          description="Check your connection and try again."
          action={{
            label: "Try again",
            onClick: () => {
              setFailed(false);
              setAttempt((n) => n + 1);
            },
          }}
        />
      ) : (
        <TicketSkeleton />
      )}
    </MeScreen>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

/** A part's state in words, and its tone; null when it is simply Paid (the
 *  header already says so). Nothing reads red (S22). */
function partState(p: Part | undefined, guestTab: boolean, tabPaid: boolean): [string | null, TicketTone] {
  if (!p) return ["Not charged", "grey"];
  switch (p.status) {
    case "paid":
      return [tabPaid ? null : p.paid_at ? `Paid · ${clockTime(p.paid_at)}` : "Paid", "ink"];
    case "partly_refunded":
      return ["Partly refunded", "ink"];
    case "refunded":
      return ["Refunded", "grey"];
    case "opening":
    case "open":
      return p.part === "card"
        ? ["Charging", "ink"]
        : [guestTab ? "Waiting for the waiter" : "Waiting for the cash", "ink"];
    case "failed":
      return ["Didn't go through", "ink"];
    case "expired":
      return ["Not charged", "grey"];
    default:
      return [p.status, "grey"];
  }
}

/** The visit number's copy button: the full id goes to the clipboard. */
function CopyVisitId({ id }: { id: string }) {
  return (
    <button
      type="button"
      aria-label="Copy the visit number"
      className="text-muted-foreground hover:bg-muted/60 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
      onClick={() => {
        void navigator.clipboard
          .writeText(id)
          .then(() => toast("Copied"))
          .catch(() => toast.error("Couldn't copy"));
      }}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

const PART_NAME: Record<string, string> = { card: "Card", outside: "Cash" };

// ─── The statement ──────────────────────────────────────────────────────────

function Statement({ tab }: { tab: GuestTab }) {
  const m = (c: number) => money(c, tab.currency);
  const paid = tab.status === "paid";
  const open = tab.status === "waiting_bill" || tab.status === "billed" || tab.status === "paying";
  const guestTab = tab.origin === "guest";
  const placeName = tab.place.name ?? "A Mesita place";

  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const chosen = tab.credit_cents + cash + card;
  const total = chosen > 0 ? chosen : (tab.bill_cents ?? 0);

  // The newest part of each kind decides its method's state.
  const latest = (kind: string) => tab.parts.filter((p) => p.part === kind).at(-1);
  const cardPart = latest("card");
  const cashPart = latest("outside");

  const state: [string, TicketTone] = paid
    ? guestTab && !tab.verified_at
      ? ["Paid · waiting for the waiter's signature", "ink"]
      : [tab.paid_at ? `Paid · ${clockTime(tab.paid_at)}` : "Paid", "green"]
    : tab.status === "expired"
      ? ["Expired · nothing was paid", "grey"]
      : tab.status === "cancelled"
        ? ["Cancelled · nothing was paid", "grey"]
        : tab.status === "paying"
          ? ["Paying", "ink"]
          : tab.status === "billed"
            ? ["Billed · not paid yet", "ink"]
            : ["Waiting for the bill", "ink"];

  // ── How it was (or would have been) paid ──
  const creditState: [string | null, TicketTone] = paid
    ? [null, "ink"]
    : open
      ? ["Held for this bill", "ink"]
      : ["Not used", "grey"];
  const methods: ReactNode[] = [];
  if (tab.credit_cents > 0) {
    methods.push(
      <TicketLine
        key="credit"
        icon={<WalletCards className="h-4 w-4" />}
        label="Credits"
        sub={`Your credit at ${placeName} · bill only`}
        value={m(tab.credit_cents)}
        state={creditState[0]}
        tone={creditState[1]}
        strong
      />,
    );
  }
  if (card > 0 || cardPart) {
    const [s, tone] = partState(cardPart, guestTab, paid);
    methods.push(
      <TicketLine
        key="card"
        icon={<CreditCard className="h-4 w-4" />}
        label="Card"
        sub={`${m(tab.card_bill_cents)} bill + ${m(tab.card_tip_cents)} tip`}
        value={m(card)}
        state={s}
        tone={tone}
        href={cardPart && cardPart.paid_at ? payReceiptPath(cardPart.id) : undefined}
        strong
      />,
    );
  }
  if (cash > 0 || cashPart) {
    let [s, tone] = partState(cashPart, guestTab, paid);
    if (!cashPart && !open) {
      s = "Not paid";
      tone = "grey";
    }
    methods.push(
      <TicketLine
        key="cash"
        icon={<Banknote className="h-4 w-4" />}
        label="Cash"
        sub={`${m(tab.cash_bill_cents)} bill + ${m(tab.cash_tip_cents)} tip · given to the waiter`}
        value={m(cash)}
        state={s}
        tone={tone}
        href={cashPart && cashPart.paid_at ? payReceiptPath(cashPart.id) : undefined}
        strong
      />,
    );
  }

  // ── Cashback: its own section only when earned or pending ──

  // ── Timeline ──
  const events: Array<[string, string, string?]> = [];
  if (tab.created_at) events.push([tab.created_at, "Opened"]);
  if (tab.billed_at)
    events.push([
      tab.billed_at,
      guestTab ? "You typed the bill" : tab.waiter_name ? `Billed by ${tab.waiter_name}` : "Billed by the waiter",
      tab.bill_cents != null ? m(tab.bill_cents) : undefined,
    ]);
  if (tab.paying_at) events.push([tab.paying_at, "You chose how to pay", chosen > 0 ? m(chosen) : undefined]);
  for (const p of tab.parts) {
    const name = PART_NAME[p.part ?? ""] ?? "Payment";
    const amount = (p.card_cents ?? 0) + (p.cash_cents ?? 0) + (p.credit_cents ?? 0) + (p.tip_cents ?? 0);
    if (p.created_at) events.push([p.created_at, `${name} payment started`, amount > 0 ? m(amount) : undefined]);
    if (p.paid_at) events.push([p.paid_at, `${name} paid`]);
    else if (p.status === "failed" && p.created_at) events.push([p.created_at, `${name} payment failed`]);
  }
  if (tab.paid_at) events.push([tab.paid_at, "Paid", m(total)]);
  if (tab.verified_at) events.push([tab.verified_at, "Signed by the waiter"]);
  if (tab.status === "expired") events.push([tab.expires_at, "Expired"]);
  if (tab.status === "cancelled") events.push([tab.updated_at, "Cancelled"]);
  events.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));

  const suggested = tab.tip_suggested_cents;
  const opened = tab.created_at ?? tab.billed_at ?? tab.updated_at;

  // Nothing was paid and the bill is closed: no payment or cashback lines.
  const unpaid = !paid && !open;
  const typedBy = guestTab ? "You" : (tab.waiter_name ?? "The waiter");

  const photo =
    readCached<{ visits: GuestVisit[] }>("activity-visits")?.visits.find((v) => v.place.id === tab.place.id)?.place
      .photo_url ?? null;
  const showReceipt = tab.bill_cents != null || !unpaid;

  return (
    <TicketPage data-visit-summary>
      <TicketHero
        marks={<PlaceMark photo={photo} kind="visit" />}
        headline={tab.bill_cents == null && chosen === 0 ? "No bill" : m(total)}
        state={state[0]}
        tone={state[1]}
        place={placeName}
        placeHref={placePath(tab.place.id)}
        when={when(tab.paid_at ?? opened)}
        note={showReceipt ? null : "Nothing was charged."}
        test={tab.test_mode}
        dim={!paid}
      />

      {showReceipt ? (
        <>
          {tab.bill_cents != null ? (
            <TicketPanel title={unpaid ? "The bill" : "Receipt"}>
              <TicketLine label="Bill" value={m(tab.bill_cents)} />
              <TicketLine
                label="Tip"
                sub={suggested > 0 && suggested !== tip ? `The waiter suggested ${m(suggested)}` : null}
                value={tip > 0 ? m(tip) : chosen > 0 ? "No tip" : suggested > 0 ? `${m(suggested)} suggested` : "—"}
              />
              <TicketLine label="Total" value={m(tab.bill_cents + tip)} strong />
            </TicketPanel>
          ) : null}
          {!unpaid ? (
            <TicketPanel title="Paid with">
              {methods.length > 0 ? methods : <TicketLine label="No payment method chosen yet" />}
            </TicketPanel>
          ) : null}
        </>
      ) : null}

      {tab.table ? (
        <TicketPanel title="Split with friends">
          <TicketLine label="Table bill" value={m(tab.table.bill_cents)} />
          <TicketLine
            label="Split"
            value={tab.table.ways ? `${tab.table.ways} ways` : `${tab.table.shares.length} shares`}
          />
          {tab.bill_cents != null ? <TicketLine label="Your share" value={m(tab.bill_cents)} strong /> : null}
          <TicketLine label="Paid at the table" value={m(tab.table.paid_cents)} />
          <TicketLine label="Left" value={m(tab.table.left_cents)} />
        </TicketPanel>
      ) : null}

      <TicketPanel title="Details">
        {tab.bill_cents != null ? <TicketLine label="Bill typed by" value={typedBy} /> : null}
        {tab.waiter_name ? <TicketLine label="Waiter" value={tab.waiter_name} /> : null}
        {tab.ticket ? <TicketLine label="Ticket" value={`#${tab.ticket}`} /> : null}
        <TicketLine
          label="Visit number"
          value={tab.tab_id.slice(0, 8).toUpperCase()}
          trailing={<CopyVisitId id={tab.tab_id} />}
        />
      </TicketPanel>
      <TimelinePanel steps={events.map(([at, label, value]) => ({ label, when: when(at), value }))} />

      <TicketActions
        primary={{ label: "Pay here again", href: payPlacePath(tab.place.id) }}
        secondary={{ label: "Open the place", href: placePath(tab.place.id) }}
      />
    </TicketPage>
  );
}
