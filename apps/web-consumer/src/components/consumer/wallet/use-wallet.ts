"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGetWallet, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { walletPlacePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import type { WalletCardModel } from "./WalletCard";

// ONE READ, ONE PAINT (MESITA-3814): /wallet asks `withCards`, so its saved
// cards ride this same read and the page draws once.
//
// THE WALLET'S MONEY, read once for both Wallet screens (MESITA-3614): the
// rails at /wallet and a place's House Card at /wallet/<placeId>. Money
// comes from consumer-web-get-wallet only; nothing here adds anything up
// (MESITA-3098).
//
// Checkout comes back with `?prepay=<session>` (_shared/vouchers.ts), on the
// House Card of the place the guest bought at (MESITA-3617): the read credits it, the toast says what the server said, and the parameter
// is dropped so a reload does not ask again. While the server is still
// confirming a purchase (`settling`) the screen says so and asks again.
//
// ONLY MESITA PAY PLACES WITH CREDIT OR HISTORY (MESITA-3514, Pato,
// 2026-11-08): a card per balance row, no catalog read. A $0 balance shows
// only while its place takes Mesita Payments (or the guest pinned it,
// MESITA-3611); money held never hides.

const PREPAY_PARAM = "prepay";
/** A purchase the server is still confirming is asked about again. */
const SETTLING_RETRY_MS = 4_000;

export type CreditRow = { card: WalletCardModel; balance: WalletBalance; placeId: string; placeSlug: string };

function hasMoney(b: WalletBalance): boolean {
  return b.available_cents > 0 || b.pending_cents > 0;
}

function newestFirst(a: WalletBalance, b: WalletBalance): number {
  return b.last_at.localeCompare(a.last_at);
}

/** Money held always shows; a $0 balance only where Mesita Payments is on. */
function shows(b: WalletBalance): boolean {
  return hasMoney(b) || b.pinned === true || b.place?.mesita_pay === true;
}

function creditRow(b: WalletBalance): CreditRow {
  return {
    balance: b,
    placeId: b.place_id,
    placeSlug: b.place?.slug ?? b.place_id,
    card: {
      key: `${b.place_id}:${b.currency}`,
      name: b.place?.name ?? "A Mesita place",
      photo: b.place?.photo ?? null,
      tier: b.place?.boost_tier ?? null,
      currency: b.currency,
      available_cents: b.available_cents,
      pending_cents: b.pending_cents,
      hasBalance: true,
      // Every card opens its House Card page: history, Pay here, Fund, Gift.
      tap: { kind: "link", href: walletPlacePath(b.place_id) },
    },
  };
}

function sayOutcome(w: Wallet) {
  switch (w.outcome) {
    case "credited":
    case "already_paid":
      toast.success("Added to your balance.");
      return;
    case "expired":
      toast("Checkout cancelled. Nothing was charged.");
      return;
    case "pending":
      toast("Confirming your payment…");
      return;
    default:
      return;
  }
}

export function useWallet({ withCards = false }: { withCards?: boolean } = {}): {
  wallet: Wallet | null;
  failed: boolean;
  /** Shown balances as cards: money first, newest first; then $0 ones. */
  credits: CreditRow[] | null;
  reread: () => void;
  /** A purchase is still being confirmed: its card may not be here yet. */
  confirming: boolean;
} {
  const getSupabase = useLazyBrowserSupabase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [awaiting, setAwaiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const params = new URLSearchParams(window.location.search);
    const session = params.get(PREPAY_PARAM) ?? undefined;
    if (session) {
      params.delete(PREPAY_PARAM);
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    void apiGetWallet(getSupabase(), session, { withCards })
      .then((w) => {
        if (cancelled) return;
        setWallet(w);
        setFailed(false);
        if (session) sayOutcome(w);
        // Still confirming: ask once more after a moment.
        const pending = w.settling || (session !== undefined && w.outcome === "pending");
        setAwaiting(pending);
        if (pending) {
          timer = setTimeout(() => {
            if (!cancelled) setNonce((n) => n + 1);
          }, SETTLING_RETRY_MS);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // getSupabase is a new function each render: listing it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Derived, never stored: a balance that appears on a settling retry takes
  // its card on the next render.
  const credits = useMemo(() => {
    if (!wallet) return null;
    const shown = wallet.balances.filter(shows);
    return [
      ...shown.filter(hasMoney).sort(newestFirst),
      ...shown.filter((b) => !hasMoney(b)).sort(newestFirst),
    ].map(creditRow);
  }, [wallet]);

  const reread = useCallback(() => setNonce((n) => n + 1), []);
  return { wallet, failed, credits, reread, confirming: awaiting };
}
