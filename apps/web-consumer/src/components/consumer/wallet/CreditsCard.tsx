"use client";

import Link from "next/link";
import { ChevronRight, Gift, Plus } from "lucide-react";
import { PlaceMarks, SizedImg } from "@mesita/place-profile";
import { firstInitial } from "@mesita/place-profile/lib/format";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { ENTRY_LABEL, money, type WalletEntry } from "@/lib/api/wallet";
import { payReceiptPath } from "@/lib/consumer-route-contract";
import { cardAmount } from "@/lib/wallet-card";
import { cn } from "@/lib/utils";
import { type WalletCardModel, walletCardLabel } from "./WalletCard";

// A CREDITS CARD ON THE WALLET (Pato, 2026-11-11, MESITA-3736,
// /plan-design-review, every choice his: "each card must have the
// transactions and a button to add funds (prepay) and a button to gift
// funds"). One white container per place: a short black band (photo, name,
// the server's amount, the pending line; it opens the House Card), the 3
// newest entries with "See all transactions" (the House Card), then Fund
// (black) and Gift (grey), equal width, 48px. It undoes MESITA-3731's "Fund
// and Gift go inside"; the House Card page keeps them too.
//
// Fund is the place's purchase (`?rewards=prepayment`, 3A: the tested flow,
// no new money sheet). Gift is giftAction's: open the sheet, say why not
// (pending/held or $0, greyed), or hidden when sending is off. A place gone
// from Mesita gets neither, only the ask-support line. A paid bill entry
// opens its receipt, as on the House Card.

/** Entries shown inline before "See all" (1A). */
const INLINE_ENTRIES = 3;

export type CreditsCardGift =
  | { kind: "open"; onOpen: () => void }
  | { kind: "blocked"; message: string; onTap: () => void }
  | null;

const BUTTON = "flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function EntryRow({ entry, currency }: { entry: WalletEntry; currency: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate">{ENTRY_LABEL[entry.kind] ?? entry.kind}</span>
      <span className="shrink-0 font-semibold tabular-nums">
        {entry.amount_cents > 0 ? "+" : ""}
        {money(entry.amount_cents, currency)}
        {entry.pending ? <span className="text-muted-foreground font-normal"> · pending</span> : null}
      </span>
      <span className="text-muted-foreground w-14 shrink-0 text-right tabular-nums">{shortDate(entry.at)}</span>
    </>
  );
  const row = "flex min-h-11 items-center gap-3 text-sm";
  return entry.kind === "spend" && entry.payment_id ? (
    <PushLink href={payReceiptPath(entry.payment_id)} className={cn(row, "underline-offset-4 hover:underline")}>
      {body}
    </PushLink>
  ) : (
    <div className={row}>{body}</div>
  );
}

export function CreditsCard({
  card,
  entries,
  houseHref,
  fundHref,
  gift,
  gone,
  eager = false,
}: {
  card: WalletCardModel;
  entries: WalletEntry[];
  /** The House Card page: the band and "See all" open it. */
  houseHref: string;
  fundHref: string;
  gift: CreditsCardGift;
  /** The place left Mesita: no Fund or Gift. */
  gone: boolean;
  eager?: boolean;
}) {
  const amount = cardAmount(card);
  const shown = entries.slice(0, INLINE_ENTRIES);
  return (
    <section
      aria-label={`${card.name} Credits Card`}
      className="border-border bg-card overflow-hidden rounded-2xl border"
      data-credits-card
    >
      <Link
        href={houseHref}
        aria-label={walletCardLabel(card)}
        className="m-2 flex min-h-[6.75rem] flex-col justify-between rounded-xl bg-neutral-950 p-4 text-white transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="flex items-center gap-2.5">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white" aria-hidden>
            {card.photo ? (
              <SizedImg src={card.photo} size="thumb" alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold">{firstInitial(card.name)}</span>
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 truncate text-base font-semibold">{card.name}</span>
            <PlaceMarks tier={card.tier} ad={false} />
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
        </span>
        <span className="mt-3 flex items-end justify-between gap-3" aria-hidden>
          <span className={cn("text-2xl font-semibold tabular-nums", amount.cents === 0 && "text-white/50")}>
            {money(amount.cents, card.currency)}
          </span>
          {card.pending_cents > 0 ? (
            <span className="text-sm text-white/60 tabular-nums">
              {amount.pending ? "Pending" : `${money(card.pending_cents, card.currency)} pending`}
            </span>
          ) : null}
        </span>
      </Link>

      <div className="px-4">
        {shown.length > 0 ? (
          <>
            <ul className="divide-border divide-y" aria-label="Latest transactions" data-credits-card-entries>
              {shown.map((e, i) => (
                <li key={i}>
                  <EntryRow entry={e} currency={card.currency} />
                </li>
              ))}
            </ul>
            <Link
              href={houseHref}
              className="border-border flex min-h-11 items-center justify-between border-t text-sm font-semibold"
              data-credits-card-all
            >
              See all transactions
              <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground flex min-h-11 items-center text-sm">No transactions yet</p>
        )}
      </div>

      {gone ? (
        <p className="text-muted-foreground px-4 pb-4 text-sm">Your credit here stays yours; ask Mesita support to use it.</p>
      ) : (
        <div className="flex gap-2 px-2 pb-2">
          <PushLink
            href={fundHref}
            className={cn(BUTTON, "bg-foreground text-paper hover:opacity-90")}
            aria-label={`Fund your ${card.name} card`}
            data-credits-card-fund
          >
            <Plus className="h-4 w-4" aria-hidden />
            Fund
          </PushLink>
          {gift ? (
            <button
              type="button"
              onClick={gift.kind === "open" ? gift.onOpen : gift.onTap}
              aria-label={gift.kind === "open" ? `Gift credit from your ${card.name} card` : `Gift: ${gift.message}`}
              className={cn(BUTTON, "bg-muted hover:bg-muted/70", gift.kind === "blocked" && "text-muted-foreground")}
              data-credits-card-gift
            >
              <Gift className="h-4 w-4" aria-hidden />
              Gift
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** No Credits Card yet (2A): a ghost of the band and one way forward. */
export function EmptyCreditsCard({ href }: { href: string }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-2" data-wallet-empty-credits>
      <div className="border-muted-foreground/40 flex min-h-[6.75rem] items-center rounded-xl border-2 border-dashed p-4">
        <p className="text-muted-foreground text-sm leading-relaxed">Credits Cards hold money you prepay at one place.</p>
      </div>
      <Link href={href} className={cn(BUTTON, "bg-foreground text-paper mt-2 w-full hover:opacity-90")}>
        Find a place
      </Link>
    </div>
  );
}

/** A Credits Card loading: band, three lines, the buttons. Pay's loading
 *  frame draws the same. */
export function CreditsCardSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border p-2" aria-hidden>
      <Skeleton className="h-[6.75rem] w-full rounded-xl" />
      <div className="px-2 py-2">
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-2/3" />
      </div>
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
