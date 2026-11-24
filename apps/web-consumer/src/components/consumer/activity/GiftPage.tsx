"use client";

// A GIFT'S TICKET: /me/tickets/gift/<giftId> (MESITA-4066; a ticket like a
// voucher's and a visit's since MESITA-4637, Pato 2026-11-21: "TRY TO KEEP A
// SIMILAR STRUCTURE FOR A GIFT TICKET. 1. Send 2. Receive 3. Receipt (like if
// someone took it or the sender took it … but keep things cleaner)").
//
// Pay Bill's frame (pay-flow.tsx): the step's name at the left of the header,
// ✕ at the right, the strip Send · Receive · Receipt at the bottom over one
// dark button. It opens on the step the gift stands on (gift-ticket.ts
// giftStep); ← walks back through the earlier steps, Next forward.
//
//   1 Send      who sent how much, when, at which place
//   2 Receive   waiting for a friend, or who took it and when
//   3 Receipt   the outcome in one plain line, then From · To · Amount
//
//   The one button: the sender of a waiting gift can Take back (one
//   confirm, GiftTakeBack); the receiver of a taken gift opens the Loyalty
//   Card; otherwise Done. ✕ goes back to Gifts.
//
// The gift comes from the wallet read Tickets already holds (the same cached
// key), found by its id; one it cannot find says so and goes back to Gifts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { StepBody, StepFooter, TicketHeader } from "@/components/consumer/pay/pay-flow";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  apiGetWallet,
  money,
  WALLET_CACHE_KEY,
  type GiftPerson,
  type GiftTicket,
  type Wallet,
} from "@/lib/api/wallet";
import { walletPlacePath } from "@/lib/consumer-route-contract";
import { findGift, GIFT_STEPS, giftHoldUntil, giftState, giftStep, readyIn } from "@/lib/gift-ticket";
import { goBack, navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ticketsHref } from "@/lib/ticket-kinds";
import { useCachedQuery } from "@/lib/use-cached-query";
import { GiftFaces, giftSentence } from "./GiftTickets";
import { TakeBack } from "./GiftTakeBack";
import { PlaceMark, TicketHero, TicketLine, TicketPanel, TicketSkeleton } from "./TicketParts";

// The date is already here: clockTime against its own day is the time alone.
const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${clockTime(iso, new Date(iso))}`;

const nameOf = (p: GiftPerson | null, none: string) => (p ? (p.you ? "You" : p.name) : none);

/** The Receipt's one plain line (Pato: "keep things cleaner"). */
export function giftOutcome(g: GiftTicket): string {
  const amount = money(g.amount_cents, g.currency);
  if (g.status === "open") return "Waiting for a friend to take it.";
  if (g.status === "taken_back") return g.sender.you ? `You took it back. ${amount} is in your balance again.` : `${g.sender.name} took it back.`;
  if (g.recipient?.you) return `You took ${amount} from ${g.sender.name}.`;
  return `${nameOf(g.recipient, "A friend")} took ${amount}.`;
}

function GiftHero({ g }: { g: GiftTicket }) {
  const state = giftState(g);
  return (
    <TicketHero
      data-gift-page={g.status}
      marks={
        <>
          <GiftFaces g={g} size="page" />
          <PlaceMark photo={g.place?.photo} />
        </>
      }
      headline={giftSentence(g)}
      state={state.label}
      tone={state.tone}
      place={g.place?.name ?? "A Mesita place"}
      placeHref={walletPlacePath(g.place_id)}
    />
  );
}

/** One step's body. */
function StepView({ g, view }: { g: GiftTicket; view: 1 | 2 | 3 }) {
  const amount = money(g.amount_cents, g.currency);
  if (view === 1) {
    return (
      <>
        <GiftHero g={g} />
        <TicketPanel title="Sent">
          <TicketLine label="From" value={nameOf(g.sender, "Someone")} />
          <TicketLine label="When" value={when(g.created_at)} />
          <TicketLine label="Amount" value={amount} strong />
        </TicketPanel>
      </>
    );
  }
  if (view === 2) {
    const hold = giftHoldUntil(g);
    return (
      <>
        <GiftHero g={g} />
        <TicketPanel title="Received">
          {g.status === "open" ? (
            <TicketLine label="Status" value="Waiting for a friend" />
          ) : g.status === "taken_back" ? (
            <>
              <TicketLine label="Status" value="Nobody took it" />
              {g.taken_back_at ? <TicketLine label="Taken back" value={when(g.taken_back_at)} /> : null}
            </>
          ) : (
            <>
              <TicketLine label="Taken by" value={nameOf(g.recipient, "A friend")} />
              {g.claimed_at ? <TicketLine label="When" value={when(g.claimed_at)} /> : null}
              {hold ? <TicketLine label="Ready to spend" value={`in ${readyIn(hold)}`} /> : null}
            </>
          )}
        </TicketPanel>
      </>
    );
  }
  return (
    <>
      <GiftHero g={g} />
      <p className="text-foreground text-left text-lg leading-snug font-semibold" role="status" data-gift-outcome={g.status}>
        {giftOutcome(g)}
      </p>
      <TicketPanel title="Details">
        <TicketLine label="From" value={nameOf(g.sender, "Someone")} />
        <TicketLine label="To" value={nameOf(g.recipient, "Nobody")} />
        <TicketLine label="Amount" value={amount} strong />
      </TicketPanel>
    </>
  );
}

function GiftTicketSteps({ g, reread }: { g: GiftTicket; reread: () => void }) {
  const router = useRouter();
  const at = giftStep(g);
  // Starts on the step the gift stands on; a re-read that moves it (a friend
  // took it, it was taken back) moves the page with it.
  const [picked, setPicked] = useState<{ status: string; view: 1 | 2 | 3 } | null>(null);
  const view: 1 | 2 | 3 = picked && picked.status === g.status ? picked.view : at;
  const go = (v: 1 | 2 | 3) => setPicked({ status: g.status, view: v });
  const close = () => goBack(router, ticketsHref("gifts"));

  const footer = (primary: { label: string; onClick: () => void }) => (
    <StepFooter
      strip={view === 3 ? "done" : view}
      steps={GIFT_STEPS}
      primary={{ label: primary.label, onClick: primary.onClick, disabled: false, busy: false }}
    />
  );
  let bottom;
  if (view < at) bottom = footer({ label: "Next", onClick: () => go((view + 1) as 2 | 3) });
  else if (g.role === "sender" && g.status === "open")
    bottom = <TakeBack g={g} onDone={reread} trigger={(open) => footer({ label: "Take back", onClick: open })} />;
  else if (g.role === "recipient" && g.status === "claimed")
    bottom = footer({ label: "Open the Loyalty Card", onClick: () => navigateTo(router, walletPlacePath(g.place_id), { motion: "drill" }) });
  else bottom = footer({ label: "Done", onClick: close });

  return (
    <>
      <TicketHeader title={GIFT_STEPS[view - 1]} onBack={view > 1 ? () => go((view - 1) as 1 | 2) : undefined} onClose={close} />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" data-gift-ticket={view}>
        <StepBody className="text-left">
          <StepView g={g} view={view} />
        </StepBody>
        {bottom}
      </div>
    </>
  );
}

export function GiftPage({ giftId }: { giftId: string }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  // The same read and key Tickets holds, so a tap from the list paints at once.
  const wallet = useCachedQuery<Wallet>(WALLET_CACHE_KEY, () => apiGetWallet(getSupabase()), {
    ttl: 2 * 60 * 1000,
  });
  const g = wallet.data ? findGift(wallet.data, giftId) : null;

  return (
    <div className="bg-card flex h-full min-h-0 flex-1 flex-col" data-gift-ticket-route>
      {g ? (
        <GiftTicketSteps g={g} reread={() => wallet.reload()} />
      ) : (
        <>
          <TicketHeader title="Gift" onClose={() => goBack(router, ticketsHref("gifts"))} />
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
            {!wallet.data ? (
              wallet.error ? (
                <EmptyState
                  icon={Gift}
                  title="Couldn't load this gift"
                  description="Check your connection and try again."
                  action={{ label: "Try again", onClick: () => wallet.reload() }}
                />
              ) : (
                <TicketSkeleton />
              )
            ) : (
              <EmptyState
                icon={Gift}
                title="This gift isn't here"
                description="It may have moved since the list loaded."
                action={{ label: "Back to Gifts", href: ticketsHref("gifts") }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
