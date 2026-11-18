"use client";

// ONE GIFT, ONE PAGE: /me/tickets/gift/<giftId> (MESITA-4066, Pato
// 2026-11-15: "Like this guy sent money and if nobody has taken then
// waiting. Or if someone has claimed then like show"). A Gifts row opens it,
// and a gift line's credit page forwards here. Each section is a bordered
// panel, as on the Loyalty Card page (the shared Panel, MESITA-4064). Since
// MESITA-4118 it is the standard every ticket follows: its top box and panels
// are TicketParts' TicketHero, TicketPanel and TimelinePanel.
//
//   (Pato)(Ana)🎁 [place]     the Gifts row's picture, 64px
//   You sent $3.00MX          the sentence
//   Taken · ready in 1 hr     the state in its tone (lib/gift-ticket.ts)
//   Taquería Orinoco ›        the place, opening its Loyalty Card
//
//   Timeline   Sent · then Taken by Ana, or Taken back, from the gift's own
//              row (wallet_gifts), never paired by amount
//   Details    From · To · Amount
//
//   One action by state: the sender of an open gift can Take back (confirmed
//   in a LocalDialog, then the wallet read again); the receiver of a taken
//   gift can Open the Loyalty Card to spend it. Otherwise none.
//
// The gift comes from the wallet read Tickets already holds (the same cached
// key), found by its id; one it cannot find says so and goes back to Gifts.

import { Gift } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PushLink } from "@/components/consumer/nav/PushLink";
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
import { findGift, giftState } from "@/lib/gift-ticket";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ticketsHref } from "@/lib/ticket-kinds";
import { useCachedQuery } from "@/lib/use-cached-query";
import { GiftFaces, giftSentence } from "./GiftTickets";
import { TakeBack } from "./GiftTakeBack";
import {
  PlaceMark,
  TicketHero,
  TicketLine,
  TicketPage,
  TicketPanel,
  TicketSkeleton,
  TimelinePanel,
  type TicketStep,
} from "./TicketParts";

const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${clockTime(iso)}`;

const FILLED =
  "bg-foreground text-background flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition hover:opacity-90 disabled:opacity-60";

const nameOf = (p: GiftPerson | null, none: string) => (p ? (p.you ? "You" : p.name) : none);

/** The gift's steps, oldest first, from its own row. */
function stepsOf(g: GiftTicket): TicketStep[] {
  const amount = money(g.amount_cents, g.currency);
  const steps: TicketStep[] = [{ label: `Sent by ${nameOf(g.sender, "someone")}`, when: when(g.created_at), value: amount }];
  if (g.status === "claimed" && g.claimed_at) {
    steps.push({ label: `Taken by ${nameOf(g.recipient, "a friend")}`, when: when(g.claimed_at), value: amount });
  }
  if (g.status === "taken_back" && g.taken_back_at) {
    steps.push({ label: "Taken back", when: when(g.taken_back_at), value: amount });
  }
  return steps;
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

export function GiftPage({ giftId }: { giftId: string }) {
  const getSupabase = useLazyBrowserSupabase();
  // The same read and key Tickets holds, so a tap from the list paints at once.
  const wallet = useCachedQuery<Wallet>(WALLET_CACHE_KEY, () => apiGetWallet(getSupabase()), {
    ttl: 2 * 60 * 1000,
  });

  const body = (() => {
    if (!wallet.data) {
      return wallet.error ? (
        <EmptyState
          icon={Gift}
          title="Couldn't load this gift"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => wallet.reload() }}
        />
      ) : (
        <TicketSkeleton />
      );
    }
    const g = findGift(wallet.data, giftId);
    if (!g) {
      return (
        <EmptyState
          icon={Gift}
          title="This gift isn't here"
          description="It may have moved since the list loaded."
          action={{ label: "Back to Gifts", href: ticketsHref("gifts") }}
        />
      );
    }
    // Asks again and keeps this page painted until the answer lands.
    const reread = () => wallet.reload();
    return (
      <TicketPage>
        <GiftHero g={g} />
        <TimelinePanel steps={stepsOf(g)} open />
        <TicketPanel title="Details">
          <TicketLine label="From" value={nameOf(g.sender, "Someone")} />
          <TicketLine label="To" value={nameOf(g.recipient, g.status === "open" ? "Nobody yet" : "Nobody")} />
          <TicketLine label="Amount" value={money(g.amount_cents, g.currency)} strong />
        </TicketPanel>
        {g.role === "sender" && g.status === "open" ? (
          <TakeBack g={g} onDone={reread} />
        ) : g.role === "recipient" && g.status === "claimed" ? (
          <PushLink href={walletPlacePath(g.place_id)} className={FILLED}>
            Open the Loyalty Card
          </PushLink>
        ) : null}
      </TicketPage>
    );
  })();

  return <MeScreen title="Gift">{body}</MeScreen>;
}
