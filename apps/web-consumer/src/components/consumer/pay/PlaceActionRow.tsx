"use client";

import { SizedImg } from "@mesita/place-profile";
import { Gift } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { untilLabel } from "@/components/consumer/wallet/WalletLists";

// A CARD, NOT A ROW (Pato, 2026-11-24, MESITA-4839: "credits must be more
// visible. that looks like shit. try better"): the place's photo under a dark
// scrim, its name at the top, the balance large at the bottom, a white Gift
// button at the top right (MESITA-4838: "each credit card having a quick button to
// gift"). The whole card opens the Loyalty Card; Gift is its own link over
// it. A one-line row with a black pill before (MESITA-4573, 4586).

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
  /** The place picture. A missing one leaves the card black. */
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
    <div
      className={cn("bg-foreground relative isolate flex min-h-32 flex-col overflow-hidden rounded-2xl text-white", disabled && "opacity-60 grayscale")}
      data-wallet-row
      data-place-id={placeId}
    >
      {photo ? <SizedImg src={photo} size="card" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" /> : null}
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/60 to-black/75" aria-hidden />
      <button
        type="button"
        disabled={disabled}
        aria-label={disabled ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}` : `${name}, ${amount} in credits`}
        onClick={() => onOpen?.()}
        className="flex flex-1 flex-col items-start justify-between gap-3 p-3.5 text-left disabled:cursor-default"
        data-loyalty-card
      >
        <span className={cn("line-clamp-2 max-w-full text-base leading-tight font-semibold", giftHref && "pr-28")}>{name}</span>
        <span className="block min-w-0 max-w-full">
          {subtitle ? (
            <span className="block text-sm font-semibold">{subtitle}</span>
          ) : (
            <>
              <span className="block text-sm leading-tight font-semibold text-white/80">Your credits</span>
              <span className="mt-1 block text-2xl leading-none font-semibold break-words tabular-nums" data-loyalty-balance>
                {amount}
              </span>
            </>
          )}
          {pending && !disabled ? (
            <span className="mt-2 block text-sm leading-tight font-semibold text-emerald-400 tabular-nums" data-wallet-pending>
              +{pending} pending <PendingEta at={pendingAt} />
            </span>
          ) : null}
        </span>
      </button>
      {giftHref ? (
        <PushLink
          href={giftHref}
          aria-label={`Send a gift from ${name}`}
          className="absolute top-3 right-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-semibold text-neutral-950 hover:bg-white/90"
          data-card-gift
        >
          <Gift className="h-5 w-5" strokeWidth={2} aria-hidden />
          Gift
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
