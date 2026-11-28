"use client";

import { ChevronRight } from "lucide-react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { apiGetWallet, WALLET_CACHE_KEY, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { placePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";

// "YOU HAVE MX$100 AT CAFÉ X" (Pato, 2026-11-27, MESITA-5068): cashback only
// keeps a guest if they remember the credit. Home names the place where the
// guest holds the most spendable credit; a tap opens that place. Credit is
// spendable only at its own place, so the reminder sends the guest back
// there. No credit, no row. The read is the server's (consumer-web-get-wallet,
// the same read and key as the Wallet).
//
// NO AMOUNT, NO WALLET ICON (Pato, 2026-11-27, MESITA-5075: "don't mention
// the amount on the header … don't mention wallet there"): the row says
// "You have credits at <place>" and nothing more.

/** The balance to remind about: the most available credit, newest on a tie. */
export function reminderBalance(w: Wallet | null | undefined): WalletBalance | null {
  const held = (w?.balances ?? []).filter((b) => b.available_cents > 0 && b.place !== null);
  if (held.length === 0) return null;
  held.sort((a, b) => b.available_cents - a.available_cents || b.last_at.localeCompare(a.last_at));
  return held[0];
}

export function CreditReminder() {
  const getSupabase = useLazyBrowserSupabase();
  const wallet = useCachedQuery<Wallet>(WALLET_CACHE_KEY, () => apiGetWallet(getSupabase()), {
    ttl: 2 * 60 * 1000,
  });
  const b = reminderBalance(wallet.data);
  if (!b?.place) return null;
  const name = b.place.name ?? "a Mesita place";
  return (
    <PushLink
      href={placePath(b.place.slug ?? b.place_id)}
      className="border-border bg-card hover:bg-muted/60 flex shrink-0 items-center gap-3 border-b px-4 py-2.5 transition-colors"
      data-home-credit-reminder
    >
      <span className="min-w-0 flex-1 truncate text-sm">
        You have credits at{" "}
        <span className="font-semibold">{name}</span>
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    </PushLink>
  );
}
