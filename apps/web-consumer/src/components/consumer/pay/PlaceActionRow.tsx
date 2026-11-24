"use client";

import { ChevronRight, Gift } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { PlacePhoto } from "./pay-common";
import { untilLabel } from "@/components/consumer/wallet/WalletLists";

// THE CARD AT THE LEFT, ITS GIFT BOX AT THE RIGHT (Pato, 2026-11-24,
// MESITA-4851: "left pp, name, credits two lines, right gift box"; "don't mention gift, just a gift box and an
// arrow"; then "make the box and the gift separate boxes, both with
// its own >", MESITA-4855): two boxes, 56px, Add Loyalty Card's height. The card opens the Loyalty Card. The photo
// repeated behind the words before (MESITA-4839..4843).

export function PlaceActionRow({
  name,
  photo = null,
  amount,
  subtitle,
  pending = null,
  pendingAt = null,
  placeId,
  disabled = false,
  giftHref = null,
  onOpen,
}: {
  name: string;
  /** The place picture. A missing one is the name's first letter. */
  photo?: string | null;
  /** The balance. */
  amount: string;
  /** Why the card can't be used; it replaces the balance. */
  subtitle?: string | null;
  /** "$50.00MX" still landing here. */
  pending?: string | null;
  /** When the soonest of it turns Available (MESITA-4644). */
  pendingAt?: string | null;
  placeId?: string;
  disabled?: boolean;
  /** Send this card's credit to a friend; null when there is none to send. */
  giftHref?: string | null;
  onOpen?: () => void;
}) {
  return (
    <div className={cn("flex items-stretch gap-2", disabled && "opacity-60 grayscale")} data-wallet-row data-place-id={placeId}>
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}` : `${name}, ${amount} in credits`}
        onClick={() => onOpen?.()}
        className="bg-muted hover:bg-foreground/10 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 max-[429px]:gap-2 max-[429px]:px-2 py-1.5 text-left transition disabled:cursor-default"
        data-loyalty-card
      >
        {/* A CARD'S SHAPE, the + chip's (Pato, 2026-11-24, MESITA-4855). */}
        <PlacePhoto place={{ photo, name }} className="h-8 w-12 rounded-md max-[359px]:hidden" />
        <span className="min-w-0 flex-1">
          {/* One size, name and amount (Pato, 2026-11-24, MESITA-4859). */}
          <span className="block truncate text-base leading-tight font-semibold max-[429px]:text-sm">{name}</span>
          {subtitle ? (
            <span className="text-muted-foreground block text-sm leading-tight">{subtitle}</span>
          ) : (
            <span className="block text-base leading-tight font-semibold whitespace-nowrap tabular-nums max-[429px]:text-sm" data-loyalty-balance>
              {amount}
            </span>
          )}
          {pending && !disabled ? (
            <span className="block text-xs leading-tight font-semibold text-emerald-700 tabular-nums" data-wallet-pending>
              +{pending} pending <PendingEta at={pendingAt} />
            </span>
          ) : null}
        </span>
        {disabled ? null : <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />}
      </button>
      {giftHref ? (
        <PushLink
          href={giftHref}
          aria-label={`Send a gift from ${name}`}
          className="bg-foreground text-background hover:bg-foreground/85 flex min-h-14 w-[4.5rem] max-[429px]:w-14 shrink-0 items-center justify-center gap-1 rounded-xl transition"
          data-card-gift
        >
          <Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </PushLink>
      ) : null}
    </div>
  );
}

/** WHEN IT ARRIVES (Pato, 2026-11-22, MESITA-4644: "in the pending mention
 *  in how much time will they arrive, like the credits"): "Ready in 1 h 48
 *  min", the Loyalty Card page's words, every 30 s; "Ready soon" once due. */
function PendingEta({ at }: { at: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [at]);
  const t = at ? Date.parse(at) : Number.NaN;
  if (!Number.isFinite(t)) return null;
  return <span>· {t > now ? `Ready in ${untilLabel(t - now)}` : "Ready soon"}</span>;
}
